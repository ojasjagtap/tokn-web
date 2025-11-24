/**
 * Model Adapter Interface
 * Provides swappable adapters for different model providers
 */

/**
 * Base Model Adapter Interface
 */
class ModelAdapter {
    /**
     * Prepare request payload
     * @param {Object} options
     * @param {string} options.prompt - User prompt
     * @param {Array} options.toolsCatalog - Available tools
     * @param {Object} options.settings - Model settings (temperature, maxTokens)
     * @param {Object} options.sessionState - Session state for multi-turn
     * @returns {Object} Request payload
     */
    prepareRequest({ prompt, toolsCatalog, settings, sessionState }) {
        throw new Error('Not implemented');
    }

    /**
     * Parse streaming chunk
     * @param {string} chunk - Raw chunk from API
     * @param {Object} chunkState - State to track partial chunks
     * @returns {Object} { textDelta?, toolCalls? }
     */
    parseChunk(chunk, chunkState) {
        throw new Error('Not implemented');
    }

    /**
     * Continue generation with tool result
     * @param {Object} sessionState - Current session state
     * @param {Object} toolResult - Tool result { name, normalized }
     * @returns {Object} Updated session state
     */
    continueWithToolResult(sessionState, toolResult) {
        throw new Error('Not implemented');
    }
}

/**
 * Fallback Prompt Adapter
 * Uses prompt injection to simulate tool calling
 */
class FallbackPromptAdapter extends ModelAdapter {
    prepareRequest({ prompt, toolsCatalog, settings, sessionState }) {
        let enhancedPrompt = prompt;

        // Inject tool instructions if tools are available
        if (toolsCatalog && toolsCatalog.length > 0) {
            const toolsDescription = this.buildToolsDescription(toolsCatalog);

            enhancedPrompt = `${prompt}

You may use one of the following tools if needed:

${toolsDescription}

To use a tool, respond with a JSON object in this format:
{
  "tool_call": {
    "name": "tool_name",
    "arguments": { "param": "value" }
  }
}

If the user's question doesn't require a tool, simply respond to their question directly.`;
        }

        const body = {
            model: settings.model,
            prompt: enhancedPrompt,
            stream: true,
            options: {
                temperature: settings.temperature,
                num_predict: settings.maxTokens
            }
        };

        return { body, useChat: false };
    }

    parseChunk(chunk, chunkState) {
        const result = { textDelta: null, toolCalls: null };

        try {
            const lines = chunk.split('\n').filter(l => l.trim());

            for (const line of lines) {
                const data = JSON.parse(line);

                if (data.response) {
                    // Accumulate response to detect tool calls
                    if (!chunkState.accumulated) {
                        chunkState.accumulated = '';
                    }
                    chunkState.accumulated += data.response;

                    // Try to parse as tool call
                    const toolCall = this.extractToolCall(chunkState.accumulated);
                    if (toolCall) {
                        result.toolCalls = [toolCall];
                        chunkState.foundToolCall = true;
                    } else if (!chunkState.foundToolCall) {
                        // Normal text response
                        result.textDelta = data.response;
                    }
                }
            }
        } catch (error) {
            // Ignore parse errors
        }

        return result;
    }

    extractToolCall(text) {
        try {
            // Try to extract JSON from the text
            const jsonMatch = text.match(/\{[\s\S]*"tool_call"[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.tool_call && parsed.tool_call.name) {
                    return {
                        name: parsed.tool_call.name,
                        arguments: parsed.tool_call.arguments || {}
                    };
                }
            }
        } catch (error) {
            // Not a valid tool call
        }
        return null;
    }

    continueWithToolResult(sessionState, toolResult) {
        // Store tool result in session state
        if (!sessionState.toolResults) {
            sessionState.toolResults = [];
        }

        sessionState.toolResults.push({
            name: toolResult.name,
            result: this.formatToolResultForModel(toolResult.normalized)
        });

        return sessionState;
    }

    formatToolResultForModel(normalized) {
        if (!normalized.ok) {
            return `Error: ${normalized.error.message}`;
        }

        if (normalized.kind === 'text') {
            return normalized.result;
        } else if (normalized.kind === 'json') {
            return JSON.stringify(normalized.result, null, 2);
        } else if (normalized.kind === 'bytes') {
            return `[Binary data: ${normalized.result.length} bytes]`;
        }

        return String(normalized.result);
    }

    buildToolsDescription(toolsCatalog) {
        return toolsCatalog.map(tool => {
            const params = Object.entries(tool.parametersSchema.properties || {})
                .map(([name, schema]) => `  - ${name} (${schema.type}): ${schema.description || ''}`)
                .join('\n');

            return `### ${tool.name}
${tool.description}
Parameters:
${params}`;
        }).join('\n\n');
    }
}

/**
 * OpenAI Adapter with native function calling support
 */
class OpenAIAdapter extends ModelAdapter {
    constructor({ apiKey }) {
        super();
        this.apiKey = apiKey;
    }

