/**
 * GEPA Optimize Node Helper
 * Handles GEPA optimization node creation, rendering, validation, and execution
 * Uses MLflow GEPA library via Python bridge for prompt optimization
 */

import { executeGepaOptimization, checkGepaEnvironment, validateGepaConfig } from './gepa-worker.js';
import { providerRegistry } from '../src/services/providerRegistry.js';
import { createTaggedMessage, addLog } from './script.js';
// Note: path and os modules are Node.js-specific and not available in browser
// These are commented out for web version - backend functionality is disabled
// const path = require('path');
// const os = require('os');

// ============================================================================
// DATA STRUCTURE
// ============================================================================

/**
 * Initialize GEPA optimize node data structure
 */
function createGepaOptimizeNodeData() {
    return {
        title: 'GEPA',

        // Optimizer Configuration
        maxMetricCalls: 300,              // Optimization budget (iterations)

        // Scorer Configuration
        scorerType: 'correctness',        // 'correctness' | 'safety'
        useMultipleScorers: false,

        // Dataset Management
        trainDataset: [],                 // Array of {inputs: {...}, expectations: {expected_response: '...'}}
        datasetMode: 'manual',            // 'manual' | 'csv' (future)

        // Results
        optimizationStatus: 'idle',       // 'idle' | 'running' | 'success' | 'error'
        initialScore: 0,
        finalScore: 0,
        optimizedPromptText: '',
        optimizationIterations: 0
    };
}

// ============================================================================
// NODE RENDERING
// ============================================================================

/**
 * Extract optimized prompt text from GEPA node data
 */
function getOptimizedPromptText(node) {
    if (!node.data.optimizedPromptText || node.data.finalScore === 0) {
        return '';
    }

    return node.data.optimizedPromptText;
}

/**
 * Render GEPA optimize node HTML
 */
function renderGepaOptimizeNode(node, edges, nodes) {
    const collapseIconId = node.collapsed ? 'icon-chevron-right' : 'icon-chevron-down';

    // Calculate dataset info
    const trainSize = node.data.trainDataset?.length || 0;
    const datasetInfo = trainSize > 0 ? `${trainSize} examples` : 'No dataset';

    // Calculate score improvement if we have results
    const improvement = node.data.finalScore > 0
        ? ((node.data.finalScore - node.data.initialScore) * 100).toFixed(1)
        : null;

    return `
        <div class="node-header">
            <div class="header-top">
                <div class="header-left">
                    <svg class="collapse-toggle" data-node-id="${node.id}" width="12" height="12">
                        <use href="#${collapseIconId}"></use>
                    </svg>
                    <span class="node-title">${node.data.title}</span>
                </div>
                <span class="node-status-badge">${node.status}</span>
            </div>
            <div class="header-bottom">
                <div class="pin-container pin-input-container">
                    <div class="pin pin-input" data-pin="input"></div>
                    <span class="pin-label">response</span>
                </div>
                <div class="pin-spacer"></div>
            </div>
        </div>
        <div class="node-body" style="display: ${node.collapsed ? 'none' : 'block'}">
            <div class="node-description">
                <div>GEPA optimization</div>
                <div style="font-size: 10px; color: #888; margin-top: 4px;">${datasetInfo}</div>
            </div>

            <div class="node-output-viewer">${getOptimizedPromptText(node)}</div>
        </div>
    `;
}

// ============================================================================
// INSPECTOR UI
// ============================================================================

/**
 * Render GEPA optimize node inspector UI
 */
