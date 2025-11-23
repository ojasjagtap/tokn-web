#!/usr/bin/env python3
"""
GEPA (MLflow) Optimization Worker
Runs MLflow GEPA prompt optimization and returns results to Node.js

Communication Protocol:
- Input: JSON configuration via stdin
- Output: JSON messages via stdout (line-delimited)

Message Types:
- {'type': 'progress', 'message': '...', 'data': {...}}
- {'type': 'success', 'initial_score': 0.5, 'final_score': 0.85, ...}
- {'type': 'error', 'message': '...', 'traceback': '...'}
"""

import sys
import json
import os
import tempfile
from typing import List, Dict, Any, Callable, Optional
import traceback


def log_progress(message: str, data: Optional[Dict] = None):
    """Send progress message to Node.js"""
    progress = {'type': 'progress', 'message': message}
    if data:
        progress['data'] = data
    print(json.dumps(progress), flush=True)


def log_error(message: str, tb: Optional[str] = None):
    """Send error message to Node.js"""
    error = {'type': 'error', 'message': message}
    if tb:
        error['traceback'] = tb
    print(json.dumps(error), flush=True)


# ============================================================================
# LANGUAGE MODEL CONFIGURATION
# ============================================================================

def get_model_client(config: Dict[str, Any]):
    """
    Get appropriate model client based on provider

    Args:
        config: {
            'provider': 'ollama' | 'openai' | 'anthropic' | 'google',
            'model': 'model-name',
            'api_key': 'optional-api-key',
            'api_base': 'optional-base-url'
        }

    Returns:
        Configured client instance
    """
    provider = config.get('provider', 'ollama')
    api_key = config.get('api_key', '')
    api_base = config.get('api_base')

    if provider == 'openai':
        import openai
        client_config = {}
        if api_key:
            client_config['api_key'] = api_key
        if api_base:
            client_config['base_url'] = api_base
        return openai.OpenAI(**client_config)

    elif provider == 'anthropic':
        import anthropic
        client_config = {}
        if api_key:
            client_config['api_key'] = api_key
        else:
            api_key = os.environ.get('ANTHROPIC_API_KEY', '')
            if api_key:
                client_config['api_key'] = api_key
        return anthropic.Anthropic(**client_config)

    elif provider == 'google':
        import google.generativeai as genai
        if api_key:
            genai.configure(api_key=api_key)
        else:
            api_key = os.environ.get('GOOGLE_API_KEY', '')
            if api_key:
                genai.configure(api_key=api_key)
        return genai

    elif provider == 'ollama':
        import openai
        base_url = api_base or 'http://localhost:11434/v1'
        return openai.OpenAI(base_url=base_url, api_key='ollama')

    else:
        raise ValueError(f"Unsupported provider: {provider}")


def create_predict_fn(model_config: Dict[str, Any], prompt_template: str, input_key: str = 'question'):
    """
    Create prediction function for MLflow optimization

    Args:
        model_config: Model configuration dict
        prompt_template: Initial prompt template with {{placeholders}}
        input_key: Key name for input in dataset (e.g., 'question', 'sentence')

    Returns:
        Prediction function: (input_value: str) -> str
    """
    provider = model_config.get('provider', 'ollama')
    model_id = model_config.get('model')
    client = get_model_client(model_config)

    def predict_fn(**kwargs) -> str:
        """Generic prediction function"""
        # Get the input value from kwargs
        input_value = kwargs.get(input_key, '')

        # Format the prompt template with the input
        formatted_prompt = prompt_template.replace(f'{{{{{input_key}}}}}', input_value)

        # Call the appropriate model
        if provider == 'openai' or provider == 'ollama':
            completion = client.chat.completions.create(
                model=model_id,
                messages=[{"role": "user", "content": formatted_prompt}],
                temperature=0.0
            )
            return completion.choices[0].message.content

        elif provider == 'anthropic':
            message = client.messages.create(
                model=model_id,
                max_tokens=1024,
                messages=[{"role": "user", "content": formatted_prompt}],
                temperature=0.0
            )
            return message.content[0].text

        elif provider == 'google':
            model = client.GenerativeModel(model_id)
            response = model.generate_content(formatted_prompt)
            return response.text

        else:
            raise ValueError(f"Unsupported provider: {provider}")

    return predict_fn


# ============================================================================
# DATASET PREPARATION
# ============================================================================