    prepareRequest({ prompt, toolsCatalog, settings, sessionState }) {
        const hasTools = toolsCatalog && toolsCatalog.length > 0;

        // Build messages array
        // Initialize messages if not present
        if (!sessionState.messages || sessionState.messages.length === 0) {
            if (hasTools) {
                sessionState.messages = [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant. You have access to tools that you can use when needed. However, if the user\'s question can be answered directly without using any tools, you should respond directly. Only use tools when they are necessary to complete the task.'
                    },
                    { role: 'user', content: prompt }
                ];
            } else {
                sessionState.messages = [{ role: 'user', content: prompt }];
            }
        }

        const body = {
            model: settings.model,
            messages: sessionState.messages,
            temperature: settings.temperature,
            max_tokens: settings.maxTokens,
            stream: true
        };

        // Add tools if present
        if (hasTools) {
            body.tools = toolsCatalog.map(tool => ({
                type: 'function',
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parametersSchema
                }
            }));
        }

        return { body, useChat: true };
    }

    parseChunk(chunk, chunkState) {
        const result = { textDelta: null, toolCalls: null };

        try {
            const lines = chunk.split('\n').filter(l => l.trim() && l.trim() !== 'data: [DONE]');

            for (const line of lines) {
                // OpenAI streams with "data: " prefix
                const dataMatch = line.match(/^data: (.+)$/);
                if (!dataMatch) continue;

                const data = JSON.parse(dataMatch[1]);
                const choice = data.choices?.[0];
                if (!choice) continue;

                const delta = choice.delta;

                // Text content
                if (delta.content) {
                    result.textDelta = delta.content;
                }

                // Tool calls (OpenAI streams tool calls incrementally)
                if (delta.tool_calls) {
                    if (!chunkState.toolCallsBuilder) {
                        chunkState.toolCallsBuilder = {};
                    }

                    for (const tc of delta.tool_calls) {
                        const index = tc.index;
                        if (!chunkState.toolCallsBuilder[index]) {
                            chunkState.toolCallsBuilder[index] = {
                                id: '',
                                type: 'function',
                                name: '',
                                arguments: ''
                            };
                        }

                        const builder = chunkState.toolCallsBuilder[index];

                        if (tc.id) {
                            builder.id = tc.id;
                        }

                        if (tc.type) {
                            builder.type = tc.type;
                        }

                        if (tc.function?.name) {
                            builder.name = tc.function.name;
                        }

                        if (tc.function?.arguments) {
                            builder.arguments += tc.function.arguments;
                        }
                    }
                }

                // Check for finish reason
                if (choice.finish_reason === 'tool_calls' && chunkState.toolCallsBuilder) {
                    // Finalize tool calls
                    result.toolCalls = Object.values(chunkState.toolCallsBuilder).map(builder => ({
                        id: builder.id,
                        type: builder.type,
                        name: builder.name,
                        arguments: JSON.parse(builder.arguments)
                    }));
                }
            }
        } catch (error) {
            // Ignore parse errors for partial chunks
        }

        return result;
    }

    continueWithToolResult(sessionState, toolResult) {
        // Add tool result message (OpenAI format)
        // The assistant message with tool_calls should already be in sessionState.messages
        // We need to use the same tool_call_id that was in the assistant's tool_calls
        sessionState.messages.push({
            role: 'tool',
            tool_call_id: toolResult.id || `call_${Date.now()}`, // Fallback if id not provided
            content: this.formatToolResultForModel(toolResult.normalized)
        });

        return sessionState;
    }

    formatToolResultForModel(normalized) {
        if (!normalized.ok) {
            return JSON.stringify({
                error: normalized.error.message || 'Unknown error'
            });
        }

        if (normalized.kind === 'text') {
            return normalized.result;
        } else if (normalized.kind === 'json') {
            return JSON.stringify(normalized.result);
        } else if (normalized.kind === 'bytes') {
            return `[Base64 Data: ${normalized.result.length} chars]`;
        }

        return String(normalized.result);
    }
}

