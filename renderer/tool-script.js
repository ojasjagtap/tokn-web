/**
 * Custom Tool Node Helper
 * Handles Tool node creation, rendering, validation, and registration
 */

import { createTaggedMessage } from './log-utils.js';

/**
 * Default web-safe HTTP fetcher implementation
 * Note: Tools run in sandboxed Web Workers with no Node.js access
 */
const DEFAULT_TOOL_CODE = `// Fetches content from a URL using the Fetch API
// Web Worker environment - no require(), no fs, pure JavaScript only

async function fetchUrl(args) {
    try {
        const response = await fetch(args.url);

        if (!response.ok) {
            throw new Error(\`HTTP error! status: \${response.status}\`);
        }

        const contentType = response.headers.get('content-type');

        // Return appropriate format based on content type
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            return await response.text();
        }
    } catch (error) {
        throw new Error(\`Failed to fetch: \${error.message}\`);
    }
}
`;

/**
 * Initialize tool node data structure
 */
function createToolNodeData() {
    return {
        name: 'fetch_url',
        description: 'Fetches content from a URL using HTTP GET request',
        parametersSchema: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'The URL to fetch (http/https)' }
            },
            required: ['url']
        },
        implementation: {
            type: 'script',
            language: 'javascript',
            code: DEFAULT_TOOL_CODE
        }
    };
}

/**
 * Render tool node HTML
 */
function renderToolNode(node, connectedModels) {
    const connectedCount = connectedModels.length;
    const collapseIconId = node.collapsed ? 'icon-chevron-right' : 'icon-chevron-down';

    return `
        <div class="node-header">
            <div class="header-top">
                <div class="header-left">
                    <svg class="collapse-toggle" data-node-id="${node.id}" width="12" height="12">
                        <use href="#${collapseIconId}"></use>
                    </svg>
                    <span class="node-title">${node.data.name}</span>
                </div>
                <span class="node-status-badge">${node.status}</span>
            </div>
            <div class="header-bottom">
                <div class="pin-spacer"></div>
                <div class="pin-container pin-output-container">
                    <span class="pin-label">tool</span>
                    <div class="pin pin-output" data-pin="register"></div>
                </div>
            </div>
        </div>
        <div class="node-body" style="display: ${node.collapsed ? 'none' : 'block'}">
            <div class="node-description">${node.data.description || 'No description'}</div>
            <div class="node-output-viewer">${node.data.lastOutput || ''}</div>
        </div>
    `;
}

/**
 * Render tool node inspector UI
 */