def prepare_dataset(dataset_raw: List[Dict[str, Any]], dataset_name: str = "dataset") -> List[Dict[str, Any]]:
    """
    Validate and prepare dataset for MLflow GEPA

    Args:
        dataset_raw: List of {'inputs': {...}, 'expectations': {'expected_response': '...'}}
        dataset_name: Name for logging

    Returns:
        Validated dataset list
    """
    if not dataset_raw or len(dataset_raw) == 0:
        raise ValueError(f"{dataset_name} is empty")

    validated_dataset = []

    for i, item in enumerate(dataset_raw):
        if 'inputs' not in item:
            raise ValueError(f"{dataset_name}[{i}] missing 'inputs' field")
        if 'expectations' not in item:
            raise ValueError(f"{dataset_name}[{i}] missing 'expectations' field")
        if 'expected_response' not in item['expectations']:
            raise ValueError(f"{dataset_name}[{i}].expectations missing 'expected_response' field")

        validated_dataset.append(item)

    return validated_dataset


# ============================================================================
# SCORER CREATION
# ============================================================================

def create_scorers(scorer_config: Dict[str, Any]) -> List:
    """
    Create MLflow scorers based on configuration

    Args:
        scorer_config: {
            'scorers': [
                {'type': 'correctness', 'model': 'openai/gpt-4-mini', 'weight': 0.7},
                {'type': 'safety', 'model': 'openai/gpt-4-mini', 'weight': 0.3}
            ]
        }

    Returns:
        List of MLflow scorer instances
    """
    from mlflow.genai.scorers import Correctness, Safety

    scorers = []
    scorer_list = scorer_config.get('scorers', [])

    if not scorer_list:
        # Default to Correctness scorer
        scorer_list = [{'type': 'correctness', 'model': 'openai/gpt-4-mini'}]

    for scorer_def in scorer_list:
        scorer_type = scorer_def.get('type', 'correctness')
        scorer_model = scorer_def.get('model', 'openai/gpt-4-mini')

        if scorer_type == 'correctness':
            scorers.append(Correctness(model=scorer_model))
        elif scorer_type == 'safety':
            scorers.append(Safety(model=scorer_model))
        else:
            log_progress(f"Unknown scorer type '{scorer_type}', skipping")

    return scorers


def create_aggregation_fn(scorer_config: Dict[str, Any]) -> Optional[Callable]:
    """
    Create aggregation function for multi-objective optimization

    Args:
        scorer_config: {
            'aggregation': 'weighted',
            'weights': {'correctness': 0.7, 'safety': 0.3}
        }

    Returns:
        Aggregation function or None for default
    """
    aggregation = scorer_config.get('aggregation', 'average')
    weights = scorer_config.get('weights', {})

    if aggregation == 'weighted' and weights:
        def weighted_aggregation(scores: Dict[str, float]) -> float:
            """Weighted sum of scorer results"""
            total = 0.0
            total_weight = 0.0

            for scorer_name, score in scores.items():
                # Extract base scorer name (e.g., 'Correctness' from full name)
                base_name = scorer_name.lower().split('(')[0].strip()
                weight = weights.get(base_name, 1.0)
                total += score * weight
                total_weight += weight

            return total / total_weight if total_weight > 0 else 0.0

        return weighted_aggregation

    # Default to average
    return None


# ============================================================================
# MLFLOW PROMPT REGISTRY
# ============================================================================

def register_prompt_with_mlflow(prompt_name: str, prompt_template: str) -> Any:
    """
    Register prompt with MLflow prompt registry

    Args:
        prompt_name: Unique name for the prompt
        prompt_template: Prompt template text with {{placeholders}}

    Returns:
        Registered prompt object with .uri attribute
    """
    import mlflow

    try:
        # Register the prompt
        prompt = mlflow.genai.register_prompt(
            name=prompt_name,
            template=prompt_template
        )
        log_progress(f"Registered prompt '{prompt_name}' with MLflow")
        return prompt
    except Exception as e:
        # If registration fails (e.g., name exists), try to load it
        log_progress(f"Prompt registration failed, attempting to load: {str(e)}")
        try:
            # Load existing prompt
            prompt = mlflow.genai.load_prompt(f"prompts:/{prompt_name}/latest")
            log_progress(f"Loaded existing prompt '{prompt_name}'")
            return prompt
        except:
            raise RuntimeError(f"Failed to register or load prompt: {str(e)}")


# ============================================================================
# GEPA OPTIMIZATION
# ============================================================================

