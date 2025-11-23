# GEPA Prompt Optimization

This module implements MLflow GEPA (Genetic Evolutionary Prompt Algorithm) optimization for the Prompt IDE.

## Installation

Install the required dependencies:

```bash
pip install -r requirements.txt
```

## Usage

The optimizer is called via the Node.js worker bridge (`gepa-worker.js`) which spawns this Python script as a subprocess.

### Configuration Format

The script expects JSON configuration via stdin:

```json
{
  "model_config": {
    "provider": "openai",
    "model": "gpt-4",
    "api_key": "sk-..."
  },
  "initial_prompt": "Answer the question: {{question}}",
  "reflection_model": "openai/gpt-4",
  "max_metric_calls": 300,
  "scorer_config": {
    "scorers": [
      {"type": "correctness", "model": "openai/gpt-4-mini", "weight": 0.7},
      {"type": "safety", "model": "openai/gpt-4-mini", "weight": 0.3}
    ],
    "aggregation": "weighted",
    "weights": {
      "correctness": 0.7,
      "safety": 0.3
    }
  },
  "train_dataset": [
    {
      "inputs": {"question": "What is 2+2?"},
      "expectations": {"expected_response": "4"}
    }
  ],
  "prompt_name": "my_prompt",
  "mlflow_tracking_uri": "http://localhost:5000",
  "experiment_name": "prompt_optimization"
}
```

### Output Format

The script outputs JSON messages to stdout:

**Progress:**
```json
{"type": "progress", "message": "Starting optimization...", "data": {}}
```

**Success:**
```json
{
  "type": "success",
  "initial_score": 0.5,
  "final_score": 0.85,
  "optimized_prompt_text": "...",
  "optimizer_name": "GEPA",
  "iterations": 150,
  "dataset_size": 50
}
```

**Error:**
```json
{
  "type": "error",
  "message": "Error description",
  "traceback": "..."
}
```

## Features

- **Multi-provider support:** OpenAI, Anthropic, Google, Ollama
- **MLflow integration:** Prompt registry and tracking
- **Multiple scorers:** Correctness, Safety, custom scorers
- **Multi-objective optimization:** Weighted aggregation
- **Progress reporting:** Real-time updates during optimization

## How GEPA Works

GEPA (Genetic Evolutionary Prompt Algorithm) uses:
1. **LLM-based reflection:** An LLM analyzes failures and suggests improvements
2. **Evolutionary search:** Maintains a Pareto front of candidates to avoid local optima
3. **Iterative refinement:** Systematically improves prompts based on training data
4. **Data-driven:** Uses actual examples to guide optimization

The algorithm typically achieves 10-20% improvement over baseline prompts.
