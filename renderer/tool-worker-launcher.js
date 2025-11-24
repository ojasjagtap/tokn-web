/**
 * Tool Worker Launcher - Web Worker Version
 * Manages Web Worker lifecycle for tool execution
 * Replaces Node.js child_process with browser Web Workers
 */

/**
 * Execute a tool in a Web Worker
 *
 * @param {Object} options
 * @param {string} options.code - Tool implementation code
 * @param {Object} options.args - Tool arguments
 * @param {Function} options.addLog - Logging function
 * @param {AbortSignal} options.signal - Abort signal for cancellation
 * @returns {Promise<Object>} Normalized result
 */
async function executeToolInWorker({ code, args, addLog, signal }) {
    const timeoutMs = 30000; // 30 seconds
    const maxOutputBytes = 5_000_000; // 5MB

    return new Promise((resolve, reject) => {
        let worker = null;
        let timeoutHandle = null;
        let isKilled = false;

        try {
            // Create Web Worker
            // Note: In Vite, worker path should be relative to public or use ?worker import
            worker = new Worker(new URL('../src/workers/toolWorker.js', import.meta.url), {
                type: 'module'
            });

            // Set up timeout
            timeoutHandle = setTimeout(() => {
                if (!isKilled && worker) {
                    isKilled = true;
                    worker.terminate();
                    addLog('error', 'Tool execution timeout (30s limit)');
                    reject(new Error('Tool execution timeout'));
                }
            }, timeoutMs);

            // Handle abort signal
            if (signal) {
                signal.addEventListener('abort', () => {
                    if (!isKilled && worker) {
                        isKilled = true;
                        worker.terminate();
                        addLog('warn', 'Tool execution canceled');
                        reject(new Error('Tool execution canceled'));
                    }
                });
            }

            // Handle worker messages
            worker.onmessage = (event) => {
                clearTimeout(timeoutHandle);

                if (isKilled) {
                    return; // Already handled
                }

                const response = event.data;

                if (response.success) {
                    // Check output size
                    const resultStr = typeof response.result === 'string'
                        ? response.result
                        : JSON.stringify(response.result);

                    if (resultStr.length > maxOutputBytes) {
                        addLog('warn', 'Tool output truncated to 5MB');

                        if (typeof response.result === 'string') {
                            response.result = response.result.substring(0, maxOutputBytes);
                        }
                    }

                    // Return normalized result
                    resolve({
                        ok: true,
                        result: response.result,
                        kind: detectResultKind(response.result)
                    });
                } else {
                    // Error result
                    resolve({
                        ok: false,
                        error: {
                            code: 'TOOL_ERROR',
                            message: response.error || 'Tool execution failed'
                        }
                    });
                }

                // Clean up worker
                if (worker) {
                    worker.terminate();
                    worker = null;
                }
            };

            // Handle worker errors
            worker.onerror = (error) => {
                clearTimeout(timeoutHandle);

                if (!isKilled) {
                    const errorResult = {
                        ok: false,
                        error: {
                            code: 'WORKER_ERROR',
                            message: error.message || 'Worker execution failed'
                        }
                    };
                    resolve(errorResult);
                }

                if (worker) {
                    worker.terminate();
                    worker = null;
                }
            };

            // Send tool code and arguments to worker
            worker.postMessage({
                toolCode: code,
                toolArgs: args,
                timeout: timeoutMs
            });

        } catch (error) {
            clearTimeout(timeoutHandle);

            if (worker) {
                worker.terminate();
            }

            resolve({
                ok: false,
                error: {
                    code: 'LAUNCH_ERROR',
                    message: `Failed to launch worker: ${error.message}`
                }
            });
        }
    });
}

/**
 * Detect result kind (text, json, bytes)
 */
function detectResultKind(result) {
    if (typeof result === 'string') {
        return 'text';
    } else if (result instanceof ArrayBuffer || result instanceof Uint8Array) {
        return 'bytes';
    } else {
        return 'json';
    }
}

module.exports = {
    executeToolInWorker
};