def run_gepa_optimization(
    predict_fn: Callable,
    train_data: List[Dict[str, Any]],
    prompt_uri: str,
    reflection_model: str,
    max_metric_calls: int,
    scorers: List,
    aggregation: Optional[Callable] = None
) -> Any:
    """
    Run GEPA optimization using MLflow

    Args:
        predict_fn: Prediction function
        train_data: Training dataset
        prompt_uri: URI of registered prompt
        reflection_model: Model to use for reflection (e.g., 'openai/gpt-4')
        max_metric_calls: Maximum number of metric evaluations
        scorers: List of MLflow scorers
        aggregation: Optional aggregation function for multi-objective

    Returns:
        PromptOptimizationResult object
    """
    import mlflow
    from mlflow.genai.optimize import GepaPromptOptimizer

    log_progress(f"Starting GEPA optimization with reflection model: {reflection_model}")
    log_progress(f"Max metric calls: {max_metric_calls}")
    log_progress(f"Training examples: {len(train_data)}")

    # Create GEPA optimizer
    optimizer = GepaPromptOptimizer(
        reflection_model=reflection_model,
        max_metric_calls=max_metric_calls,
        display_progress_bar=False  # We'll handle progress ourselves
    )

    # Build optimization arguments
    optimize_args = {
        'predict_fn': predict_fn,
        'train_data': train_data,
        'prompt_uris': [prompt_uri],
        'optimizer': optimizer,
        'scorers': scorers
    }

    # Add aggregation if provided
    if aggregation:
        optimize_args['aggregation'] = aggregation

    log_progress("Running GEPA optimization (this may take several minutes)...")

    # Run optimization
    result = mlflow.genai.optimize_prompts(**optimize_args)

    log_progress("Optimization complete")

    return result


# ============================================================================
# RESULT EXTRACTION
# ============================================================================

def extract_optimization_results(result: Any) -> Dict[str, Any]:
    """
    Extract results from MLflow PromptOptimizationResult

    Args:
        result: PromptOptimizationResult object

    Returns:
        Dictionary with extracted results
    """
    extracted = {
        'initial_score': 0.0,
        'final_score': 0.0,
        'optimized_prompt_text': '',
        'optimizer_name': '',
        'iterations': 0
    }

    try:
        # Extract scores
        if hasattr(result, 'initial_eval_score'):
            extracted['initial_score'] = float(result.initial_eval_score)

        if hasattr(result, 'final_eval_score'):
            extracted['final_score'] = float(result.final_eval_score)

        # Extract optimizer name
        if hasattr(result, 'optimizer_name'):
            extracted['optimizer_name'] = str(result.optimizer_name)

        # Extract optimized prompts
        if hasattr(result, 'optimized_prompts') and result.optimized_prompts:
            optimized_prompt = result.optimized_prompts[0]

            # Get the template text
            if hasattr(optimized_prompt, 'template'):
                extracted['optimized_prompt_text'] = str(optimized_prompt.template)
            elif hasattr(optimized_prompt, 'text'):
                extracted['optimized_prompt_text'] = str(optimized_prompt.text)
            else:
                # Try to convert to string
                extracted['optimized_prompt_text'] = str(optimized_prompt)

        # Try to estimate iterations from result (if available)
        if hasattr(result, 'iterations'):
            extracted['iterations'] = int(result.iterations)
        elif hasattr(result, 'num_iterations'):
            extracted['iterations'] = int(result.num_iterations)

        log_progress(f"Extracted results: initial={extracted['initial_score']:.3f}, final={extracted['final_score']:.3f}")

    except Exception as e:
        log_progress(f"Warning: Could not fully extract results: {str(e)}")
        import traceback
        log_progress(f"Traceback: {traceback.format_exc()}")

    return extracted


# ============================================================================
# MAIN OPTIMIZATION WORKFLOW
# ============================================================================