function renderGepaOptimizeInspector(node, updateNodeDisplay, edges, nodes, state) {
    const buttonDisabled = state.isRunning || state.isOptimizing || state.isRunningModelNode;
    const hasResults = node.data.finalScore > 0 && node.data.optimizedPromptText;
    const applyButtonDisabled = buttonDisabled || !hasResults;

    const html = `
        <div class="inspector-section">
            <label>Title</label>
            <input type="text" id="inspectorTitle" class="inspector-input" value="${node.data.title}">
        </div>

        <!-- Max Metric Calls -->
        <div class="inspector-section">
            <label>Max Metric Calls (Budget)</label>
            <div style="display: flex; align-items: center; gap: 10px;">
                <input type="range" id="inspectorMaxMetricCalls"
                       min="50" max="1000" step="50"
                       value="${node.data.maxMetricCalls}"
                       style="flex: 1;">
                <span id="maxMetricCallsValue" style="min-width: 50px; text-align: right;">${node.data.maxMetricCalls}</span>
            </div>
        </div>

        <!-- Scorer Configuration -->
        <div class="inspector-section">
            <label>Scorer Type</label>
            <select id="inspectorScorerType" class="inspector-input">
                <option value="correctness" ${node.data.scorerType === 'correctness' ? 'selected' : ''}>Correctness</option>
                <option value="safety" ${node.data.scorerType === 'safety' ? 'selected' : ''}>Safety</option>
            </select>
        </div>

        <!-- Training Dataset -->
        <div class="inspector-section">
            <label>Training Dataset (JSON)</label>
            <textarea id="inspectorTrainDataset" class="inspector-textarea code-editor" rows="10"
                      placeholder='[&#10;  {&#10;    "inputs": {"question": "What is 2+2?"},&#10;    "expectations": {"expected_response": "4"}&#10;  }&#10;]'>${JSON.stringify(node.data.trainDataset, null, 2)}</textarea>
            <div style="font-size: 10px; color: #888; margin-top: 4px;">
                ${node.data.trainDataset.length} examples
            </div>
        </div>

        <!-- Results Display -->
        <div class="inspector-section">
            <label>Results</label>
            <div style="background: #1a1a1a; padding: 12px; border-radius: 4px; font-size: 12px;">
                <div style="margin-bottom: 8px;">
                    <strong style="color: #4a9eff;">Final Score:</strong>
                    <span style="color: #4a9eff;">${node.data.finalScore > 0 ? (node.data.finalScore * 100).toFixed(1) + '%' : ''}</span>
                </div>
                <div>
                    <strong>Optimized Prompt:</strong>
                    <div style="margin-top: 4px; color: ${node.data.optimizedPromptText ? '#888' : '#555'};">${node.data.optimizedPromptText || ''}</div>
                </div>
            </div>
        </div>

        <!-- Action Buttons -->
        <div class="inspector-section">
            <button id="inspectorRunOptimize" class="inspector-button"
                    style="width: 100%; padding: 10px; background: ${buttonDisabled ? '#6c757d' : '#4a9eff'}; color: white; border: none; border-radius: 4px; cursor: ${buttonDisabled ? 'not-allowed' : 'pointer'}; font-size: 14px; opacity: ${buttonDisabled ? '0.6' : '1'};"
                    ${buttonDisabled ? 'disabled' : ''}>
                Run
            </button>
        </div>

        <div class="inspector-section">
            <button id="inspectorApplyToPrompt" class="inspector-button"
                    style="width: 100%; padding: 10px; background: ${applyButtonDisabled ? '#6c757d' : '#28a745'}; color: white; border: none; border-radius: 4px; cursor: ${applyButtonDisabled ? 'not-allowed' : 'pointer'}; font-size: 14px; opacity: ${applyButtonDisabled ? '0.6' : '1'};"
                    ${applyButtonDisabled ? 'disabled' : ''}>
                Apply
            </button>
        </div>
    `;

    return {
        html,
        setupListeners: (context) => {
            // Title
            document.getElementById('inspectorTitle').addEventListener('input', (e) => {
                node.data.title = e.target.value;
                updateNodeDisplay(node.id);
            });

            // Max Metric Calls
            const maxMetricCallsSlider = document.getElementById('inspectorMaxMetricCalls');
            const maxMetricCallsValue = document.getElementById('maxMetricCallsValue');
            maxMetricCallsSlider.addEventListener('input', (e) => {
                node.data.maxMetricCalls = parseInt(e.target.value);
                maxMetricCallsValue.textContent = e.target.value;
            });

            // Scorer Type
            document.getElementById('inspectorScorerType').addEventListener('change', (e) => {
                node.data.scorerType = e.target.value;
            });

            // Training Dataset
            document.getElementById('inspectorTrainDataset').addEventListener('input', (e) => {
                try {
                    const parsed = JSON.parse(e.target.value);
                    if (Array.isArray(parsed)) {
                        node.data.trainDataset = parsed;
                        updateNodeDisplay(node.id);
                    }
                } catch (err) {
                    // Invalid JSON, keep old value
                }
            });

            // Run Optimization Button
            const runButton = document.getElementById('inspectorRunOptimize');
            if (runButton && context && context.runOptimizeNode) {
                runButton.addEventListener('click', async () => {
                    // Validate before running
                    const validation = validateGepaOptimizeNode(node, context.edges, context.nodes);

                    // Show warnings
                    if (validation.warnings && validation.warnings.length > 0) {
                        validation.warnings.forEach(warning => {
                            const msg = createTaggedMessage(node.data.title, warning);
                            context.addLog('warn', msg, node.id);
                        });
                    }

                    // Show errors and stop if any
                    if (validation.errors && validation.errors.length > 0) {
                        validation.errors.forEach(error => {
                            const msg = createTaggedMessage(node.data.title, error);
                            context.addLog('error', msg, node.id);
                        });
                        return;
                    }

                    await context.runOptimizeNode(node.id);
                });
            }

            // Apply to Prompt Button
            const applyButton = document.getElementById('inspectorApplyToPrompt');
            if (applyButton && context) {
                applyButton.addEventListener('click', () => {
                    applyOptimizedPrompt(node, context.edges, context.nodes, context.addLog, context.updateNodeDisplay);
                });
            }

        }
    };
}

