# DSPy Optimization Node

Visual prompt optimization using Stanford NLP's DSPy library.

## Quick Summary

The DSPy node automatically improves your prompts using machine learning. Instead of manually tweaking prompts, you provide examples of what you want (input/output pairs), and DSPy finds the best instruction and few-shot examples for you.

**In 3 steps**:
1. Connect: Prompt → Model → DSPy
2. Add training examples (8-10 input/output pairs)
3. Click Run, then Apply to use the optimized prompt

---

## Prerequisites (First-Time Setup)

Before using the DSPy node, you need:

### 1. Python 3.8 or higher
**Check if installed**:
```bash
python --version
```

**Don't have Python?** Download from [python.org](https://www.python.org/downloads/)

### 2. DSPy Library
**The app will prompt you to install this automatically** when you first drag a DSPy node onto the canvas.

**Or install manually**:
```bash
pip install dspy-ai
```

### 3. Language Model (choose one)

**Option A: Ollama (Local, Free)**
- Install from [ollama.com](https://ollama.com)
- Run: `ollama serve`
- Pull a model: `ollama pull llama3.2:1b`

**Option B: OpenAI (Cloud, Paid)**
- Get API key from [platform.openai.com](https://platform.openai.com)
- Configure in app Settings

**Option C: Anthropic Claude (Cloud, Paid)**
- Get API key from [console.anthropic.com](https://console.anthropic.com)
- Configure in app Settings

## What is DSPy?

**DSPy** (Declarative Self-improving Python) is a framework from Stanford NLP for programmatically optimizing prompts and language model pipelines. Instead of manually tweaking prompts through trial and error, DSPy uses algorithms to automatically find better prompts based on your training data.

### How It Works

1. **You provide examples**: Input/output pairs showing what you want the model to do
2. **DSPy generates variations**: It creates different prompt versions and few-shot examples
3. **It evaluates each**: Tests them against your data using a metric
4. **Returns the best**: Gives you the optimized prompt that performed best

### Key Benefits

| Manual Prompting | DSPy Optimization |
|------------------|-------------------|
| Trial and error | Data-driven |
| Time-consuming | Automated |
| Subjective | Measurable |
| Hard to improve | Iterative |

---

## File Structure

```
renderer/
├── dspy-worker.js           # Node.js ↔ Python bridge
├── dspy-optimize-script.js  # Node UI implementation
└── dspy/
    ├── dspy_optimizer.py    # Python worker (runs DSPy)
    └── requirements.txt     # Python dependencies
```

---

## File Descriptions

### `dspy-worker.js` (370 lines)
**Purpose**: Bridge between Node.js (Electron) and Python

**What it does**:
- Spawns Python subprocess
- Sends configuration via stdin (JSON)
- Receives progress updates via stdout
- Handles errors and cancellation

**Key functions**:
```javascript
executeDSPyOptimization(config, onProgress, signal)  // Main optimization
checkDSPyEnvironment()                                // Check Python/DSPy
validateDSPyConfig(config)                            // Validate before run
```

### `dspy-optimize-script.js` (850 lines)
**Purpose**: Node UI for visual editor

**What it does**:
- Creates node data structure
- Renders node HTML on canvas
- Builds inspector UI (configuration panel)
- Handles connections and validation
- Executes optimization via bridge
- Displays results

**Key functions**:
```javascript
createDSPyOptimizeNodeData()          // Initialize node
renderDSPyOptimizeNode()              // Draw on canvas
renderDSPyOptimizeInspector()         // Configuration UI
isValidDSPyOptimizeConnection()       // Connection rules
executeDSPyOptimizeNode()             // Run optimization
```

### `dspy/dspy_optimizer.py` (678 lines)
**Purpose**: Python worker that runs actual DSPy

**What it does**:
- Configures language models (Ollama/OpenAI/Anthropic)
- Prepares datasets (converts to DSPy format)
- Creates metrics (exact_match, contains, custom)
- Runs optimizers (BootstrapFewShot, MIPRO)
- Extracts results (instructions, demos)
- Saves compiled programs

**Workflow**:
```python
1. Read config from stdin
2. Setup language model
3. Prepare dataset
4. Create metric
5. Run optimizer
6. Evaluate results
7. Return via stdout
```

### `dspy/requirements.txt`
**Purpose**: Python dependencies

```
dspy-ai>=2.6.0
cloudpickle>=2.0.0
```

Install with: `pip install -r renderer/dspy/requirements.txt`

---

## Integration Points in script.js

The DSPy node is integrated into the main app via these additions:

### 1. Import (line 24-30)
```javascript
const {
    createDSPyOptimizeNodeData,
    renderDSPyOptimizeNode,
    renderDSPyOptimizeInspector,
    isValidDSPyOptimizeConnection,
    executeDSPyOptimizeNode
} = require('./dspy-optimize-script');
```

### 2. Node Creation (line 263-264)
```javascript
} else if (type === 'dspy-optimize') {
    node.data = createDSPyOptimizeNodeData();
```

### 3. Node Rendering (line 425-426)
```javascript
} else if (node.type === 'dspy-optimize') {
    nodeEl.innerHTML = renderDSPyOptimizeNode(node, state.edges, state.nodes);
```

### 4. Inspector (line 886-895)
```javascript
} else if (node.type === 'dspy-optimize') {
    const inspector = renderDSPyOptimizeInspector(...);
    inspectorContent.innerHTML = inspector.html;
    inspector.setupListeners({...});
```

### 5. Connection Validation (line 565-568)
```javascript
if (isValidDSPyOptimizeConnection(sourceNode, sourcePin, targetNode, targetPin, state.edges)) {
    return true;
}
```

### 6. Execution (line 1685-1695)
```javascript
} else if (optimizeNode.type === 'dspy-optimize') {
    await executeDSPyOptimizeNode(...);
}
```

### 7. HTML Sidebar (index.html line 75-77)
```html
<div class="node-item" data-node-type="dspy-optimize" draggable="true">
    DSPy Optimize
</div>
```

---

## How to Use the DSPy Node

### Node Configuration Panel

When you select the DSPy node, the inspector panel shows these options:

#### 1. **MIPRO Mode** (Light/Medium/Heavy)
Controls the thoroughness of optimization. This affects how many instruction candidates are tested.
- **Light**: ~30 trials, 5-10 minutes
- **Medium**: More trials, better results, 15-30 minutes
- **Heavy**: Maximum trials, best results, 30-60 minutes

#### 2. **Program Type**
Defines how the model responds:
- **Predict**: Direct answer (most common)
- **Chain of Thought**: Shows reasoning steps before answer
- **ReAct**: For complex tasks with reasoning and actions

#### 3. **Metric Type**
How DSPy evaluates if outputs are correct:
- **exact_match**: Output must exactly match expected answer
- **contains**: Expected answer must appear somewhere in output
- **semantic_f1**: Measures semantic similarity (word overlap)

#### 4. **Training Dataset**
JSON array of input/output pairs. Format:
```json
[
  {"input": "your question", "output": "expected answer"},
  {"input": "another question", "output": "expected answer"}
]
```
Minimum: 1 example (recommended: 8-20 for Light mode)

#### 5. **Validation Dataset** (optional)
Separate test set to measure performance. If empty, DSPy auto-splits 20% from training data.

#### 6. **Run Button**
Starts the optimization process. The node will:
1. Send your dataset to DSPy
2. Test different instruction variations
3. Select best few-shot demonstrations
4. Report validation score

#### 7. **Apply Button**
Copies the optimized instruction to your connected Prompt node. Use this after optimization succeeds.

### Workflow

```
1. Configure Model → 2. Add Examples → 3. Click Run → 4. Review Score → 5. Click Apply
```

After applying, your Prompt node will have an optimized system prompt that performs better on similar tasks.

---

## Configuration Options

### MIPRO Mode

The node uses **MIPROv2** (Multi-prompt Instruction Proposal Optimizer) which optimizes both instructions and few-shot demonstrations using Bayesian optimization.

| Mode | Speed | Best For | Description |
|------|-------|----------|-------------|
| Light | Fast (5-10 min) | 5-20 examples | Quick optimization, fewer trials |
| Medium | Moderate (15-30 min) | 20-100 examples | Balanced performance |
| Heavy | Slow (30-60 min) | 100+ examples | Thorough search, best results |

**Recommendation**: Start with Light mode, upgrade to Heavy for production.

### Program Types

| Type | Description | Use Case |
|------|-------------|----------|
| Predict | Direct answer | Simple Q&A, classification |
| Chain of Thought | Shows reasoning steps | Math problems, logical reasoning |
| ReAct | Reasoning + actions | Complex multi-step tasks |

**Recommendation**: Use Predict for most tasks, Chain of Thought for tasks requiring explanation.

### Metrics

The metric determines how DSPy evaluates if an output is correct:

| Metric | Use Case | Example |
|--------|----------|---------|
| exact_match | Precise answers required | "4" = "4" ✓, "4.0" = "4" ✗ |
| contains | Flexible matching | "4" in "The answer is 4" ✓ |
| semantic_f1 | Meaning similarity | Compares semantic overlap |

**Recommendation**: Use exact_match for single-word answers, contains for natural language.

---

## Quick Start Guide

### Setup Flow
1. Add **Prompt** node → **Model** node → **DSPy** node to canvas
2. Connect them: Prompt.prompt → Model.prompt, Model.output → DSPy.input
3. Configure model (e.g., Ollama with llama3.2:1b)
4. Add training data to DSPy node
5. Click **Run** to optimize
6. Click **Apply** to copy optimized instruction to Prompt node

---

## Examples to Try

### Example 1: Simple Math (5 minutes)

**Goal**: Optimize a prompt for basic arithmetic

**Setup**:
- **MIPRO Mode**: Light
- **Program Type**: Predict
- **Metric**: exact_match

**Training Dataset**:
```json
[
  {"input": "What is 2+2?", "output": "4"},
  {"input": "What is 3+3?", "output": "6"},
  {"input": "What is 5+5?", "output": "10"},
  {"input": "What is 7+7?", "output": "14"},
  {"input": "What is 9+9?", "output": "18"},
  {"input": "What is 4+4?", "output": "8"},
  {"input": "What is 6+6?", "output": "12"},
  {"input": "What is 8+8?", "output": "16"}
]
```

**Expected Results**:
- Validation score: ~80-100%
- DSPy will generate an optimized instruction like "Answer with just the number"
- 3-4 few-shot demonstrations will be selected

---

### Example 2: Capital Cities (5 minutes)

**Goal**: Create a geography quiz bot

**Setup**:
- **MIPRO Mode**: Light
- **Program Type**: Predict
- **Metric**: exact_match

**Training Dataset**:
```json
[
  {"input": "What is the capital of France?", "output": "Paris"},
  {"input": "What is the capital of Germany?", "output": "Berlin"},
  {"input": "What is the capital of Italy?", "output": "Rome"},
  {"input": "What is the capital of Spain?", "output": "Madrid"},
  {"input": "What is the capital of Japan?", "output": "Tokyo"},
  {"input": "What is the capital of Brazil?", "output": "Brasilia"},
  {"input": "What is the capital of Canada?", "output": "Ottawa"},
  {"input": "What is the capital of Australia?", "output": "Canberra"}
]
```

**Expected Results**:
- Validation score: ~90-100%
- Optimized to answer with just the city name

---

### Example 3: Sentiment Analysis (5 minutes)

**Goal**: Classify customer feedback sentiment

**Setup**:
- **MIPRO Mode**: Light
- **Program Type**: Predict
- **Metric**: exact_match

**Training Dataset**:
```json
[
  {"input": "I love this product!", "output": "positive"},
  {"input": "Terrible experience", "output": "negative"},
  {"input": "It's okay I guess", "output": "neutral"},
  {"input": "Best purchase ever!", "output": "positive"},
  {"input": "Complete waste of money", "output": "negative"},
  {"input": "Does what it's supposed to", "output": "neutral"},
  {"input": "Absolutely fantastic!", "output": "positive"},
  {"input": "Very disappointed", "output": "negative"}
]
```

**Expected Results**:
- Validation score: ~70-90%
- DSPy learns to classify emotional tone

---

### Example 4: Customer Support Routing (10 minutes)

**Goal**: Automatically categorize support tickets

**Setup**:
- **MIPRO Mode**: Light
- **Program Type**: Predict
- **Metric**: contains (more flexible for category names)

**Training Dataset**:
```json
[
  {"input": "How do I reset my password?", "output": "account"},
  {"input": "My order hasn't arrived", "output": "shipping"},
  {"input": "I want a refund", "output": "billing"},
  {"input": "Can't log into my account", "output": "account"},
  {"input": "Where is my package?", "output": "shipping"},
  {"input": "Charged me incorrectly", "output": "billing"},
  {"input": "Change my email address", "output": "account"},
  {"input": "Tracking number not working", "output": "shipping"},
  {"input": "Cancel my subscription", "output": "billing"},
  {"input": "Two-factor authentication help", "output": "account"}
]
```

**Why use "contains" metric?**: It allows the model to output "billing issue" or "billing" and both match.

---

### Example 5: Word Problems with Reasoning (10 minutes)

**Goal**: Solve math word problems with step-by-step reasoning

**Setup**:
- **MIPRO Mode**: Light
- **Program Type**: chain_of_thought (shows reasoning!)
- **Metric**: contains

**Training Dataset**:
```json
[
  {"input": "If I have 5 apples and give away 2, how many do I have?", "output": "3"},
  {"input": "A book costs $12. I have $20. How much change?", "output": "8"},
  {"input": "3 friends share 15 candies equally. How many each?", "output": "5"},
  {"input": "I read 10 pages per day for 7 days. Total pages?", "output": "70"},
  {"input": "A pizza has 8 slices. 3 are eaten. How many left?", "output": "5"},
  {"input": "Buy 4 items at $3 each. Total cost?", "output": "12"}
]
```

**What's different?**: Chain of Thought makes the model explain its reasoning before answering.

---

### Example 6: Advanced Optimization (20+ minutes)

**Goal**: Maximum accuracy on larger dataset

**Setup**:
- **MIPRO Mode**: Heavy (thorough search)
- **Program Type**: Predict or chain_of_thought
- **Metric**: Choose based on task

**Training Dataset**: Use 20-50 examples from any category above

**Results**: Heavy mode runs more trials, tests more instruction candidates, and typically achieves 5-15% higher accuracy than Light mode.

---

## Prerequisites

### Python Setup
```bash
# Check Python version (need 3.8+)
python --version

# Install DSPy
pip install dspy-ai

# Verify
python -c "import dspy; print(dspy.__version__)"
```

### Ollama (for local models)
```bash
# Start Ollama server
ollama serve

# Pull a model
ollama pull llama3.2:1b
```

### Or use OpenAI
Configure API key in app Settings

---

## Troubleshooting

### "Python not found"
**Solution**: Install Python 3.8+ from python.org and ensure it's in your PATH

### "DSPy not installed"
**Solution**: Run in terminal:
```bash
pip install dspy-ai
```

### "Connection refused" (Ollama)
**Solution**: Make sure Ollama is running:
```bash
ollama serve
```

### Low validation scores (<50%)
**Possible causes**:
1. **Inconsistent outputs**: Check that all expected outputs follow same format
2. **Wrong metric**: Try `contains` instead of `exact_match`
3. **Too few examples**: Add more diverse examples (aim for 10+)
4. **Weak model**: Try a larger model (e.g., llama3.2:3b instead of :1b)

**Try this**:
- Switch metric to `contains`
- Add 5-10 more examples
- Upgrade to Medium or Heavy mode

### Optimization takes too long
**Solution**:
- Use Light mode (fastest, ~5-10 min)
- Reduce training dataset to 10-15 examples
- Use a faster/smaller model for optimization

### "No model node connected" error
**Solution**: Connect the flow: Prompt → Model → DSPy
- Drag connection from Model's "output" pin to DSPy's "input" pin

### Node shows "error" status
**Check the logs panel** (bottom of screen) for specific error messages. Common issues:
- JSON syntax error in dataset
- Model API key missing
- Ollama model not pulled (`ollama pull llama3.2:1b`)

---

## How It All Works Together

When you click **Run**, here's what happens:

1. **Node collects config**: Your dataset, metric, MIPRO mode, etc.
2. **Spawns Python worker**: Launches `dspy_optimizer.py` as subprocess
3. **DSPy runs optimization**: Tests multiple instruction variations using Bayesian optimization
4. **Progress updates**: Real-time logs appear in the logs panel
5. **Results return**: Validation score, optimized instruction, and demos
6. **Apply to Prompt**: Click **Apply** to update your Prompt node with the optimized instruction

The entire process keeps your UI responsive with progress updates every few seconds.

---

## Tips for Best Results

1. **Start with Light mode**: Test with 8-10 examples before scaling up
2. **Consistent output format**: Keep answers in same style (all lowercase, same units, etc.)
3. **Diverse inputs**: Cover different phrasings and edge cases
4. **Choose the right metric**:
   - `exact_match`: Single-word answers (numbers, categories)
   - `contains`: Natural language, sentences
   - `semantic_f1`: When meaning matters more than exact words
5. **Iterate**: Check validation score → add more examples → try Medium/Heavy mode
6. **Use validation set**: Split 80/20 train/val for more reliable scores
7. **Chain of Thought**: Use for math or logic tasks requiring explanation

---

## Learn More

- [DSPy Documentation](https://dspy.ai)
- [DSPy GitHub](https://github.com/stanfordnlp/dspy)
- [DSPy Paper](https://arxiv.org/abs/2310.03714)