function renderToolInspector(node, updateNodeDisplay, addLog) {
    const paramsJson = JSON.stringify(node.data.parametersSchema, null, 2);

    const html = `
        <div class="inspector-section">
            <label>Name</label>
            <input type="text" id="inspectorToolName" class="inspector-input" value="${node.data.name}">
        </div>
        <div class="inspector-section">
            <label>Description</label>
            <textarea id="inspectorToolDescription" class="inspector-textarea" rows="3">${node.data.description}</textarea>
        </div>
        <div class="inspector-section">
            <div class="label-with-info">
                <label>Parameters Schema (JSON)</label>
                <span class="info-icon">i
                    <div class="info-tooltip">
                        <div class="info-tooltip-title">Parameter Schema Guidelines</div>
                        <div class="info-tooltip-section">
                            <div class="info-tooltip-label">Structure:</div>
                            Define a JSON schema with:
                            <ul class="info-tooltip-list">
                                <li><code>type</code>: Always "object"</li>
                                <li><code>properties</code>: Define each parameter with its type</li>
                                <li><code>required</code>: Array of required parameter names</li>
                            </ul>
                        </div>
                        <div class="info-tooltip-section">
                            <div class="info-tooltip-label">Example:</div>
                            <div class="info-tooltip-code">{
  "type": "object",
  "properties": {
    "path": { "type": "string" },
    "encoding": { "type": "string" }
  },
  "required": ["path"]
}</div>
                        </div>
                        <div class="info-tooltip-section">
                            <div class="info-tooltip-label">Supported Types:</div>
                            string, number, boolean, object, array
                        </div>
                    </div>
                </span>
            </div>
            <textarea id="inspectorToolParams" class="inspector-textarea" rows="8">${paramsJson}</textarea>
        </div>
        <div class="inspector-section">
            <div class="label-with-info">
                <label>Implementation (JavaScript)</label>
                <span class="info-icon">i
                    <div class="info-tooltip">
                        <div class="info-tooltip-title">Implementation Guidelines</div>
                        <div class="info-tooltip-section">
                            <div class="info-tooltip-label">Code Structure:</div>
                            Your code receives an <code>args</code> object matching your schema and must return a result or throw an error.
                        </div>
                        <div class="info-tooltip-section">
                            <div class="info-tooltip-label">Return Types:</div>
                            <ul class="info-tooltip-list">
                                <li><strong>String:</strong> Return text directly</li>
                                <li><strong>JSON:</strong> Return an object or array</li>
                                <li><strong>Binary:</strong> Return a Buffer or base64 string</li>
                            </ul>
                        </div>
                        <div class="info-tooltip-section">
                            <div class="info-tooltip-label">Example:</div>
                            <div class="info-tooltip-code">async function fetchData(args) {
  const response = await fetch(
    args.url
  );

  if (!response.ok) {
    throw new Error('Fetch failed');
  }

  return await response.json();
}</div>
                        </div>
                        <div class="info-tooltip-section">
                            <div class="info-tooltip-label">Error Handling:</div>
                            Throw errors with descriptive messages:<br/>
                            <code>throw new Error('message')</code>
                        </div>
                    </div>
                </span>
            </div>
            <textarea id="inspectorToolCode" class="inspector-textarea code-editor" rows="15">${node.data.implementation.code}</textarea>
        </div>
        <div class="inspector-section">
            <label>Output</label>
            <textarea id="inspectorToolOutput" class="inspector-textarea" rows="10" readonly>${node.data.lastOutput || ''}</textarea>
        </div>
        <div class="inspector-section">
            <button id="validateToolButton" class="validate-button">Validate</button>
        </div>
    `;

    return {
        html,
        setupListeners: () => {
            document.getElementById('inspectorToolName').addEventListener('input', (e) => {
                node.data.name = e.target.value;
                updateNodeDisplay(node.id);
            });

            document.getElementById('inspectorToolDescription').addEventListener('input', (e) => {
                node.data.description = e.target.value;
                updateNodeDisplay(node.id);
            });

            document.getElementById('inspectorToolParams').addEventListener('input', (e) => {
                try {
                    node.data.parametersSchema = JSON.parse(e.target.value);
                } catch (err) {
                    // Keep the old value if JSON is invalid
                }
            });

            document.getElementById('inspectorToolCode').addEventListener('input', (e) => {
                node.data.implementation.code = e.target.value;
            });

            document.getElementById('validateToolButton').addEventListener('click', () => {
                validateTool(node, addLog, getAllToolNodes);
            });

            // Setup tooltip positioning
            const infoIcons = document.querySelectorAll('.info-icon');
            infoIcons.forEach(icon => {
                icon.addEventListener('mouseenter', (e) => {
                    const tooltip = icon.querySelector('.info-tooltip');
                    if (!tooltip) return;

                    const iconRect = icon.getBoundingClientRect();
                    const tooltipWidth = 280;
                    const tooltipHeight = tooltip.offsetHeight || 300; // Estimate if not rendered
                    const padding = 20;

                    // Calculate initial position (to the right of icon)
                    let left = iconRect.right + 8;
                    let top = iconRect.top - 8;

                    // Check if tooltip would go off the right edge
                    if (left + tooltipWidth > window.innerWidth - padding) {
                        // Position to the left of icon instead
                        left = iconRect.left - tooltipWidth - 8;
                    }

                    // Ensure tooltip doesn't go off the left edge
                    if (left < padding) {
                        left = padding;
                    }

                    // Check if tooltip would go off the bottom edge
                    if (top + tooltipHeight > window.innerHeight - padding) {
                        top = window.innerHeight - tooltipHeight - padding;
                    }

                    // Ensure tooltip doesn't go off the top edge
                    if (top < padding) {
                        top = padding;
                    }

                    tooltip.style.left = `${left}px`;
                    tooltip.style.top = `${top}px`;
                });
            });
        }
    };
}

/**
 * Get all tool nodes from state (injected function reference)
 */
let getAllToolNodes = null;

