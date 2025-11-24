/**
 * GEPA Backend API Bridge
 * Makes API calls to backend server for GEPA optimization
 * Replaces Python subprocess with HTTP API calls
 */

// Backend API configuration (shared with dspy-worker)
let backendApiUrl = window.location.origin + '/api';

/**
 * Configure backend API URL
 * @param {string} url - Backend API base URL
 */
function configureBackendUrl(url) {
    backendApiUrl = url;
}

/**
 * Execute GEPA optimization via backend API
 * @param {Object} config - Configuration object for GEPA optimization
 * @param {Function} onProgress - Callback for progress updates (message, data)
 * @param {AbortSignal} signal - Optional abort signal for cancellation
 * @returns {Promise<Object>} - Optimization results
 */
async function executeGepaOptimization(config, onProgress, signal = null) {
    try {
        // Validate config
        const validation = validateGepaConfig(config);
        if (!validation.valid) {
            throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
        }

        // Transform config to API format
        const apiRequest = {
            prompt: config.prompt_template,
            examples: config.dataset.map(ex => ({
                input: ex.input,
                expected_output: ex.expected_output
            })),
            config: {
                inputKey: config.input_key || 'question',
                populationSize: config.gepa_config?.population_size || 10,
                numGenerations: config.gepa_config?.num_generations || 5,
                mutationRate: config.gepa_config?.mutation_rate || 0.3,
                eliteSize: config.gepa_config?.elite_size || 2
            },
            providers: config.model_configs.map(mc => ({
                provider: mc.provider,
                model: mc.model,
                apiKey: mc.api_key,
                apiBase: mc.api_base
            })),
            mlflowConfig: {
                trackingUri: config.mlflow_config?.tracking_uri,
                experimentName: config.mlflow_config?.experiment_name
            }
        };

        // Notify start
        if (onProgress) {
            onProgress('Connecting to backend API...', null);
        }

        // Make API request
        const controller = new AbortController();

        // Link abort signal if provided
        if (signal) {
            signal.addEventListener('abort', () => {
                controller.abort();
            });
        }

        const response = await fetch(`${backendApiUrl}/optimize/gepa`, {
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

        // Notify completion
        if (onProgress) {
            onProgress('GEPA optimization complete!', null);
            if (result.trackingUrl) {
                onProgress(`View results: ${result.trackingUrl}`, null);
            }
        }

        // Return result in expected format
        return {
            type: 'success',
            optimized_prompt: result.optimizedPrompt,
            mlflow_run_id: result.mlflowRunId,
            metrics: result.metrics || {},
            tracking_url: result.trackingUrl,
            message: 'GEPA optimization completed successfully'
        };

    } catch (error) {
        // Handle abort
        if (error.name === 'AbortError') {
            throw new Error('GEPA optimization cancelled by user');
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
 * Check if backend API is available and GEPA is supported
 * @returns {Promise<Object>} - Status object with availability info
 */
async function checkGepaEnvironment() {
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
                gepa_installed: false,
                mlflow_installed: false,
                python_version: null,
                mlflow_version: null,
                backend_available: false,
                error: `Backend API not available (HTTP ${response.status})`
            };
        }

        const health = await response.json();

        return {
            python_available: true, // Backend has Python
            gepa_installed: health.features?.gepa || false,
            mlflow_installed: health.features?.mlflow || false,
            python_version: 'Backend Python',
            mlflow_version: health.version || 'Unknown',
            backend_available: health.status === 'ok',
            backend_url: backendApiUrl,
            error: health.features?.gepa ? null : 'GEPA not available on backend'
        };

    } catch (error) {
        return {
            python_available: false,
            gepa_installed: false,
            mlflow_installed: false,
            python_version: null,
            mlflow_version: null,
            backend_available: false,
            backend_url: backendApiUrl,
            error: `Cannot connect to backend API at ${backendApiUrl}. Error: ${error.message}`
        };
    }
}

/**
 * Install GEPA - Not applicable for web version
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} - Installation result
 */
async function installGepa(onProgress) {
    onProgress('GEPA/MLflow installation must be done on the backend server.');
    onProgress('Please contact your system administrator or refer to the backend setup documentation.');

    return Promise.reject(new Error(
        'GEPA/MLflow installation is not available in web version. ' +
        'Please install dependencies on the backend server. ' +
        'See docs/BACKEND_API.md for instructions.'
    ));
}

/**
 * Validate GEPA configuration object
 * @param {Object} config - Configuration to validate
 * @returns {Object} - Validation result { valid: boolean, errors: string[] }
 */
function validateGepaConfig(config) {
    const errors = [];

    // Check required fields
    if (!config.prompt_template) {
        errors.push('prompt_template is required');
    }

    if (!config.dataset || !Array.isArray(config.dataset)) {
        errors.push('dataset must be an array');
    } else if (config.dataset.length === 0) {
        errors.push('dataset must contain at least one example');
    }

    if (!config.model_configs || !Array.isArray(config.model_configs)) {
        errors.push('model_configs must be an array');
    } else if (config.model_configs.length === 0) {
        errors.push('model_configs must contain at least one model');
    }

    // Validate model configs
    if (config.model_configs && Array.isArray(config.model_configs)) {
        config.model_configs.forEach((mc, i) => {
            if (!mc.provider) {
                errors.push(`model_configs[${i}].provider is required`);
            }
            if (!mc.model) {
                errors.push(`model_configs[${i}].model is required`);
            }
            if (!mc.api_key) {
                errors.push(`model_configs[${i}].api_key is required`);
            }
        });
    }

    // Validate dataset structure
    if (config.dataset && Array.isArray(config.dataset)) {
        for (let i = 0; i < Math.min(config.dataset.length, 5); i++) {
            const example = config.dataset[i];
            if (!example.input) {
                errors.push(`dataset[${i}].input is required`);
            }
            if (!example.expected_output) {
                errors.push(`dataset[${i}].expected_output is required`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

export {
    executeGepaOptimization,
    checkGepaEnvironment,
    installGepa,
    validateGepaConfig,
    configureBackendUrl
};