/**
 * Claude/Anthropic Adapter with native tool use support
 */
class ClaudeAdapter extends ModelAdapter {
    constructor({ apiKey }) {
        super();
        this.apiKey = apiKey;
    }

    prepareRequest({ prompt, toolsCatalog, settings, sessionState }) {
        const hasTools = toolsCatalog && toolsCatalog.length > 0;

        // Build messages array
        // Initialize messages if not present
        if (!sessionState.messages || sessionState.messages.length === 0) {
            sessionState.messages = [{ role: 'user', content: prompt }];
        }

        const body = {
            model: settings.model,
            messages: sessionState.messages,
            temperature: settings.temperature,
            max_tokens: settings.maxTokens,
            stream: true
        };

        // Add system message if tools are present
        if (hasTools) {
            body.system = 'You are a helpful assistant. You have access to tools that you can use when needed. However, if the user\'s question can be answered directly without using any tools, you should respond directly. Only use tools when they are necessary to complete the task.';
        }

        // Add tools if present (Anthropic format)
        if (hasTools) {
            body.tools = toolsCatalog.map(tool => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.parametersSchema
            }));
        }

        return { body, useChat: true };
    }

    parseChunk(chunk, chunkState) {
        const result = { textDelta: null, toolCalls: null };

        try {
            const lines = chunk.split('\n').filter(l => l.trim());

            for (const line of lines) {
                // Anthropic streams with "event: " and "data: " lines
                if (line.startsWith('event: ')) {
                    chunkState.currentEvent = line.substring(7).trim();
                    continue;
                }

                if (!line.startsWith('data: ')) continue;

                const data = JSON.parse(line.substring(6));

                // Handle different event types
                if (data.type === 'content_block_start') {
                    const content = data.content_block;
                    if (content.type === 'tool_use') {
                        if (!chunkState.toolCallsBuilder) {
                            chunkState.toolCallsBuilder = {};
                        }
                        chunkState.toolCallsBuilder[data.index] = {
                            id: content.id,
                            name: content.name,
                            input: ''
                        };
                    }
                } else if (data.type === 'content_block_delta') {
                    const delta = data.delta;

                    if (delta.type === 'text_delta') {
                        result.textDelta = delta.text;
                    } else if (delta.type === 'input_json_delta') {
                        // Accumulate tool input JSON
                        if (chunkState.toolCallsBuilder && chunkState.toolCallsBuilder[data.index]) {
                            chunkState.toolCallsBuilder[data.index].input += delta.partial_json;
                        }
                    }
                } else if (data.type === 'message_delta') {
                    // Check for stop reason
                    if (data.delta?.stop_reason === 'tool_use' && chunkState.toolCallsBuilder) {
                        // Finalize tool calls
                        result.toolCalls = Object.values(chunkState.toolCallsBuilder).map(builder => ({
                            id: builder.id,
                            name: builder.name,
                            arguments: JSON.parse(builder.input)
                        }));
                    }
                }
            }
        } catch (error) {
            // Ignore parse errors for partial chunks
        }

        return result;
    }

    continueWithToolResult(sessionState, toolResult) {
        // Find the assistant message with tool use
        const lastMessage = sessionState.messages[sessionState.messages.length - 1];

        // Anthropic requires tool results in a specific format
        // Add user message with tool result
        sessionState.messages.push({
            role: 'user',
            content: [
                {
                    type: 'tool_result',
                    tool_use_id: toolResult.id,
                    content: this.formatToolResultForModel(toolResult.normalized)
                }
            ]
        });

        return sessionState;
    }

    formatToolResultForModel(normalized) {
        if (!normalized.ok) {
            return JSON.stringify({
                error: normalized.error.message || 'Unknown error'
            });
        }

        if (normalized.kind === 'text') {
            return normalized.result;
        } else if (normalized.kind === 'json') {
            return JSON.stringify(normalized.result);
        } else if (normalized.kind === 'bytes') {
            return `[Base64 Data: ${normalized.result.length} chars]`;
        }

        return String(normalized.result);
    }
}

/**
 * Google Gemini Adapter with native function calling support
 */
