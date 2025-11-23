/**
 * GEPA Optimize Node Helper
 * Handles GEPA optimization node creation, rendering, validation, and execution
 * Uses MLflow GEPA library via Python bridge for prompt optimization
 */

const { executeGepaOptimization, checkGepaEnvironment, validateGepaConfig } = require('./gepa-worker');
const path = require('path');
const os = require('os');

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
        reflectionModel: 'openai/gpt-4',  // Model for reflection/evolution
        maxMetricCalls: 300,              // Optimization budget (iterations)

        // Scorer Configuration
        scorerType: 'correctness',        // 'correctness' | 'safety'
        scorerModel: 'openai/gpt-4-mini', // Model for scoring
        useMultipleScorers: false,
        scorers: [
            { type: 'correctness', model: 'openai/gpt-4-mini', weight: 1.0 }
        ],

        // Dataset Management
        trainDataset: [],                 // Array of {inputs: {...}, expectations: {expected_response: '...'}}
        datasetMode: 'manual',            // 'manual' | 'csv' (future)

        // Results
        optimizationStatus: 'idle',       // 'idle' | 'running' | 'success' | 'error'
        initialScore: 0,
        finalScore: 0,
        optimizedPromptText: '',
        optimizationIterations: 0,
        optimizationLog: [],              // Progress messages

        // MLflow Integration (optional)
        mlflowTrackingUri: '',
        experimentName: ''
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
                ${improvement !== null ? `<div style="font-size: 10px; color: #4a9eff; margin-top: 2px;">+${improvement}% improvement</div>` : ''}
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

        <!-- Reflection Model -->
        <div class="inspector-section">
            <label>Reflection Model</label>
            <input type="text" id="inspectorReflectionModel" class="inspector-input"
                   value="${node.data.reflectionModel}"
                   placeholder="openai/gpt-4">
            <div style="font-size: 10px; color: #888; margin-top: 4px;">
                LLM used for prompt evolution (e.g., openai/gpt-4, anthropic/claude-3-sonnet)
            </div>
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
            <div style="font-size: 10px; color: #888; margin-top: 4px;">
                Higher = better results, but slower and more expensive
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

        <div class="inspector-section">
            <label>Scorer Model</label>
            <input type="text" id="inspectorScorerModel" class="inspector-input"
                   value="${node.data.scorerModel}"
                   placeholder="openai/gpt-4-mini">
            <div style="font-size: 10px; color: #888; margin-top: 4px;">
                Model used to evaluate prompt quality
            </div>
        </div>

        <!-- Training Dataset -->
        <div class="inspector-section">
            <label>Training Dataset (JSON)</label>
            <textarea id="inspectorTrainDataset" class="inspector-textarea code-editor" rows="10"
                      placeholder='[&#10;  {&#10;    "inputs": {"question": "What is 2+2?"},&#10;    "expectations": {"expected_response": "4"}&#10;  }&#10;]'>${JSON.stringify(node.data.trainDataset, null, 2)}</textarea>
            <div style="font-size: 10px; color: #888; margin-top: 4px;">
                ${node.data.trainDataset.length} examples (MLflow format: inputs + expectations)
            </div>
        </div>

        <!-- MLflow Settings (Optional) -->
        <div class="inspector-section">
            <div style="cursor: pointer; font-weight: bold; margin-bottom: 8px; display: flex; align-items: center;" id="mlflowToggle">
                <svg class="details-toggle" width="12" height="12" style="margin-right: 6px;">
                    <use href="#icon-chevron-right"></use>
                </svg>
                MLflow Settings (Optional)
            </div>
            <div id="mlflowContent" style="display: none;">
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 12px;">Tracking URI</label>
                    <input type="text" id="inspectorMlflowUri" class="inspector-input"
                           value="${node.data.mlflowTrackingUri}"
                           placeholder="http://localhost:5000"
                           style="margin-top: 4px;">
                </div>
                <div>
                    <label style="font-size: 12px;">Experiment Name</label>
                    <input type="text" id="inspectorExperimentName" class="inspector-input"
                           value="${node.data.experimentName}"
                           placeholder="prompt_optimization"
                           style="margin-top: 4px;">
                </div>
            </div>
        </div>

        <!-- Results Display -->
        ${node.data.finalScore > 0 ? `
            <div class="inspector-section">
                <label>Optimization Results</label>
                <div style="background: #1a1a1a; padding: 12px; border-radius: 4px; font-size: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <div>
                            <strong>Initial Score:</strong>
                            <span style="color: #888;">${(node.data.initialScore * 100).toFixed(1)}%</span>
                        </div>
                        <div>
                            <strong style="color: #4a9eff;">Final Score:</strong>
                            <span style="color: #4a9eff;">${(node.data.finalScore * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong>Improvement:</strong>
                        <span style="color: ${node.data.finalScore > node.data.initialScore ? '#28a745' : '#888'};">
                            ${node.data.finalScore > node.data.initialScore ? '+' : ''}${((node.data.finalScore - node.data.initialScore) * 100).toFixed(1)}%
                        </span>
                    </div>
                    ${node.data.optimizationIterations > 0 ? `
                        <div>
                            <strong>Iterations:</strong> ${node.data.optimizationIterations}
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- Optimized Prompt Preview -->
            ${node.data.optimizedPromptText ? `
                <div class="inspector-section">
                    <div style="cursor: pointer; font-weight: bold; margin-bottom: 8px; display: flex; align-items: center;" id="promptToggle">
                        <svg class="details-toggle" width="12" height="12" style="margin-right: 6px;">
                            <use href="#icon-chevron-right"></use>
                        </svg>
                        Optimized Prompt
                    </div>
                    <div id="promptContent" style="display: none;">
                        <div style="background: #1a1a1a; padding: 8px; border-radius: 4px; font-size: 11px; max-height: 200px; overflow-y: auto; white-space: pre-wrap; font-family: monospace;">
                            ${node.data.optimizedPromptText}
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- Optimization Log -->
            ${node.data.optimizationLog.length > 0 ? `
                <div class="inspector-section">
                    <div style="cursor: pointer; font-weight: bold; margin-bottom: 8px; display: flex; align-items: center;" id="logToggle">
                        <svg class="details-toggle" width="12" height="12" style="margin-right: 6px;">
                            <use href="#icon-chevron-right"></use>
                        </svg>
                        Optimization Log
                    </div>
                    <div id="logContent" style="display: none;">
                        <div style="margin-top: 8px; max-height: 200px; overflow-y: auto;">
                            ${node.data.optimizationLog.map(msg => `
                                <div style="background: #1a1a1a; padding: 4px 8px; border-radius: 4px; margin-bottom: 4px; font-size: 10px; color: #888;">
                                    ${msg}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            ` : ''}
        ` : ''}

        <!-- Action Buttons -->
        <div class="inspector-section">
            <button id="inspectorRunOptimize" class="inspector-button"
                    style="width: 100%; padding: 10px; background: ${buttonDisabled ? '#6c757d' : '#4a9eff'}; color: white; border: none; border-radius: 4px; cursor: ${buttonDisabled ? 'not-allowed' : 'pointer'}; font-size: 14px; opacity: ${buttonDisabled ? '0.6' : '1'};"
                    ${buttonDisabled ? 'disabled' : ''}>
                Run Optimization
            </button>
        </div>

        <div class="inspector-section">
            <button id="inspectorApplyToPrompt" class="inspector-button"
                    style="width: 100%; padding: 10px; background: ${applyButtonDisabled ? '#6c757d' : '#28a745'}; color: white; border: none; border-radius: 4px; cursor: ${applyButtonDisabled ? 'not-allowed' : 'pointer'}; font-size: 14px; opacity: ${applyButtonDisabled ? '0.6' : '1'};"
                    ${applyButtonDisabled ? 'disabled' : ''}>
                Apply to Prompt
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

            // Reflection Model
            document.getElementById('inspectorReflectionModel').addEventListener('input', (e) => {
                node.data.reflectionModel = e.target.value;
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
                // Update the main scorer in the array
                if (node.data.scorers.length > 0) {
                    node.data.scorers[0].type = e.target.value;
                }
            });

            // Scorer Model
            document.getElementById('inspectorScorerModel').addEventListener('input', (e) => {
                node.data.scorerModel = e.target.value;
                // Update the main scorer in the array
                if (node.data.scorers.length > 0) {
                    node.data.scorers[0].model = e.target.value;
                }
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

            // MLflow Settings
            const mlflowUriInput = document.getElementById('inspectorMlflowUri');
            const experimentNameInput = document.getElementById('inspectorExperimentName');

            if (mlflowUriInput) {
                mlflowUriInput.addEventListener('input', (e) => {
                    node.data.mlflowTrackingUri = e.target.value;
                });
            }

            if (experimentNameInput) {
                experimentNameInput.addEventListener('input', (e) => {
                    node.data.experimentName = e.target.value;
                });
            }

            // Run Optimization Button
            const runButton = document.getElementById('inspectorRunOptimize');
            if (runButton && context && context.runOptimizeNode) {
                runButton.addEventListener('click', async () => {
                    // Validate before running
                    const errors = validateGepaOptimizeNode(node, context.edges, context.nodes);
                    if (errors.length > 0) {
                        errors.forEach(error => {
                            context.addLog('error', error, node.id);
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

            // Handle collapsible sections
            const toggles = [
                { toggle: 'mlflowToggle', content: 'mlflowContent' },
                { toggle: 'promptToggle', content: 'promptContent' },
                { toggle: 'logToggle', content: 'logContent' }
            ];

            toggles.forEach(({ toggle, content }) => {
                const toggleEl = document.getElementById(toggle);
                const contentEl = document.getElementById(content);
                if (toggleEl && contentEl) {
                    toggleEl.addEventListener('click', () => {
                        const isOpen = contentEl.style.display !== 'none';
                        contentEl.style.display = isOpen ? 'none' : 'block';
                        const svg = toggleEl.querySelector('.details-toggle use');
                        if (svg) {
                            svg.setAttribute('href', isOpen ? '#icon-chevron-right' : '#icon-chevron-down');
                        }
                    });
                }
            });
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
 * Validate GEPA optimize node and return error messages
 */
function validateGepaOptimizeNode(gepaOptimizeNode, edges, nodes) {
    const errors = [];

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

    // Check reflection model
    if (!gepaOptimizeNode.data.reflectionModel || gepaOptimizeNode.data.reflectionModel.trim() === '') {
        errors.push('Reflection model is required (e.g., "openai/gpt-4")');
    }

    // Check model node is connected
    const modelNode = findConnectedModelNode(gepaOptimizeNode.id, edges, nodes);
    if (!modelNode) {
        errors.push('No model node connected to GEPA optimize node');
    }

    return errors;
}

/**
 * Check if GEPA optimize node is ready to run
 */
function isGepaOptimizeNodeReady(gepaOptimizeNode, edges, nodes) {
    const errors = validateGepaOptimizeNode(gepaOptimizeNode, edges, nodes);
    return errors.length === 0;
}

/**
 * Apply optimized prompt to connected prompt node
 */
function applyOptimizedPrompt(gepaOptimizeNode, edges, nodes, addLog, updateNodeDisplay) {
    // Check if we have results
    if (!gepaOptimizeNode.data.optimizedPromptText || gepaOptimizeNode.data.finalScore === 0) {
        addLog('error', 'No optimization results to apply. Run optimization first.', gepaOptimizeNode.id);
        return;
    }

    // Find connected model node, then find its prompt node
    const modelNode = findConnectedModelNode(gepaOptimizeNode.id, edges, nodes);
    if (!modelNode) {
        addLog('error', 'No model node connected', gepaOptimizeNode.id);
        return;
    }

    const promptNode = findPromptNodeForModel(modelNode.id, edges, nodes);
    if (!promptNode) {
        addLog('error', 'No prompt node connected to the model node', gepaOptimizeNode.id);
        return;
    }

    // Apply optimized prompt to system prompt
    const optimizedText = gepaOptimizeNode.data.optimizedPromptText;

    if (optimizedText) {
        promptNode.data.systemPrompt = optimizedText;
        updateNodeDisplay(promptNode.id);

        const improvement = ((gepaOptimizeNode.data.finalScore - gepaOptimizeNode.data.initialScore) * 100).toFixed(1);
        addLog('info', `Applied optimized prompt to prompt node (+${improvement}% improvement)`, gepaOptimizeNode.id);
        addLog('info', `New system prompt: "${optimizedText.substring(0, 200)}${optimizedText.length > 200 ? '...' : ''}"`, gepaOptimizeNode.id);
    } else {
        addLog('warning', 'No optimized prompt text found in optimization results', gepaOptimizeNode.id);
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
    const errors = validateGepaOptimizeNode(gepaOptimizeNode, edges, nodes);
    if (errors.length > 0) {
        errors.forEach(error => addLog('error', error, gepaOptimizeNode.id));
        setNodeStatus(gepaOptimizeNode.id, 'error');
        return;
    }

    // Find connected model node
    const modelNode = findConnectedModelNode(gepaOptimizeNode.id, edges, nodes);
    if (!modelNode) {
        addLog('error', 'No model node connected', gepaOptimizeNode.id);
        setNodeStatus(gepaOptimizeNode.id, 'error');
        return;
    }

    // Set running status
    setNodeStatus(gepaOptimizeNode.id, 'running');
    gepaOptimizeNode.data.optimizationStatus = 'running';
    gepaOptimizeNode.data.optimizationLog = [];
    updateNodeDisplay(gepaOptimizeNode.id);

    addLog('info', 'Starting GEPA optimization...', gepaOptimizeNode.id);

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
        addLog('info', `No system prompt found - using default template: "${initialPrompt}"`, gepaOptimizeNode.id);
    } else {
        addLog('info', `Using system prompt from connected prompt node`, gepaOptimizeNode.id);
    }

    try {
        // Build configuration for Python worker
        const config = {
            model_config: {
                provider: modelNode.data.provider || 'ollama',
                model: modelNode.data.model,
                api_key: modelNode.data.apiKey || ''
            },
            initial_prompt: initialPrompt,
            reflection_model: gepaOptimizeNode.data.reflectionModel,
            max_metric_calls: gepaOptimizeNode.data.maxMetricCalls,
            scorer_config: {
                scorers: gepaOptimizeNode.data.scorers.map(s => ({
                    type: s.type,
                    model: s.model,
                    weight: s.weight || 1.0
                }))
            },
            train_dataset: gepaOptimizeNode.data.trainDataset,
            prompt_name: `gepa_prompt_${gepaOptimizeNode.id}`,
            mlflow_tracking_uri: gepaOptimizeNode.data.mlflowTrackingUri || null,
            experiment_name: gepaOptimizeNode.data.experimentName || null
        };

        // Execute optimization with progress callback
        const result = await executeGepaOptimization(config, (message, data) => {
            addLog('info', `GEPA: ${message}`, gepaOptimizeNode.id);
            gepaOptimizeNode.data.optimizationLog.push(message);
            updateNodeDisplay(gepaOptimizeNode.id);
        }, signal);

        // Update node with results
        gepaOptimizeNode.data.initialScore = result.initial_score;
        gepaOptimizeNode.data.finalScore = result.final_score;
        gepaOptimizeNode.data.optimizedPromptText = result.optimized_prompt_text;
        gepaOptimizeNode.data.optimizationIterations = result.iterations || 0;
        gepaOptimizeNode.data.optimizationStatus = 'success';

        setNodeStatus(gepaOptimizeNode.id, 'success');
        updateNodeDisplay(gepaOptimizeNode.id);

        const improvement = ((result.final_score - result.initial_score) * 100).toFixed(1);
        addLog('info', `GEPA optimization complete! Score: ${(result.final_score * 100).toFixed(1)}% (+${improvement}%)`, gepaOptimizeNode.id);

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

        addLog('error', `GEPA optimization failed: ${errorMsg}`, gepaOptimizeNode.id);
    }
}

module.exports = {
    createGepaOptimizeNodeData,
    renderGepaOptimizeNode,
    renderGepaOptimizeInspector,
    isValidGepaOptimizeConnection,
    isGepaOptimizeNodeReady,
    validateGepaOptimizeNode,
    executeGepaOptimizeNode
};