// ============================================================================
// CONNECTION VALIDATION
// ============================================================================

/**
 * Validate GEPA optimize node connections
 */
function isValidGepaOptimizeConnection(sourceNode, sourcePin, targetNode, targetPin, edges) {
    // Allow Model.output → GepaOptimize.input
    if (sourceNode.type === 'model' && sourcePin === 'output' &&
        targetNode.type === 'gepa-optimize' && targetPin === 'input') {

        // Only allow one input connection
        if (edges) {
            for (const edge of edges.values()) {
                if (edge.targetNodeId === targetNode.id && edge.targetPin === 'input') {
                    return false;
                }
            }
        }

        return true;
    }

    return false;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find connected model node (Model.output → GepaOptimize.input)
 */
function findConnectedModelNode(gepaOptimizeNodeId, edges, nodes) {
    for (const edge of edges.values()) {
        if (edge.targetNodeId === gepaOptimizeNodeId && edge.targetPin === 'input') {
            const sourceNode = nodes.get(edge.sourceNodeId);
            if (sourceNode && sourceNode.type === 'model' && edge.sourcePin === 'output') {
                return sourceNode;
            }
        }
    }
    return null;
}

/**
 * Find prompt node connected to a model node (Prompt.prompt → Model.prompt)
 */
function findPromptNodeForModel(modelNodeId, edges, nodes) {
    for (const edge of edges.values()) {
        if (edge.targetNodeId === modelNodeId && edge.targetPin === 'prompt') {
            const sourceNode = nodes.get(edge.sourceNodeId);
            if (sourceNode && sourceNode.type === 'prompt') {
                return sourceNode;
            }
        }
    }
    return null;
}

/**
 * MLflow GEPA natively supported providers
 * Other providers may work via LiteLLM if installed (pip install litellm)
 */
const GEPA_NATIVE_PROVIDERS = ['openai', 'anthropic', 'bedrock', 'mistral', 'togetherai'];

/**
 * Validate GEPA optimize node and return error messages
 */
function validateGepaOptimizeNode(gepaOptimizeNode, edges, nodes) {
    const errors = [];
    const warnings = [];

    // Check training dataset
    if (!gepaOptimizeNode.data.trainDataset || gepaOptimizeNode.data.trainDataset.length === 0) {
        errors.push('Training dataset is required (at least 1 example)');
    } else {
        // Validate MLflow dataset format
        for (let i = 0; i < Math.min(gepaOptimizeNode.data.trainDataset.length, 5); i++) {
            const example = gepaOptimizeNode.data.trainDataset[i];
            if (!example.inputs) {
                errors.push(`Training dataset example ${i + 1} missing 'inputs' field`);
            }
            if (!example.expectations) {
                errors.push(`Training dataset example ${i + 1} missing 'expectations' field`);
            } else if (!example.expectations.expected_response) {
                errors.push(`Training dataset example ${i + 1} missing 'expectations.expected_response' field`);
            }
        }
    }

    // Check model node is connected
    const modelNode = findConnectedModelNode(gepaOptimizeNode.id, edges, nodes);
    if (!modelNode) {
        errors.push('No model node connected to GEPA optimize node');
    } else {
        // Warn if provider is not natively supported
        const provider = modelNode.data.provider || 'ollama';
        if (!GEPA_NATIVE_PROVIDERS.includes(provider)) {
            warnings.push(`'${provider}' not natively supported by MLflow GEPA (using LiteLLM fallback)`);
        }
    }

    // Return both errors and warnings
    return { errors, warnings };
}

/**
 * Check if GEPA optimize node is ready to run
 */
function isGepaOptimizeNodeReady(gepaOptimizeNode, edges, nodes) {
    const validation = validateGepaOptimizeNode(gepaOptimizeNode, edges, nodes);
    return validation.errors.length === 0;
}

/**
 * Apply optimized prompt to connected prompt node
 */
function applyOptimizedPrompt(gepaOptimizeNode, edges, nodes, addLog, updateNodeDisplay) {
    // Check if we have results
    if (!gepaOptimizeNode.data.optimizedPromptText || gepaOptimizeNode.data.finalScore === 0) {
        const msg = createTaggedMessage(gepaOptimizeNode.data.title, 'No optimization results to apply');
        addLog('error', msg, gepaOptimizeNode.id);
        return;
    }

    // Find connected model node, then find its prompt node
    const modelNode = findConnectedModelNode(gepaOptimizeNode.id, edges, nodes);
    if (!modelNode) {
        const msg = createTaggedMessage(gepaOptimizeNode.data.title, 'No model node connected');
        addLog('error', msg, gepaOptimizeNode.id);
        return;
    }

    const promptNode = findPromptNodeForModel(modelNode.id, edges, nodes);
    if (!promptNode) {
        const msg = createTaggedMessage(gepaOptimizeNode.data.title, 'No prompt node connected to model');
        addLog('error', msg, gepaOptimizeNode.id);
        return;
    }

    // Apply optimized prompt to system prompt
    const optimizedText = gepaOptimizeNode.data.optimizedPromptText;

    if (optimizedText) {
        promptNode.data.systemPrompt = optimizedText;
        updateNodeDisplay(promptNode.id);

        const improvement = ((gepaOptimizeNode.data.finalScore - gepaOptimizeNode.data.initialScore) * 100).toFixed(1);
        const msg = createTaggedMessage(gepaOptimizeNode.data.title, `Applied to prompt (+${improvement}% improvement)`);
        addLog('info', msg, gepaOptimizeNode.id);
    } else {
        const msg = createTaggedMessage(gepaOptimizeNode.data.title, 'No optimized prompt text found');
        addLog('warn', msg, gepaOptimizeNode.id);
    }
}

// ============================================================================
// EXECUTION
// ============================================================================

/**
 * Execute GEPA optimization node
 */
async function executeGepaOptimizeNode(
    gepaOptimizeNode,
    edges,
    nodes,
    updateNodeDisplay,
    setNodeStatus,
    addLog,
    signal
) {
    // Validate prerequisites
    const validation = validateGepaOptimizeNode(gepaOptimizeNode, edges, nodes);

    // Log warnings
    if (validation.warnings && validation.warnings.length > 0) {
        validation.warnings.forEach(warning => {
            const msg = createTaggedMessage(gepaOptimizeNode.data.title, warning);
            addLog('warn', msg, gepaOptimizeNode.id);
        });
    }

    // Check for errors
    if (validation.errors && validation.errors.length > 0) {
        validation.errors.forEach(error => {
            const msg = createTaggedMessage(gepaOptimizeNode.data.title, error);
            addLog('error', msg, gepaOptimizeNode.id);
        });
        setNodeStatus(gepaOptimizeNode.id, 'error');
        return;
    }

    // Find connected model node
    const modelNode = findConnectedModelNode(gepaOptimizeNode.id, edges, nodes);
    if (!modelNode) {
        const msg = createTaggedMessage(gepaOptimizeNode.data.title, 'No model node connected');
        addLog('error', msg, gepaOptimizeNode.id);
        setNodeStatus(gepaOptimizeNode.id, 'error');
        return;
    }

    // Set running status
    setNodeStatus(gepaOptimizeNode.id, 'running');
    gepaOptimizeNode.data.optimizationStatus = 'running';
    updateNodeDisplay(gepaOptimizeNode.id);

    const startMsg = createTaggedMessage(gepaOptimizeNode.data.title, 'Starting optimization');
    addLog('info', startMsg, gepaOptimizeNode.id);

    // Find connected prompt node to get system prompt
    const promptNode = findPromptNodeForModel(modelNode.id, edges, nodes);
    const systemPrompt = promptNode ? (promptNode.data.systemPrompt || '') : '';

    // Determine initial prompt template
    let initialPrompt = systemPrompt;
    if (!initialPrompt) {
        // Default template - try to infer input key from dataset
        const firstExample = gepaOptimizeNode.data.trainDataset[0];
        const inputKeys = Object.keys(firstExample?.inputs || {});
        const inputKey = inputKeys.length > 0 ? inputKeys[0] : 'question';
        initialPrompt = `Answer the following ${inputKey}: {{${inputKey}}}`;
    }

    try {
        // Build model string for MLflow format (provider:/model)
        const provider = modelNode.data.provider || 'ollama';
        const modelName = modelNode.data.model;
        const mlflowModelString = `${provider}:/${modelName}`;

        // Get API key from provider registry (global settings)
        const apiKey = await providerRegistry.getApiKey(provider) || '';

        // Transform train_dataset format from MLflow format to GEPA format
        // MLflow format: { inputs: {...}, expectations: { expected_response: '...' }}
        // GEPA format: { input: '...', expected_output: '...' }
        const gepaDataset = gepaOptimizeNode.data.trainDataset.map(ex => {
            // Extract input - could be nested object or string
            let inputValue = ex.inputs;
            if (typeof inputValue === 'object' && inputValue !== null) {
                // If inputs is an object, take first value or stringify
                const inputKeys = Object.keys(inputValue);
                inputValue = inputKeys.length > 0 ? inputValue[inputKeys[0]] : JSON.stringify(inputValue);
            }

            // Extract expected output
            let expectedOutput = ex.expectations?.expected_response || '';

            return {
                input: inputValue,
                expected_output: expectedOutput
            };
        });

        // Build configuration for GEPA worker (must match validateGepaConfig expectations)
        const config = {
            prompt_template: initialPrompt,
            dataset: gepaDataset,
            model_configs: [{
                provider: provider,
                model: modelName,
                api_key: apiKey
            }],
            input_key: 'question',  // Default input key
            gepa_config: {
                population_size: 10,
                num_generations: Math.ceil(gepaOptimizeNode.data.maxMetricCalls / 10),
                mutation_rate: 0.3,
                elite_size: 2
            },
            mlflow_config: {
                tracking_uri: null,  // Use default
                experiment_name: 'tokn-gepa'
            }
        };

        // Execute optimization with progress callback
        const result = await executeGepaOptimization(config, (message, data) => {
            // Detect log level from message content
            let level = 'info';
            if (message.toLowerCase().startsWith('warning:') || message.toLowerCase().includes('warning:')) {
                level = 'warn';
            } else if (message.toLowerCase().startsWith('error:') || message.toLowerCase().includes('error:')) {
                level = 'error';
            }

            // Use centralized logging function to ensure single tag
            const taggedMessage = createTaggedMessage(gepaOptimizeNode.data.title, message);
            addLog(level, taggedMessage, gepaOptimizeNode.id);
        }, signal);

        // Update node with results
        // Extract scores from metrics if available
        const initialScore = result.metrics?.initial_score || 0;
        const finalScore = result.metrics?.final_score || result.metrics?.best_score || 0;

        gepaOptimizeNode.data.initialScore = initialScore;
        gepaOptimizeNode.data.finalScore = finalScore;
        gepaOptimizeNode.data.optimizedPromptText = result.optimized_prompt || '';
        gepaOptimizeNode.data.optimizationIterations = result.metrics?.iterations || 0;
        gepaOptimizeNode.data.optimizationStatus = 'success';

        setNodeStatus(gepaOptimizeNode.id, 'success');
        updateNodeDisplay(gepaOptimizeNode.id);

        const improvement = finalScore > 0 && initialScore > 0
            ? ((finalScore - initialScore) * 100).toFixed(1)
            : 'N/A';
        const scoreDisplay = finalScore > 0 ? `${(finalScore * 100).toFixed(1)}%` : 'complete';
        const completionMsg = createTaggedMessage(gepaOptimizeNode.data.title, `Optimization complete (${scoreDisplay}, ${improvement > 0 ? '+' : ''}${improvement}%)`);
        addLog('info', completionMsg, gepaOptimizeNode.id);

    } catch (error) {
        gepaOptimizeNode.data.optimizationStatus = 'error';
        setNodeStatus(gepaOptimizeNode.id, 'error');
        updateNodeDisplay(gepaOptimizeNode.id);

        let errorMsg = error.message;

        // Provide helpful error messages
        if (errorMsg.includes('ECONNREFUSED')) {
            errorMsg += ' - Make sure the model server is running';
        } else if (errorMsg.includes('MLflow library not found')) {
            errorMsg += ' - Install with: pip install mlflow>=3.5.0';
        } else if (errorMsg.includes('Python not found')) {
            errorMsg += ' - Install Python 3.8+ and add to PATH';
        } else if (errorMsg.includes('API key')) {
            errorMsg += ' - Check your API key configuration';
        }

        const taggedError = createTaggedMessage(gepaOptimizeNode.data.title, errorMsg);
        addLog('error', taggedError, gepaOptimizeNode.id);
    }
}

export {
    createGepaOptimizeNodeData,
    renderGepaOptimizeNode,
    renderGepaOptimizeInspector,
    isValidGepaOptimizeConnection,
    isGepaOptimizeNodeReady,
    validateGepaOptimizeNode,
    executeGepaOptimizeNode
};