class GeminiAdapter extends ModelAdapter {
    constructor({ apiKey }) {
        super();
        this.apiKey = apiKey;
    }

    prepareRequest({ prompt, toolsCatalog, settings, sessionState }) {
        const hasTools = toolsCatalog && toolsCatalog.length > 0;

        // Build contents array (Gemini format)
        // Initialize contents if not present
        if (!sessionState.contents || sessionState.contents.length === 0) {
            sessionState.contents = [
                {
                    role: 'user',
                    parts: [{ text: prompt }]
                }
            ];
        }

        const body = {
            contents: sessionState.contents,
            generationConfig: {
                temperature: settings.temperature,
                maxOutputTokens: settings.maxTokens
            }
        };

        // Add system instruction if tools are present
        if (hasTools) {
            body.systemInstruction = {
                parts: [{
                    text: 'You are a helpful assistant. You have access to tools that you can use when needed. However, if the user\'s question can be answered directly without using any tools, you should respond directly. Only use tools when they are necessary to complete the task.'
                }]
            };
        }

        // Add tools if present (Gemini format)
        if (hasTools) {
            body.tools = [{
                functionDeclarations: toolsCatalog.map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parametersSchema
                }))
            }];
        }

        return { body, useChat: true };
    }

    parseChunk(chunk, chunkState) {
        const result = { textDelta: null, toolCalls: null };

        try {
            const lines = chunk.split('\n').filter(l => l.trim());

            for (const line of lines) {
                // Gemini streams with "data: " prefix (SSE format)
                if (!line.startsWith('data: ')) continue;

                const data = JSON.parse(line.substring(6));

                // Gemini response structure: candidates array
                const candidate = data.candidates?.[0];
                if (!candidate) continue;

                const content = candidate.content;
                if (!content || !content.parts) continue;

                // Process each part in the content
                for (const part of content.parts) {
                    // Text content
                    if (part.text) {
                        result.textDelta = part.text;
                    }

                    // Function call (Gemini format)
                    if (part.functionCall) {
                        const fc = part.functionCall;

                        // Check if this is a complete function call or if we need to accumulate
                        if (!chunkState.currentFunctionCall) {
                            chunkState.currentFunctionCall = {
                                name: fc.name,
                                args: fc.args || {}
                            };
                        } else {
                            // Merge arguments if streaming partial args
                            Object.assign(chunkState.currentFunctionCall.args, fc.args || {});
                        }
                    }
                }

                // Check for finish reason indicating function call completion
                if (candidate.finishReason === 'STOP' && chunkState.currentFunctionCall) {
                    result.toolCalls = [{
                        id: `gemini_${Date.now()}`, // Gemini doesn't provide IDs, so we generate one
                        name: chunkState.currentFunctionCall.name,
                        arguments: chunkState.currentFunctionCall.args
                    }];
                    chunkState.currentFunctionCall = null;
                }
            }
        } catch (error) {
            // Ignore parse errors for partial chunks
        }

        return result;
    }

    continueWithToolResult(sessionState, toolResult) {
        // Add the assistant's function call message
        if (!sessionState.lastFunctionCall) {
            // This should have been stored during tool call detection
            // For safety, we'll add a basic structure
            sessionState.contents.push({
                role: 'model',
                parts: [{
                    functionCall: {
                        name: toolResult.name,
                        args: toolResult.arguments || {}
                    }
                }]
            });
        }

        // Add the function response (Gemini format)
        sessionState.contents.push({
            role: 'function',
            parts: [{
                functionResponse: {
                    name: toolResult.name,
                    response: {
                        result: this.formatToolResultForModel(toolResult.normalized)
                    }
                }
            }]
        });

        return sessionState;
    }

    formatToolResultForModel(normalized) {
        if (!normalized.ok) {
            return {
                error: normalized.error.message || 'Unknown error'
            };
        }

        if (normalized.kind === 'text') {
            return { text: normalized.result };
        } else if (normalized.kind === 'json') {
            return normalized.result;
        } else if (normalized.kind === 'bytes') {
            return { data: `[Base64 Data: ${normalized.result.length} chars]` };
        }

        return { result: String(normalized.result) };
    }
}

export {
    ModelAdapter,
    OpenAIAdapter,
    ClaudeAdapter,
    GeminiAdapter,
    FallbackPromptAdapter
};