function setGetAllToolNodes(fn) {
    getAllToolNodes = fn;
}

/**
 * Validate tool node
 */
function validateTool(node, addLog, getAllToolNodesFn) {
    const issues = [];

    // Check name is non-empty
    if (!node.data.name || !node.data.name.trim()) {
        issues.push('Tool name cannot be empty');
    }

    // Check name is unique within connected models
    // For simplicity, check uniqueness across all tools
    if (getAllToolNodesFn) {
        const allTools = getAllToolNodesFn();
        const duplicates = allTools.filter(t => t.id !== node.id && t.data.name === node.data.name);
        if (duplicates.length > 0) {
            issues.push(`Tool name "${node.data.name}" is not unique`);
        }
    }

    // Check schema is well-formed
    try {
        const schema = node.data.parametersSchema;
        if (!schema || typeof schema !== 'object') {
            issues.push('Parameters schema must be a valid object');
        } else {
            // Check schema has required structure
            if (schema.type !== 'object') {
                issues.push('Schema "type" must be "object"');
            }

            if (!schema.properties || typeof schema.properties !== 'object') {
                issues.push('Schema must have a "properties" object');
            } else {
                // Validate each property has a type
                for (const [propName, propDef] of Object.entries(schema.properties)) {
                    if (!propDef.type) {
                        issues.push(`Property "${propName}" must have a "type" field`);
                    } else {
                        const validTypes = ['string', 'number', 'boolean', 'object', 'array'];
                        if (!validTypes.includes(propDef.type)) {
                            issues.push(`Property "${propName}" has invalid type "${propDef.type}"`);
                        }
                    }
                }

                // Validate required array references existing properties
                if (schema.required) {
                    if (!Array.isArray(schema.required)) {
                        issues.push('Schema "required" must be an array');
                    } else {
                        for (const requiredProp of schema.required) {
                            if (!schema.properties[requiredProp]) {
                                issues.push(`Required property "${requiredProp}" not defined in properties`);
                            }
                        }
                    }
                }
            }
        }
    } catch (err) {
        issues.push(`Schema validation error: ${err.message}`);
    }

    // Check JavaScript syntax
    try {
        new Function('args', node.data.implementation.code);
    } catch (err) {
        issues.push(`JavaScript syntax error: ${err.message}`);
    }

    // Log validation errors only
    if (issues.length > 0) {
        issues.forEach(issue => {
            addLog('error', createTaggedMessage(node.data.name, issue), node.id);
        });
    } else {
        addLog('info', createTaggedMessage(node.data.name, 'Validation passed'), node.id);
    }
}

/**
 * Validate tool connection
 */
function isValidToolConnection(sourceNode, sourcePin, targetNode, targetPin) {
    // Allow: Tool.register → Model.tools
    if (sourceNode.type === 'tool' && sourcePin === 'register' &&
        targetNode.type === 'model' && targetPin === 'tools') {
        return true;
    }

    return false;
}

/**
 * Find tools registered to a model
 */
function findRegisteredTools(modelNodeId, edges, nodes) {
    const tools = [];

    for (const edge of edges.values()) {
        if (edge.targetNodeId === modelNodeId && edge.targetPin === 'tools') {
            const toolNode = nodes.get(edge.sourceNodeId);
            if (toolNode && toolNode.type === 'tool') {
                tools.push(toolNode);
            }
        }
    }

    return tools;
}

/**
 * Find models connected to a tool
 */
function findConnectedModels(toolNodeId, edges, nodes) {
    const models = [];

    for (const edge of edges.values()) {
        if (edge.sourceNodeId === toolNodeId && edge.sourcePin === 'register') {
            const modelNode = nodes.get(edge.targetNodeId);
            if (modelNode && modelNode.type === 'model') {
                models.push(modelNode);
            }
        }
    }

    return models;
}

/**
 * Build tools catalog for a model
 */
function buildToolsCatalog(tools) {
    return tools.map(tool => ({
        name: tool.data.name,
        description: tool.data.description,
        parametersSchema: tool.data.parametersSchema
    }));
}

export {
    createToolNodeData,
    renderToolNode,
    renderToolInspector,
    isValidToolConnection,
    findRegisteredTools,
    findConnectedModels,
    buildToolsCatalog,
    setGetAllToolNodes
};
