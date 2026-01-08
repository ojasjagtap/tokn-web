/**
 * DSPy Backend API Bridge
 * Makes API calls to backend server for DSPy optimization
 * Replaces Python subprocess with HTTP API calls
 */

// Backend API configuration
// Check for backend URL in window (set by main app) or default to same origin
const getDefaultBackendUrl = () => {
    // Check if backend URL is set globally by the app
    if (window.__TOKN_BACKEND_URL) {
        return `${window.__TOKN_BACKEND_URL}/api`;
    }
    // Default to same origin (works with Vite proxy in dev)
    return `${window.location.origin}/api`;
};
let backendApiUrl = getDefaultBackendUrl();

/**
 * Configure backend API URL
 * @param {string} url - Backend API base URL
 */
function configureBackendUrl(url) {
    backendApiUrl = url;
}

/**
 * Execute DSPy optimization via backend API
 * @param {Object} config - Configuration object for DSPy optimization
 * @param {Function} onProgress - Callback for progress updates (message, data)
 * @param {AbortSignal} signal - Optional abort signal for cancellation
 * @returns {Promise<Object>} - Optimization results
 */
async function executeDSPyOptimization(config, onProgress, signal = null) {
    try {
        // Validate config
        const validation = validateDSPyConfig(config);
        if (!validation.valid) {
            throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
        }

        // Transform config to API format
        const apiRequest = {
            prompt: config.train_dataset[0]?.input || 'Answer the question.',
            examples: config.train_dataset.map(ex => ({
                input: ex.input,
                expected_output: ex.output
            })),
            model: config.model_config.model,
            provider: config.model_config.provider,
            apiKey: config.model_config.api_key,
            apiBase: config.model_config.api_base,
            config: {
                metric: config.metric_config.type,
                maxBootstrappedDemos: config.optimizer_config.max_bootstrapped_demos,
                maxLabeledDemos: config.optimizer_config.max_labeled_demos,
                temperature: config.optimizer_config.temperature,
                teacherSettings: config.optimizer_config.teacher_settings
            }
        };

        // Notify start
        // if (onProgress) {
        //     onProgress('Connecting to backend API...', null);
        // }

        // Make API request
        const controller = new AbortController();

        // Link abort signal if provided
        if (signal) {
            signal.addEventListener('abort', () => {
                controller.abort();
            });
        }

        const response = await fetch(`${backendApiUrl}/optimize/dspy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(apiRequest),
            signal: controller.signal
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || `API request failed: ${response.status}`);
        }

        // Parse response
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Optimization failed');
        }

        // Report progress logs if available
        if (result.logs && Array.isArray(result.logs) && onProgress) {
            result.logs.forEach(log => {
                onProgress(log, null);
            });
        }

        // Notify completion
        if (onProgress) {
            onProgress('Optimization complete!', null);
        }

        // Return result in expected format (matching dspy_optimizer.py output)
        return {
            type: 'success',
            optimized_prompt: result.optimizedPrompt,
            validation_score: result.validation_score || 0.0,
            optimized_signature: result.optimized_signature || {},
            optimized_demos: result.optimized_demos || [],
            predictors: result.predictors || [],
            compiled_program_path: result.compiled_program_path || '',
            dataset_sizes: result.dataset_sizes || { train: 0, val: 0 },
            metrics: result.metrics || {},
            message: 'DSPy optimization completed successfully'
        };

    } catch (error) {
        // Handle abort
        if (error.name === 'AbortError') {
            throw new Error('DSPy optimization cancelled by user');
        }

        // Handle network errors
        if (error.message.includes('fetch')) {
            throw new Error(
                `Failed to connect to backend API at ${backendApiUrl}. ` +
                `Make sure the backend server is running. ` +
                `Original error: ${error.message}`
            );
        }

        // Re-throw other errors
        throw error;
    }
}

/**
 * Check if backend API is available and DSPy is supported
 * @returns {Promise<Object>} - Status object with availability info
 */
async function checkDSPyEnvironment() {
    try {
        const response = await fetch(`${backendApiUrl}/health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            return {
                python_available: false,
                dspy_installed: false,
                python_version: null,
                dspy_version: null,
                backend_available: false,
                error: `Backend API not available (HTTP ${response.status})`
            };
        }

        const health = await response.json();

        return {
            python_available: true, // Backend has Python
            dspy_installed: health.features?.dspy || false,
            python_version: 'Backend Python',
            dspy_version: health.version || 'Unknown',
            backend_available: health.status === 'ok',
            backend_url: backendApiUrl,
            error: health.features?.dspy ? null : 'DSPy not available on backend'
        };

    } catch (error) {
        return {
            python_available: false,
            dspy_installed: false,
            python_version: null,
            dspy_version: null,
            backend_available: false,
            backend_url: backendApiUrl,
            error: `Cannot connect to backend API at ${backendApiUrl}. Error: ${error.message}`
        };
    }
}

/**
 * Install DSPy - Not applicable for web version
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} - Installation result
 */
async function installDSPy(onProgress) {
    onProgress('DSPy installation must be done on the backend server.');
    onProgress('Please contact your system administrator or refer to the backend setup documentation.');

    return Promise.reject(new Error(
        'DSPy installation is not available in web version. ' +
        'Please install DSPy on the backend server. ' +
        'See docs/BACKEND_API.md for instructions.'
    ));
}

/**
 * Validate DSPy configuration object
 * @param {Object} config - Configuration to validate
 * @returns {Object} - Validation result { valid: boolean, errors: string[] }
 */
function validateDSPyConfig(config) {
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
        if (!config.model_config.api_key) {
            errors.push('model_config.api_key is required');
        }
    }

    if (!config.optimizer) {
        errors.push('optimizer is required');
    } else if (!['MIPRO', 'MIPROv2'].includes(config.optimizer)) {
        errors.push('optimizer must be one of: MIPRO, MIPROv2');
    }

    if (!config.optimizer_config) {
        errors.push('optimizer_config is required');
    }

    if (!config.metric_config) {
        errors.push('metric_config is required');
    } else {
        if (!config.metric_config.type) {
            errors.push('metric_config.type is required');
        }
    }

    if (!config.train_dataset || !Array.isArray(config.train_dataset)) {
        errors.push('train_dataset must be an array');
    } else if (config.train_dataset.length === 0) {
        errors.push('train_dataset must contain at least one example');
    }

    // Validate dataset structure
    if (config.train_dataset && Array.isArray(config.train_dataset)) {
        for (let i = 0; i < Math.min(config.train_dataset.length, 5); i++) {
            const example = config.train_dataset[i];
            if (!example.input) {
                errors.push(`train_dataset[${i}].input is required`);
            }
            if (!example.output) {
                errors.push(`train_dataset[${i}].output is required`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

export {
    executeDSPyOptimization,
    checkDSPyEnvironment,
    installDSPy,
    validateDSPyConfig,
    configureBackendUrl
};
