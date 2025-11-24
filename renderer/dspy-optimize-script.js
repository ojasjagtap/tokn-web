/**
 * DSPy Optimize Node Helper
 * Handles DSPy optimization node creation, rendering, validation, and execution
 * Uses actual DSPy library via Python bridge for prompt optimization
 */

const { executeDSPyOptimization, checkDSPyEnvironment, validateDSPyConfig } = require('./dspy-worker');
const path = require('path');
const os = require('os');

// ============================================================================
// DATA STRUCTURE
// ============================================================================

/**
 * Initialize DSPy optimize node data structure
 */
function createDSPyOptimizeNodeData() {
    return {
        title: 'DSPy',

        // Optimizer Configuration
        optimizer: 'MIPROv2',  // 'MIPROv2' (instruction optimization)
        optimizationMode: 'light',       // For MIPRO: 'light' | 'medium' | 'heavy'
        programType: 'predict',          // 'predict' | 'chain_of_thought' | 'react'

        // Metric Configuration
        metricType: 'exact_match',       // 'exact_match' | 'contains' | 'semantic_f1'
        metricThreshold: null,

        // Optimizer Parameters
        maxBootstrappedDemos: 4,
        maxLabeledDemos: 16,
        maxRounds: 1,                    // For BootstrapFewShot
        numTrials: 30,                   // For MIPRO
        minibatch: true,                 // For MIPRO
        minibatchSize: 35,               // For MIPRO

        // Dataset Management
        trainDataset: [],                // Array of {input, output}
        valDataset: [],                  // Validation set (optional)
        datasetMode: 'manual',           // 'manual' | 'csv' (future)

        // Results
        optimizationStatus: 'idle',      // 'idle' | 'running' | 'success' | 'error'
        validationScore: 0,
        optimizedSignature: null,        // Object with instructions per predictor
        optimizedDemos: [],              // Array of demo objects
        predictors: [],                  // Predictor metadata
        compiledProgramPath: null,
        optimizationLog: [],             // Progress messages

        // Dataset sizes for display
        datasetSizes: {
            train: 0,
            val: 0
        },

        // UI state
        valDatasetCollapsed: true  // Validation dataset section collapsed by default
    };
}

// ============================================================================
// NODE RENDERING
// ============================================================================

/**
 * Extract optimized prompt text from DSPy node data
 */
function getOptimizedPromptText(node) {
    if (!node.data.optimizedSignature || node.data.validationScore === 0) {
        return '';
    }

    const instructions = node.data.optimizedSignature;
    let instructionText = '';

    if (instructions && typeof instructions === 'object') {
        // Combine all instructions
        instructionText = Object.values(instructions).join('\n\n');
    }

    return instructionText;
}

/**
 * Render DSPy optimize node HTML
 */
