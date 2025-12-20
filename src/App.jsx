import { useEffect } from 'react'

function App() {
  useEffect(() => {
    // Load the existing script.js after the component mounts
    // This allows us to keep the existing functionality while we migrate
    const script = document.createElement('script')
    script.src = '/renderer/script.js'
    script.type = 'module'
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  return (
    <>
      {/* SVG Icon Definitions */}
      <svg style={{ display: 'none' }}>
        <defs>
          <symbol id="icon-chevron-down" viewBox="0 0 16 16">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </symbol>
          <symbol id="icon-chevron-right" viewBox="0 0 16 16">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </symbol>
        </defs>
      </svg>

      {/* Top Action Bar */}
      <div id="topBar" className="top-bar">
        <div className="top-bar-left">
          <img src="/logo-white.png" alt="tokn" className="app-logo" />
          <h1 className="app-title">tokn</h1>
        </div>
        <div className="top-bar-right">
          <button id="newButton" className="action-button" title="New Workflow (Ctrl+N)">New</button>
          <button id="openButton" className="action-button" title="Open Workflow (Ctrl+O)">Open</button>
          <button id="saveButton" className="action-button" title="Save Workflow (Ctrl+S)">Save</button>
          <button id="runButton" className="action-button" disabled>Run</button>
          <button id="cancelButton" className="action-button" disabled>Cancel</button>
          <div id="statusChip" className="status-chip status-idle">Idle</div>
          <button id="settingsButton" className="action-button">Settings</button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        <div className="main-content-top">
          {/* Left Panel: Nodes */}
          <div id="leftPanel" className="left-panel">
            <div className="panel-header">
              <h2>NODES</h2>
            </div>
            <div className="panel-body">
              <input type="text" id="nodeSearch" className="node-search" placeholder="Search nodes..."/>

              <div className="node-category">
                <div className="category-title">Input</div>
                <div className="node-item" data-node-type="prompt" draggable="true">
                  Prompt
                </div>
              </div>

              <div className="node-category">
                <div className="category-title">Tools</div>
                <div className="node-item" data-node-type="tool" draggable="true">
                  Custom
                </div>
              </div>

              <div className="node-category">
                <div className="category-title">LLM</div>
                <div className="node-item" data-node-type="model" draggable="true">
                  Model
                </div>
              </div>

              <div className="node-category">
                <div className="category-title">Optimization</div>
                <div className="node-item" data-node-type="dspy-optimize" draggable="true">
                  MIPROv2
                </div>
                <div className="node-item" data-node-type="gepa-optimize" draggable="true">
                  GEPA
                </div>
              </div>
            </div>
          </div>

          {/* Center: Canvas */}
          <div id="canvasContainer" className="canvas-container">
            <canvas id="gridCanvas" className="grid-canvas"></canvas>
            <svg id="edgesSvg" className="edges-svg"></svg>
            <div id="nodesLayer" className="nodes-layer"></div>
          </div>

          {/* Zoom Controls */}
          <div id="zoomControls" className="zoom-controls">
            <button id="zoomInButton" className="zoom-button" title="Zoom In">+</button>
            <button id="zoomOutButton" className="zoom-button" title="Zoom Out">−</button>
          </div>

          {/* Right Panel: Inspector */}
          <div id="rightPanel" className="right-panel">
            <div className="inspector-container">
              <div className="panel-header">
                <h2>INSPECTOR</h2>
              </div>
              <div className="panel-body">
                <div id="inspectorContent" className="inspector-content">
                  <div className="no-selection">No node selected</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Logs Panel (at bottom of page) */}
        <div id="logsPanel" className="logs-panel">
          <div className="logs-header">
            <span className="logs-title">Logs</span>
            <div className="logs-actions">
              <select id="logsFilter" className="logs-filter">
                <option value="all">All</option>
                <option value="errors">Errors</option>
                <option value="current">Current Run</option>
              </select>
              <button id="collapseLogsButton" className="logs-icon-button" title="Collapse">−</button>
            </div>
          </div>
          <div id="logsBody" className="logs-body">
            {/* Log entries will be added here dynamically */}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <div id="settingsModal" className="modal" style={{ display: 'none' }}>
        <div className="modal-content">
          <div className="modal-header">
            <h2>Settings</h2>
            <button id="closeSettingsButton" className="close-button">&times;</button>
          </div>
          <div className="modal-body">
            <h3>Editor</h3>

            {/* Snap to Grid Setting */}
            <div className="provider-section">
              <div className="form-group">
                <div className="setting-row">
                  <div className="setting-info">
                    <label className="setting-label">Snap nodes to grid</label>
                    <p className="provider-note">When enabled, nodes will snap to grid lines when dragging</p>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" id="snapToGridCheckbox"/>
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>

            <h3>Providers</h3>

            {/* OpenAI Provider */}
            <div className="provider-section">
              <div className="provider-header">
                <h4>OpenAI</h4>
                <span id="openaiStatus" className="provider-status">Not configured</span>
              </div>
              <div className="provider-form">
                <div className="form-group">
                  <label htmlFor="openaiApiKey">API Key</label>
                  <input type="password" id="openaiApiKey" className="form-input"/>
                </div>
                <div className="form-actions">
                  <button id="saveOpenaiButton" className="primary-button">Save</button>
                  <button id="removeOpenaiButton" className="secondary-button">Remove</button>
                </div>
              </div>
            </div>

            {/* Claude/Anthropic Provider */}
            <div className="provider-section">
              <div className="provider-header">
                <h4>Anthropic</h4>
                <span id="claudeStatus" className="provider-status">Not configured</span>
              </div>
              <div className="provider-form">
                <div className="form-group">
                  <label htmlFor="claudeApiKey">API Key</label>
                  <input type="password" id="claudeApiKey" className="form-input"/>
                </div>
                <div className="form-actions">
                  <button id="saveClaudeButton" className="primary-button">Save</button>
                  <button id="removeClaudeButton" className="secondary-button">Remove</button>
                </div>
              </div>
            </div>

            {/* Google Gemini Provider */}
            <div className="provider-section">
              <div className="provider-header">
                <h4>Google</h4>
                <span id="geminiStatus" className="provider-status">Not configured</span>
              </div>
              <div className="provider-form">
                <div className="form-group">
                  <label htmlFor="geminiApiKey">API Key</label>
                  <input type="password" id="geminiApiKey" className="form-input"/>
                </div>
                <div className="form-actions">
                  <button id="saveGeminiButton" className="primary-button">Save</button>
                  <button id="removeGeminiButton" className="secondary-button">Remove</button>
                </div>
              </div>
            </div>

            {/* Ollama section removed - will be deleted in Phase 3 */}
          </div>
        </div>
      </div>
    </>
  )
}

export default App
