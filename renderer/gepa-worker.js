/**
 * GEPA (MLflow) Python Bridge Worker
 * Manages Python subprocess for GEPA prompt optimization
 * Handles bidirectional communication between Node.js and Python
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Execute GEPA optimization in Python subprocess
 * @param {Object} config - Configuration object for GEPA optimization
 * @param {Function} onProgress - Callback for progress updates (message, data)
 * @param {AbortSignal} signal - Optional abort signal for cancellation
 * @returns {Promise<Object>} - Optimization results
 */
async function executeGepaOptimization(config, onProgress, signal = null) {
    return new Promise((resolve, reject) => {
        // Path to Python script
        const scriptPath = path.join(__dirname, 'gepa', 'gepa_optimizer.py');

        // Verify Python script exists
        if (!fs.existsSync(scriptPath)) {
            reject(new Error(`GEPA optimizer script not found at: ${scriptPath}`));
            return;
        }

        // Determine Python command
        // Use Python 3.11 on Windows where MLflow should be installed, otherwise try python3
        const pythonCmd = process.platform === 'win32'
            ? 'C:\\Users\\ojasj\\AppData\\Local\\Programs\\Python\\Python311\\python.exe'
            : 'python3';

        // Spawn Python process
        let pythonProcess;
        try {
            pythonProcess = spawn(pythonCmd, [scriptPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env }
            });
        } catch (spawnError) {
            reject(new Error(`Failed to spawn Python process: ${spawnError.message}`));
            return;
        }

        let outputBuffer = '';
        let errorBuffer = '';
        let hasResolved = false;

        // Handle abort signal
        if (signal) {
            signal.addEventListener('abort', () => {
                if (!hasResolved && pythonProcess && !pythonProcess.killed) {
                    pythonProcess.kill('SIGTERM');
                    hasResolved = true;
                    reject(new Error('GEPA optimization cancelled by user'));
                }
            });
        }

        // Send configuration to Python via stdin
        try {
            const configJson = JSON.stringify(config);
            pythonProcess.stdin.write(configJson);
            pythonProcess.stdin.end();
        } catch (writeError) {
            pythonProcess.kill();
            reject(new Error(`Failed to send config to Python: ${writeError.message}`));
            return;
        }

        // Handle stdout (progress and results)
        pythonProcess.stdout.on('data', (data) => {
            const text = data.toString();
            outputBuffer += text;

            // Process complete JSON messages (line by line)
            const lines = text.split('\n');

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                try {
                    const message = JSON.parse(trimmed);

                    if (message.type === 'progress') {
                        // Progress update from Python
                        if (onProgress && typeof onProgress === 'function') {
                            onProgress(message.message, message.data || null);
                        }
                    } else if (message.type === 'success') {
                        // Optimization completed successfully
                        if (!hasResolved) {
                            hasResolved = true;
                            resolve(message);
                        }
                    } else if (message.type === 'error') {
                        // Error from Python
                        if (!hasResolved) {
                            hasResolved = true;
                            reject(new Error(message.message + (message.traceback ? '\n' + message.traceback : '')));
                        }
                    }
                } catch (parseError) {
                    // Not JSON, might be raw output or partial message
                    // Silently continue, don't spam errors
                }
            }
        });

        // Handle stderr
        pythonProcess.stderr.on('data', (data) => {
            errorBuffer += data.toString();
            // Optionally log stderr for debugging
            // console.error('[GEPA Python stderr]:', data.toString());
        });

        // Handle process exit
        pythonProcess.on('close', (code) => {
            if (!hasResolved) {
                if (code !== 0) {
                    hasResolved = true;

                    // Try to parse error from output buffer first
                    const lines = outputBuffer.split('\n');
                    for (const line of lines) {
                        try {
                            const msg = JSON.parse(line.trim());
                            if (msg.type === 'error') {
                                reject(new Error(msg.message + (msg.traceback ? '\n' + msg.traceback : '')));
                                return;
                            }
                        } catch {}
                    }

                    // Fallback to generic error
                    reject(new Error(
                        `Python process exited with code ${code}\n` +
                        `stderr: ${errorBuffer}\n` +
                        `stdout: ${outputBuffer}`
                    ));
                } else {
                    // Process exited successfully but no success message received
                    // This shouldn't happen in normal operation
                    hasResolved = true;
                    reject(new Error('Python process completed but no result received'));
                }
            }
        });

        // Handle process errors (e.g., Python not found)
        pythonProcess.on('error', (error) => {
            if (!hasResolved) {
                hasResolved = true;
                reject(new Error(
                    `Failed to start Python process: ${error.message}\n` +
                    `Make sure Python 3 is installed and accessible via '${pythonCmd}' command.`
                ));
            }
        });
    });
}

/**
 * Check if Python is available and MLflow is installed
 * @returns {Promise<Object>} - Status object with python_available, mlflow_installed, version info
 */