function renderDSPyOptimizeNode(node, edges, nodes) {
    const collapseIconId = node.collapsed ? 'icon-chevron-right' : 'icon-chevron-down';

    // Calculate dataset info
    const trainSize = node.data.trainDataset?.length || 0;
    const valSize = node.data.valDataset?.length || 0;
    const datasetInfo = trainSize > 0 ? `${trainSize} train${valSize > 0 ? `, ${valSize} val` : ''}` : 'No dataset';

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
                <div>${node.data.optimizer} optimization</div>
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
 * Render DSPy optimize node inspector UI
 */
function renderDSPyOptimizeInspector(node, updateNodeDisplay, edges, nodes, state) {
    const buttonDisabled = state.isRunning || state.isOptimizing || state.isRunningModelNode;
    const hasResults = node.data.validationScore > 0 && node.data.optimizedSignature;
    const applyButtonDisabled = buttonDisabled || !hasResults;

    const html = `
        <div class="inspector-section">
            <label>Title</label>
            <input type="text" id="inspectorTitle" class="inspector-input" value="${node.data.title}">
        </div>

        <!-- MIPRO Mode -->
        <div class="inspector-section">
            <label>MIPRO Mode</label>
            <select id="inspectorOptimizationMode" class="inspector-input">
                <option value="light" ${node.data.optimizationMode === 'light' ? 'selected' : ''}>Light (fast)</option>
                <option value="medium" ${node.data.optimizationMode === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="heavy" ${node.data.optimizationMode === 'heavy' ? 'selected' : ''}>Heavy (thorough)</option>
            </select>
        </div>

        <!-- Program Type -->
        <div class="inspector-section">
            <label>Program Type</label>
            <select id="inspectorProgramType" class="inspector-input">
                <option value="predict" ${node.data.programType === 'predict' ? 'selected' : ''}>Predict</option>
                <option value="chain_of_thought" ${node.data.programType === 'chain_of_thought' ? 'selected' : ''}>Chain of Thought</option>
                <option value="react" ${node.data.programType === 'react' ? 'selected' : ''}>ReAct</option>
            </select>
        </div>

        <!-- Metric Configuration -->
        <div class="inspector-section">
            <label>Metric Type</label>
            <select id="inspectorMetricType" class="inspector-input">
                <option value="exact_match" ${node.data.metricType === 'exact_match' ? 'selected' : ''}>Exact Match</option>
                <option value="contains" ${node.data.metricType === 'contains' ? 'selected' : ''}>Contains</option>
                <option value="semantic_f1" ${node.data.metricType === 'semantic_f1' ? 'selected' : ''}>Semantic F1</option>
            </select>
        </div>

        <!-- Training Dataset -->
        <div class="inspector-section">
            <label>Training Dataset (JSON)</label>
            <textarea id="inspectorTrainDataset" class="inspector-textarea code-editor" rows="10"
                      placeholder='[&#10;  {"input": "What is 2+2?", "output": "4"},&#10;  {"input": "What is 3+3?", "output": "6"}&#10;]'>${JSON.stringify(node.data.trainDataset, null, 2)}</textarea>
            <div style="font-size: 10px; color: #888; margin-top: 4px;">
                ${node.data.trainDataset.length} examples
            </div>
        </div>

        <!-- Validation Dataset -->
        <div class="inspector-section">
            <div style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none;" id="valDatasetHeader">
                <svg width="12" height="12" style="flex-shrink: 0;">
                    <use href="#${node.data.valDatasetCollapsed ? 'icon-chevron-right' : 'icon-chevron-down'}"></use>
                </svg>
                <label style="cursor: pointer; margin: 0;">Validation Dataset (optional)</label>
            </div>
            <textarea id="inspectorValDataset" class="inspector-textarea code-editor" rows="10"
                      style="display: ${node.data.valDatasetCollapsed ? 'none' : 'block'};"
                      placeholder='[&#10;  {"input": "What is 2+2?", "output": "4"},&#10;  {"input": "What is 3+3?", "output": "6"}&#10;]'>${JSON.stringify(node.data.valDataset, null, 2)}</textarea>
            <div id="valDatasetInfo" style="display: ${node.data.valDatasetCollapsed ? 'none' : 'block'}; font-size: 10px; color: #888; margin-top: 4px;">
                ${node.data.valDataset.length > 0 ? `${node.data.valDataset.length} examples` : 'Auto-split from training if empty'}
            </div>
        </div>

        <!-- Results Display -->
        ${node.data.validationScore > 0 ? `
            <div class="inspector-section">
                <label>Optimization Results</label>
                <div style="background: #1a1a1a; padding: 12px; border-radius: 4px; font-size: 12px;">
                    <div style="margin-bottom: 8px;">
                        <strong style="color: #4a9eff;">Final Score:</strong>
                        <span style="color: #4a9eff;">${(node.data.validationScore * 100).toFixed(1)}%</span>
                    </div>
                    ${node.data.optimizedSignature && Object.keys(node.data.optimizedSignature).length > 0 ? `
                        <div>
                            <strong>Optimized Prompt:</strong>
                            ${Object.entries(node.data.optimizedSignature).map(([name, instruction]) =>
                                `<div style="margin-top: 4px; color: #888;">${name}: ${instruction}</div>`
                            ).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        ` : ''}

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

            // MIPRO Mode
            document.getElementById('inspectorOptimizationMode').addEventListener('change', (e) => {
                node.data.optimizationMode = e.target.value;
            });

            // Program Type
            document.getElementById('inspectorProgramType').addEventListener('change', (e) => {
                node.data.programType = e.target.value;
            });

            // Metric Type
            const metricSelect = document.getElementById('inspectorMetricType');
            metricSelect.addEventListener('change', (e) => {
                node.data.metricType = e.target.value;
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

            // Validation Dataset - Collapse/Expand Toggle
            const valDatasetHeader = document.getElementById('valDatasetHeader');
            if (valDatasetHeader) {
                valDatasetHeader.addEventListener('click', (e) => {
                    node.data.valDatasetCollapsed = !node.data.valDatasetCollapsed;
                    // Re-render inspector immediately
                    context.updateInspector();
                });
            }

            // Validation Dataset
            const valDatasetInput = document.getElementById('inspectorValDataset');
            if (valDatasetInput) {
                valDatasetInput.addEventListener('input', (e) => {
                    try {
                        const parsed = JSON.parse(e.target.value);
                        if (Array.isArray(parsed)) {
                            node.data.valDataset = parsed;
                            updateNodeDisplay(node.id);
                        }
                    } catch (err) {
                        // Invalid JSON, keep old value
                    }
                });
            }

            // Run Optimization Button
            const runButton = document.getElementById('inspectorRunOptimize');
            if (runButton && context && context.runOptimizeNode) {
                runButton.addEventListener('click', async () => {
                    // Validate before running
                    const errors = validateDSPyOptimizeNode(node, context.edges, context.nodes);
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
        }
    };
}

// ============================================================================
// CONNECTION VALIDATION
// ============================================================================

/**
 * Validate DSPy optimize node connections
 */
function isValidDSPyOptimizeConnection(sourceNode, sourcePin, targetNode, targetPin, edges) {
    // Allow Model.output → DSPyOptimize.input
    if (sourceNode.type === 'model' && sourcePin === 'output' &&
        targetNode.type === 'dspy-optimize' && targetPin === 'input') {

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
 * Find connected model node (Model.output → DSPyOptimize.input)
 */
function findConnectedModelNode(dspyOptimizeNodeId, edges, nodes) {
    for (const edge of edges.values()) {
        if (edge.targetNodeId === dspyOptimizeNodeId && edge.targetPin === 'input') {
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
 * Validate DSPy optimize node and return error messages
 */
function validateDSPyOptimizeNode(dspyOptimizeNode, edges, nodes) {
    const errors = [];

    // Check training dataset
    if (!dspyOptimizeNode.data.trainDataset || dspyOptimizeNode.data.trainDataset.length === 0) {
        errors.push('Training dataset is required (at least 1 example)');
    } else {
        // Validate dataset format
        for (let i = 0; i < Math.min(dspyOptimizeNode.data.trainDataset.length, 5); i++) {
            const example = dspyOptimizeNode.data.trainDataset[i];
            if (!example.input) {
                errors.push(`Training dataset example ${i + 1} missing 'input' field`);
            }
            if (!example.output) {
                errors.push(`Training dataset example ${i + 1} missing 'output' field`);
            }
        }
    }

    // Check model node is connected
    const modelNode = findConnectedModelNode(dspyOptimizeNode.id, edges, nodes);
    if (!modelNode) {
        errors.push('No model node connected to DSPy optimize node');
    }

    return errors;
}

/**
 * Check if DSPy optimize node is ready to run
 */
function isDSPyOptimizeNodeReady(dspyOptimizeNode, edges, nodes) {
    const errors = validateDSPyOptimizeNode(dspyOptimizeNode, edges, nodes);
    return errors.length === 0;
}

/**
 * Apply optimized prompt to connected prompt node
 */
function applyOptimizedPrompt(dspyOptimizeNode, edges, nodes, addLog, updateNodeDisplay) {
    // Check if we have results
    if (!dspyOptimizeNode.data.optimizedSignature || dspyOptimizeNode.data.validationScore === 0) {
        addLog('error', 'No optimization results to apply. Run optimization first.', dspyOptimizeNode.id);
        return;
    }

    // Find connected model node, then find its prompt node
    const modelNode = findConnectedModelNode(dspyOptimizeNode.id, edges, nodes);
    if (!modelNode) {
        addLog('error', 'No model node connected', dspyOptimizeNode.id);
        return;
    }

    const promptNode = findPromptNodeForModel(modelNode.id, edges, nodes);
    if (!promptNode) {
        addLog('error', 'No prompt node connected to the model node', dspyOptimizeNode.id);
        return;
    }

    // Apply optimized instruction to system prompt
    const instructions = dspyOptimizeNode.data.optimizedSignature;
    let instructionText = '';

    if (instructions && typeof instructions === 'object') {
        // Combine all instructions
        instructionText = Object.values(instructions).join('\n\n');
    }

    if (instructionText) {
        promptNode.data.systemPrompt = instructionText;
        updateNodeDisplay(promptNode.id);
        addLog('info', `Applied optimized instruction to prompt node (score: ${(dspyOptimizeNode.data.validationScore * 100).toFixed(1)}%)`, dspyOptimizeNode.id);
        addLog('info', `New system prompt: "${instructionText.substring(0, 200)}${instructionText.length > 200 ? '...' : ''}"`, dspyOptimizeNode.id);
    } else {
        addLog('warning', 'No instruction text found in optimization results', dspyOptimizeNode.id);
        addLog('info', `optimizedSignature contents: ${JSON.stringify(dspyOptimizeNode.data.optimizedSignature)}`, dspyOptimizeNode.id);
    }
}

// ============================================================================
// EXECUTION
// ============================================================================

/**
 * Execute DSPy optimization node
 */
async function executeDSPyOptimizeNode(
    dspyOptimizeNode,
    edges,
    nodes,
    updateNodeDisplay,
    setNodeStatus,
    addLog,
    signal
) {
    // Validate prerequisites
    const errors = validateDSPyOptimizeNode(dspyOptimizeNode, edges, nodes);
    if (errors.length > 0) {
        errors.forEach(error => addLog('error', error, dspyOptimizeNode.id));
        setNodeStatus(dspyOptimizeNode.id, 'error');
        return;
    }

    // Find connected model node
    const modelNode = findConnectedModelNode(dspyOptimizeNode.id, edges, nodes);
    if (!modelNode) {
        addLog('error', 'No model node connected', dspyOptimizeNode.id);
        setNodeStatus(dspyOptimizeNode.id, 'error');
        return;
    }

    // Set running status
    setNodeStatus(dspyOptimizeNode.id, 'running');
    dspyOptimizeNode.data.optimizationStatus = 'running';
    dspyOptimizeNode.data.optimizationLog = [];
    updateNodeDisplay(dspyOptimizeNode.id);

    addLog('info', 'Starting DSPy optimization...', dspyOptimizeNode.id);

    // Find connected prompt node to get system prompt
    const promptNode = findPromptNodeForModel(modelNode.id, edges, nodes);
    const systemPrompt = promptNode ? (promptNode.data.systemPrompt || '') : '';

    if (systemPrompt) {
        addLog('info', `Using system prompt from connected prompt node`, dspyOptimizeNode.id);
    } else {
        addLog('warning', 'No system prompt found - DSPy will optimize from scratch', dspyOptimizeNode.id);
    }

    try {
        // Build configuration for Python worker
        const config = {
            model_config: {
                provider: modelNode.data.provider || 'ollama',
                model: modelNode.data.model,
                api_key: modelNode.data.apiKey || ''
            },
            // Pass system prompt for DSPy to use as initial instruction
            initial_instruction: systemPrompt,
            optimizer: dspyOptimizeNode.data.optimizer,
            optimizer_config: {
                max_bootstrapped_demos: dspyOptimizeNode.data.maxBootstrappedDemos,
                max_labeled_demos: dspyOptimizeNode.data.maxLabeledDemos,
                max_rounds: dspyOptimizeNode.data.maxRounds,
                num_trials: dspyOptimizeNode.data.numTrials,
                minibatch: dspyOptimizeNode.data.minibatch,
                minibatch_size: dspyOptimizeNode.data.minibatchSize,
                mode: dspyOptimizeNode.data.optimizationMode,
                metric_threshold: dspyOptimizeNode.data.metricThreshold
            },
            metric_config: {
                type: dspyOptimizeNode.data.metricType
            },
            program_type: dspyOptimizeNode.data.programType,
            train_dataset: dspyOptimizeNode.data.trainDataset,
            val_dataset: dspyOptimizeNode.data.valDataset,
            save_path: path.join(os.tmpdir(), 'tokn', 'dspy_compiled', dspyOptimizeNode.id)
        };

        // Execute optimization with progress callback
        const result = await executeDSPyOptimization(config, (message, data) => {
            addLog('info', `DSPy: ${message}`, dspyOptimizeNode.id);
            dspyOptimizeNode.data.optimizationLog.push(message);
            updateNodeDisplay(dspyOptimizeNode.id);
        }, signal);

        // Update node with results
        dspyOptimizeNode.data.validationScore = result.validation_score;
        dspyOptimizeNode.data.optimizedSignature = result.optimized_signature;
        dspyOptimizeNode.data.optimizedDemos = result.optimized_demos || [];
        dspyOptimizeNode.data.predictors = result.predictors || [];
        dspyOptimizeNode.data.compiledProgramPath = result.compiled_program_path;
        dspyOptimizeNode.data.datasetSizes = result.dataset_sizes || { train: 0, val: 0 };
        dspyOptimizeNode.data.optimizationStatus = 'success';

        setNodeStatus(dspyOptimizeNode.id, 'success');
        updateNodeDisplay(dspyOptimizeNode.id);

        addLog('info', `DSPy optimization complete! Score: ${(result.validation_score * 100).toFixed(1)}%`, dspyOptimizeNode.id);

    } catch (error) {
        dspyOptimizeNode.data.optimizationStatus = 'error';
        setNodeStatus(dspyOptimizeNode.id, 'error');
        updateNodeDisplay(dspyOptimizeNode.id);

        let errorMsg = error.message;

        // Provide helpful error messages
        if (errorMsg.includes('ECONNREFUSED')) {
            errorMsg += ' - Make sure Ollama is running (ollama serve)';
        } else if (errorMsg.includes('DSPy library not found')) {
            errorMsg += ' - Install with: pip install dspy-ai';
        } else if (errorMsg.includes('Python not found')) {
            errorMsg += ' - Install Python 3.8+ and add to PATH';
        }

        addLog('error', `DSPy optimization failed: ${errorMsg}`, dspyOptimizeNode.id);
    }
}

module.exports = {
    createDSPyOptimizeNodeData,
    renderDSPyOptimizeNode,
    renderDSPyOptimizeInspector,
    isValidDSPyOptimizeConnection,
    isDSPyOptimizeNodeReady,
    validateDSPyOptimizeNode,
    executeDSPyOptimizeNode
};
