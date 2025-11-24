/**
 * Tool Worker - Web Worker for sandboxed tool execution
 * Replaces Node.js child process with browser Web Worker
 *
 * IMPORTANT SECURITY RESTRICTIONS:
 * - No require() or Node.js modules
 * - No file system access
 * - No child_process
 * - Pure JavaScript only
 * - Timeout enforced
 */

// Worker message handler
self.onmessage = function(event) {
    const { toolCode, toolArgs, timeout = 30000 } = event.data;

    // Setup timeout
    const timeoutId = setTimeout(() => {
        self.postMessage({
            success: false,
            error: 'Tool execution timed out (30s limit)'
        });
        self.close(); // Terminate worker
    }, timeout);

    try {
        // Create isolated execution context
        const toolFunction = createToolFunction(toolCode);

        // Execute tool with arguments
        const result = toolFunction(toolArgs);

        // Handle both sync and async results
        Promise.resolve(result).then(output => {
            clearTimeout(timeoutId);

            // Validate output size (5MB limit)
            const outputString = typeof output === 'string' ? output : JSON.stringify(output);
            if (outputString.length > 5 * 1024 * 1024) {
                self.postMessage({
                    success: false,
                    error: 'Tool output exceeds 5MB limit'
                });
            } else {
                self.postMessage({
                    success: true,
                    result: output
                });
            }

            self.close(); // Clean termination
        }).catch(error => {
            clearTimeout(timeoutId);
            self.postMessage({
                success: false,
                error: error.message || String(error)
            });
            self.close();
        });
    } catch (error) {
        clearTimeout(timeoutId);
        self.postMessage({
            success: false,
            error: error.message || String(error)
        });
        self.close();
    }
};

/**
 * Create tool function from user code
 * Wraps user code in isolated function scope
 */
function createToolFunction(toolCode) {
    // Parse tool code to extract function
    // Expected format: function toolName(args) { ... }

    // Remove any require() or import statements (security)
    const sanitizedCode = toolCode
        .replace(/require\s*\([^)]*\)/g, '(() => { throw new Error("require() is not available in web environment"); })()')
        .replace(/import\s+.*?from\s+['"'].*?['"']/g, 'throw new Error("import is not available in web environment");');

    // Create function in isolated scope
    // Use Function constructor to eval the code safely
    const wrappedCode = `
        'use strict';
        ${sanitizedCode}

        // Find the tool function (first function in code)
        const funcMatch = (${JSON.stringify(sanitizedCode)}).match(/function\\s+(\\w+)/);
        if (!funcMatch) {
            throw new Error('No function found in tool code');
        }
        const funcName = funcMatch[1];

        // Return the function
        if (typeof this[funcName] === 'function') {
            return this[funcName];
        } else if (typeof self[funcName] === 'function') {
            return self[funcName];
        } else {
            throw new Error('Tool function not found: ' + funcName);
        }
    `;

    try {
        // Execute in function scope
        const getToolFunc = new Function(wrappedCode);
        const toolFunc = getToolFunc.call({});

        if (typeof toolFunc !== 'function') {
            throw new Error('Tool code must export a function');
        }

        return toolFunc;
    } catch (error) {
        throw new Error(`Failed to create tool function: ${error.message}`);
    }
}

/**
 * Error handler for uncaught errors
 */
self.onerror = function(error) {
    self.postMessage({
        success: false,
        error: error.message || 'Unknown worker error'
    });
    self.close();
};