def main():
    """Main optimization workflow"""

    try:
        # Step 1: Read configuration from stdin
        config_json = sys.stdin.read()

        if not config_json or not config_json.strip():
            raise ValueError("No configuration received on stdin")

        config = json.loads(config_json)

        # Step 2: Import MLflow (check if installed)
        try:
            import mlflow
            from mlflow.genai.optimize import GepaPromptOptimizer
            from mlflow.genai.scorers import Correctness, Safety
        except ImportError as e:
            raise ImportError(
                "MLflow library not found. Please install it with: pip install mlflow>=3.5.0"
            )

        # Step 3: Initialize MLflow tracking (required for prompt registry)
        # Use a local directory for tracking
        mlruns_dir = os.path.join(tempfile.gettempdir(), 'mlflow_gepa_tracking')
        os.makedirs(mlruns_dir, exist_ok=True)

        # Format tracking URI for cross-platform compatibility
        # Convert Windows path separators to forward slashes for file URI
        tracking_path = mlruns_dir.replace('\\', '/')
        # Use file:/// (three slashes) for local file URIs
        mlflow.set_tracking_uri(f"file:///{tracking_path}")
        log_progress(f"Initialized MLflow tracking at: {mlruns_dir}")

        # Create or set experiment (required for optimization tracking)
        experiment_name = "gepa_optimization"
        try:
            experiment = mlflow.get_experiment_by_name(experiment_name)
            if experiment is None:
                experiment_id = mlflow.create_experiment(experiment_name)
                log_progress(f"Created MLflow experiment: {experiment_name}")
            else:
                experiment_id = experiment.experiment_id
                log_progress(f"Using existing MLflow experiment: {experiment_name}")
            mlflow.set_experiment(experiment_name)
        except Exception as e:
            log_progress(f"Warning: Could not set experiment: {str(e)}")
            # Continue anyway - MLflow will use default experiment

        # Step 4: Prepare dataset
        log_progress("Preparing dataset...")
        train_data = prepare_dataset(config['train_dataset'], 'train_dataset')

        # Step 5: Extract initial prompt template
        initial_prompt = config.get('initial_prompt', 'Answer the following question: {{question}}')
        log_progress(f"Initial prompt template: {initial_prompt[:100]}...")

        # Step 6: Determine input key from dataset
        # Extract the first input key from the dataset
        input_key = 'question'  # default
        if train_data and 'inputs' in train_data[0]:
            input_keys = list(train_data[0]['inputs'].keys())
            if input_keys:
                input_key = input_keys[0]
                log_progress(f"Detected input key: {input_key}")

        # Step 7: Register prompt with MLflow
        prompt_name = config.get('prompt_name', f'gepa_prompt_{os.getpid()}')
        prompt = register_prompt_with_mlflow(prompt_name, initial_prompt)

        # Step 8: Create prediction function
        log_progress("Creating prediction function...")
        model_config = config['model_config']

        # We need to create a predict_fn that MLflow can call
        # The predict_fn will be called with kwargs matching the 'inputs' in train_data
        def predict_fn(**kwargs) -> str:
            """Prediction function for MLflow"""
            # Load the current prompt (MLflow will update it during optimization)
            current_prompt = mlflow.genai.load_prompt(prompt.uri)
            formatted = current_prompt.format(**kwargs)

            # Call the model
            provider = model_config.get('provider', 'ollama')
            model_id = model_config.get('model')
            client = get_model_client(model_config)

            if provider == 'openai' or provider == 'ollama':
                completion = client.chat.completions.create(
                    model=model_id,
                    messages=[{"role": "user", "content": formatted}],
                    temperature=0.0
                )
                return completion.choices[0].message.content

            elif provider == 'anthropic':
                message = client.messages.create(
                    model=model_id,
                    max_tokens=1024,
                    messages=[{"role": "user", "content": formatted}],
                    temperature=0.0
                )
                return message.content[0].text

            elif provider == 'google':
                model = client.GenerativeModel(model_id)
                response = model.generate_content(formatted)
                return response.text

            else:
                raise ValueError(f"Unsupported provider: {provider}")

        # Step 9: Create scorers
        log_progress("Creating scorers...")
        scorer_config = config.get('scorer_config', {'scorers': [{'type': 'correctness'}]})
        scorers = create_scorers(scorer_config)
        aggregation = create_aggregation_fn(scorer_config)

        log_progress(f"Using {len(scorers)} scorer(s)")

        # Step 10: Run GEPA optimization
        reflection_model = config.get('reflection_model', 'openai/gpt-4')
        max_metric_calls = config.get('max_metric_calls', 300)

        result = run_gepa_optimization(
            predict_fn=predict_fn,
            train_data=train_data,
            prompt_uri=prompt.uri,
            reflection_model=reflection_model,
            max_metric_calls=max_metric_calls,
            scorers=scorers,
            aggregation=aggregation
        )

        # Step 11: Extract results
        extracted = extract_optimization_results(result)

        # Step 12: Return success result
        improvement = extracted['final_score'] - extracted['initial_score']
        log_progress(f"Optimization complete! Score improved by {improvement:+.3f}")

        success_result = {
            'type': 'success',
            'initial_score': extracted['initial_score'],
            'final_score': extracted['final_score'],
            'optimized_prompt_text': extracted['optimized_prompt_text'],
            'optimizer_name': extracted.get('optimizer_name', 'GEPA'),
            'iterations': extracted.get('iterations', 0),
            'dataset_size': len(train_data),
            'reflection_model': reflection_model,
            'max_metric_calls': max_metric_calls
        }

        print(json.dumps(success_result), flush=True)
        sys.exit(0)

    except Exception as e:
        # Catch all exceptions and return error
        error_msg = str(e)
        error_trace = traceback.format_exc()

        log_error(error_msg, error_trace)
        sys.exit(1)


if __name__ == '__main__':
    main()