async function checkGepaEnvironment() {
    return new Promise((resolve) => {
        const pythonCmd = process.platform === 'win32'
            ? 'C:\\Users\\ojasj\\AppData\\Local\\Programs\\Python\\Python311\\python.exe'
            : 'python3';

        // Check if Python is available
        const pythonCheck = spawn(pythonCmd, ['--version'], { stdio: 'pipe' });

        let pythonVersion = '';
        let pythonAvailable = false;

        pythonCheck.stdout.on('data', (data) => {
            pythonVersion = data.toString().trim();
            pythonAvailable = true;
        });

        pythonCheck.stderr.on('data', (data) => {
            // Python --version sometimes outputs to stderr
            pythonVersion = data.toString().trim();
            pythonAvailable = true;
        });

        pythonCheck.on('close', (code) => {
            if (!pythonAvailable || code !== 0) {
                resolve({
                    python_available: false,
                    mlflow_installed: false,
                    python_version: null,
                    mlflow_version: null,
                    error: 'Python not found. Please install Python 3.8 or higher.'
                });
                return;
            }

            // Check if MLflow is installed
            const mlflowCheck = spawn(pythonCmd, ['-c', 'import mlflow; print(mlflow.__version__)'], { stdio: 'pipe' });

            let mlflowVersion = '';
            let mlflowInstalled = false;

            mlflowCheck.stdout.on('data', (data) => {
                mlflowVersion = data.toString().trim();
                mlflowInstalled = true;
            });

            mlflowCheck.on('close', (code) => {
                resolve({
                    python_available: true,
                    mlflow_installed: mlflowInstalled && code === 0,
                    python_version: pythonVersion,
                    mlflow_version: mlflowVersion || null,
                    error: mlflowInstalled ? null : 'MLflow not installed. Run: pip install mlflow>=3.5.0'
                });
            });
        });

        pythonCheck.on('error', () => {
            resolve({
                python_available: false,
                mlflow_installed: false,
                python_version: null,
                mlflow_version: null,
                error: `Python command '${pythonCmd}' not found. Please install Python 3.8 or higher.`
            });
        });
    });
}

/**
 * Install MLflow and dependencies via pip
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} - Installation result
 */
async function installMLflow(onProgress) {
    return new Promise((resolve, reject) => {
        const pythonCmd = process.platform === 'win32'
            ? 'C:\\Users\\ojasj\\AppData\\Local\\Programs\\Python\\Python311\\python.exe'
            : 'python3';

        onProgress('Installing MLflow... This may take a few minutes.');

        // Get the requirements file path
        const reqsPath = path.join(__dirname, 'gepa', 'requirements.txt');

        // Use requirements file if it exists, otherwise install MLflow directly
        const installArgs = fs.existsSync(reqsPath)
            ? ['-m', 'pip', 'install', '-r', reqsPath]
            : ['-m', 'pip', 'install', 'mlflow>=3.5.0', 'openai', 'anthropic', 'google-generativeai'];

        const installProcess = spawn(pythonCmd, installArgs, {
            stdio: 'pipe'
        });

        let output = '';

        installProcess.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            // Report progress
            if (text.includes('Collecting') || text.includes('Installing') || text.includes('Successfully installed')) {
                onProgress(text.trim());
            }
        });

        installProcess.stderr.on('data', (data) => {
            output += data.toString();
        });

        installProcess.on('close', (code) => {
            if (code === 0) {
                onProgress('MLflow installed successfully!');
                resolve({ success: true, output });
            } else {
                reject(new Error(`MLflow installation failed with code ${code}\n${output}`));
            }
        });

        installProcess.on('error', (error) => {
            reject(new Error(`Failed to run pip: ${error.message}`));
        });
    });
}

/**
 * Validate GEPA configuration object
 * @param {Object} config - Configuration to validate
 * @returns {Object} - Validation result { valid: boolean, errors: string[] }
 */
function validateGepaConfig(config) {
    const errors = [];

    // Check required top-level fields
    if (!config.model_config) {
        errors.push('model_config is required');
    } else {
        if (!config.model_config.provider) {
            errors.push('model_config.provider is required');
        }
        if (!config.model_config.model) {
            errors.push('model_config.model is required');
        }
    }

    if (!config.reflection_model) {
        errors.push('reflection_model is required (e.g., "openai/gpt-4")');
    }

    if (!config.scorer_config) {
        errors.push('scorer_config is required');
    } else {
        const scorers = config.scorer_config.scorers || [];
        if (scorers.length === 0) {
            errors.push('At least one scorer is required');
        }

        // Validate scorer structure
        for (let i = 0; i < scorers.length; i++) {
            const scorer = scorers[i];
            if (!scorer.type) {
                errors.push(`scorer_config.scorers[${i}].type is required`);
            }
        }
    }

    if (!config.train_dataset || !Array.isArray(config.train_dataset)) {
        errors.push('train_dataset must be an array');
    } else if (config.train_dataset.length === 0) {
        errors.push('train_dataset must contain at least one example');
    }

    // Validate dataset structure (MLflow format)
    if (config.train_dataset && Array.isArray(config.train_dataset)) {
        for (let i = 0; i < Math.min(config.train_dataset.length, 5); i++) {
            const example = config.train_dataset[i];
            if (!example.inputs) {
                errors.push(`train_dataset[${i}].inputs is required`);
            }
            if (!example.expectations) {
                errors.push(`train_dataset[${i}].expectations is required`);
            } else if (!example.expectations.expected_response) {
                errors.push(`train_dataset[${i}].expectations.expected_response is required`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    executeGepaOptimization,
    checkGepaEnvironment,
    installMLflow,
    validateGepaConfig
};
