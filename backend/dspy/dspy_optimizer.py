#!/usr/bin/env python3
"""
DSPy Optimization Worker
Runs actual DSPy optimization and returns results to Node.js

Communication Protocol:
- Input: JSON configuration via stdin
- Output: JSON messages via stdout (line-delimited)

Message Types:
- {'type': 'progress', 'message': '...', 'data': {...}}
- {'type': 'success', 'validation_score': 0.85, ...}
- {'type': 'error', 'message': '...', 'traceback': '...'}
"""

import sys
import json
import os
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

def setup_language_model(config: Dict[str, Any]):
    """
    Configure DSPy language model based on config

    Args:
        config: {
            'provider': 'ollama' | 'openai' | 'anthropic',
            'model': 'model-name',
            'api_key': 'optional-api-key',
            'api_base': 'optional-base-url'
        }

    Returns:
        Configured DSPy LM instance
    """
    import dspy

    provider = config.get('provider', 'openai')
    model_id = config.get('model', 'gpt-4o-mini')
    api_key = config.get('api_key', '')
    api_base = config.get('api_base')

    if provider == 'openai':
        # OpenAI models
        if not api_key:
            # Try environment variable
            api_key = os.environ.get('OPENAI_API_KEY', '')

        lm = dspy.LM(
            model=f'openai/{model_id}',
            api_key=api_key
        )

    elif provider == 'anthropic':
        # Anthropic Claude models
        if not api_key:
            api_key = os.environ.get('ANTHROPIC_API_KEY', '')

        lm = dspy.LM(
            model=f'anthropic/{model_id}',
            api_key=api_key
        )

    else:
        raise ValueError(f"Unsupported provider: {provider}. Use 'openai' or 'anthropic'.")

    # Configure DSPy to use this model
    dspy.configure(lm=lm)

    return lm


# ============================================================================
# DATASET PREPARATION
# ============================================================================

def prepare_dataset(dataset_raw: List[Dict[str, Any]], dataset_name: str = "dataset") -> List:
    """
    Convert raw dataset to DSPy Examples

    Args:
        dataset_raw: List of {'input': '...', 'output': '...'}
        dataset_name: Name for logging

    Returns:
        List of dspy.Example objects
    """
    import dspy

    if not dataset_raw or len(dataset_raw) == 0:
        raise ValueError(f"{dataset_name} is empty")

    examples = []

    for i, item in enumerate(dataset_raw):
        if 'input' not in item or 'output' not in item:
            raise ValueError(f"{dataset_name}[{i}] missing 'input' or 'output' field")

        # Create DSPy Example with question -> answer signature
        # .with_inputs() marks which fields are inputs (vs outputs)
        example = dspy.Example(
            question=str(item['input']),
            answer=str(item['output'])
        ).with_inputs('question')

        examples.append(example)

    return examples


# ============================================================================
# METRIC CREATION
# ============================================================================

def create_metric(metric_config: Dict[str, Any]) -> Callable:
    """
    Create metric function based on configuration

    Args:
        metric_config: {
            'type': 'exact_match' | 'semantic_f1' | 'contains'
        }

    Returns:
        Metric function: (example, prediction, trace) -> float/bool
    """
    import dspy

    metric_type = metric_config.get('type', 'exact_match')

    if metric_type == 'exact_match':
        # Simple exact string match metric (case-insensitive)
        def exact_match_metric(example, pred, trace=None):
            """Exact match between expected and predicted answer"""
            if not hasattr(pred, 'answer'):
                return False

            expected = str(example.answer).strip().lower()
            predicted = str(pred.answer).strip().lower()

            return expected == predicted

        return exact_match_metric

    elif metric_type == 'contains':
        # Check if expected answer is contained in prediction (case-insensitive)
        def contains_metric(example, pred, trace=None):
            """Check if expected answer is contained in prediction"""
            if not hasattr(pred, 'answer'):
                return False

            expected = str(example.answer).strip().lower()
            predicted = str(pred.answer).strip().lower()

            return expected in predicted

        return contains_metric

    elif metric_type == 'semantic_f1':
        # Use DSPy's built-in SemanticF1 metric
        # This compares semantic similarity using embeddings
        try:
            from dspy.evaluate import SemanticF1
            return SemanticF1()
        except ImportError:
            log_progress("SemanticF1 not available, falling back to exact match")
            return create_metric({'type': 'exact_match'})

    else:
        raise ValueError(f"Unknown metric type: {metric_type}. Use 'exact_match', 'contains', or 'semantic_f1'.")


# ============================================================================
# DSPY PROGRAM DEFINITION
# ============================================================================

def create_dspy_program(program_type: str = 'predict', initial_instruction: str = '') -> Any:
    """
    Create DSPy program/module based on type

    Args:
        program_type: 'predict' | 'chain_of_thought' | 'react'
        initial_instruction: Initial system prompt/instruction to use

    Returns:
        DSPy Module instance
    """
    import dspy

    # Create signature with initial instruction if provided
    if initial_instruction:
        # Create a signature with instructions parameter
        # This is the correct DSPy 3.x way to set instructions that can be optimized
        signature = dspy.Signature(
            "question -> answer",
            instructions=initial_instruction
        )
    else:
        signature = "question -> answer"

    if program_type == 'predict':
        # Simple prediction module
        class SimpleQA(dspy.Module):
            def __init__(self):
                super().__init__()
                self.predict = dspy.Predict(signature)

            def forward(self, question):
                return self.predict(question=question)

        return SimpleQA()

    elif program_type == 'chain_of_thought':
        # Chain of thought reasoning
        class ChainOfThoughtQA(dspy.Module):
            def __init__(self):
                super().__init__()
                self.generate_answer = dspy.ChainOfThought(signature)

            def forward(self, question):
                return self.generate_answer(question=question)

        return ChainOfThoughtQA()

    elif program_type == 'react':
        # ReAct (Reasoning + Acting)
        class ReActQA(dspy.Module):
            def __init__(self):
                super().__init__()
                self.generate_answer = dspy.ReAct(signature)

            def forward(self, question):
                return self.generate_answer(question=question)

        return ReActQA()

    else:
        # Default to simple predict
        log_progress(f"Unknown program type '{program_type}', using 'predict'")
        return create_dspy_program('predict', initial_instruction)


# ============================================================================
# OPTIMIZERS
# ============================================================================

def run_mipro(
    program: Any,
    trainset: List,
    valset: List,
    metric: Callable,
    config: Dict[str, Any]
) -> Any:
    """
    Run MIPRO/MIPROv2 optimization

    Args:
        program: DSPy module to optimize
        trainset: Training examples
        valset: Validation examples
        metric: Evaluation metric
        config: Optimizer configuration

    Returns:
        Compiled DSPy program
    """
    import dspy
    from dspy.teleprompt import MIPROv2

    log_progress("Starting MIPROv2 optimization")

    mode = config.get('mode', 'light')
    max_bootstrapped = config.get('max_bootstrapped_demos', 4)
    max_labeled = config.get('max_labeled_demos', 4)
    minibatch = config.get('minibatch', True)
    minibatch_size = config.get('minibatch_size', 35)
    metric_threshold = config.get('metric_threshold')

    log_progress(f"Optimizing with mode={mode}")

    # Create optimizer
    # Note: When using 'auto' mode, num_trials and num_candidates are set automatically
    # We need to ensure instruction optimization is enabled
    optimizer_kwargs = {
        'metric': metric,
        'auto': mode,
        'max_bootstrapped_demos': max_bootstrapped,
        'max_labeled_demos': max_labeled,
        'verbose': True,
        'track_stats': True,
        # Ensure instruction optimization is enabled
        'prompt_model': None,  # Use the same model for generating instruction candidates
    }

    if metric_threshold is not None:
        optimizer_kwargs['metric_threshold'] = metric_threshold

    optimizer = MIPROv2(**optimizer_kwargs)

    # Compile the program
    # Note: Don't pass num_trials when using auto mode - it's set automatically
    log_progress(f"Running MIPROv2 optimization (this may take a few minutes)...")
    compiled_program = optimizer.compile(
        student=program,
        trainset=trainset,
        valset=valset,
        minibatch=minibatch,
        minibatch_size=minibatch_size
    )

    log_progress("Optimization complete")

    return compiled_program


# ============================================================================
# EVALUATION
# ============================================================================

def evaluate_program(
    program: Any,
    devset: List,
    metric: Callable,
    num_threads: int = 1
) -> float:
    """
    Evaluate compiled program on dev set

    Args:
        program: DSPy module to evaluate
        devset: Evaluation examples
        metric: Evaluation metric
        num_threads: Number of threads for parallel evaluation

    Returns:
        Average metric score
    """
    import dspy
    from dspy.evaluate import Evaluate

    log_progress(f"Evaluating on {len(devset)} examples...")

    evaluator = Evaluate(
        devset=devset,
        metric=metric,
        num_threads=num_threads,
        display_progress=False,
        display_table=False
    )

    result = evaluator(program)

    # DSPy 3.x returns EvaluationResult object, extract the score
    if hasattr(result, 'score'):
        score = float(result.score)
    elif isinstance(result, (int, float)):
        score = float(result)
    else:
        # Try to convert to float directly
        score = float(result)

    # DSPy Evaluate returns percentage (0-100), normalize to decimal (0-1)
    if score > 1:
        score = score / 100.0

    return score


# ============================================================================
# RESULT EXTRACTION
# ============================================================================

def extract_optimized_results(compiled_program: Any) -> Dict[str, Any]:
    """
    Extract optimized signature, instructions, and demos from compiled program

    Args:
        compiled_program: Compiled DSPy module

    Returns:
        Dictionary with optimized components
    """
    import dspy

    results = {
        'instructions': {},
        'demos': [],
        'predictors': [],
        'formatted_prompts': {}  # Full formatted prompts
    }

    try:
        # Get the adapter for formatting prompts (DSPy 3.x approach)
        adapter = None
        try:
            from dspy.adapters import ChatAdapter
            adapter = ChatAdapter()
        except ImportError:
            pass

        # Iterate through all predictors in the program
        for name, module in compiled_program.named_predictors():
            predictor_info = {
                'name': name,
                'type': type(module).__name__
            }

            # Method 1: Use adapter to get the full formatted prompt (recommended by DSPy team)
            if adapter and hasattr(module, 'signature'):
                try:
                    formatted = adapter.format(
                        module.signature,
                        demos=getattr(module, 'demos', []),
                        inputs={k: f"{{{k}}}" for k in module.signature.input_fields},
                    )
                    if formatted:
                        # The formatted prompt contains the full optimized instruction
                        results['formatted_prompts'][name] = formatted
                except Exception as e:
                    pass

            instruction = None

            # Method 2: Check signature.instructions (DSPy 3.x stores it here)
            if hasattr(module, 'signature'):
                sig = module.signature
                if hasattr(sig, 'instructions') and sig.instructions:
                    instruction = sig.instructions
                elif hasattr(sig, '__doc__') and sig.__doc__:
                    instruction = sig.__doc__

            # Method 3: Check extended_signature (older DSPy versions)
            if not instruction and hasattr(module, 'extended_signature'):
                sig = module.extended_signature
                if hasattr(sig, 'instructions') and sig.instructions:
                    instruction = sig.instructions

            if instruction:
                # Clean up the instruction text
                instruction = str(instruction).strip()
                if instruction:
                    results['instructions'][name] = instruction
                    predictor_info['instruction'] = instruction

            # Extract demonstrations if available
            if hasattr(module, 'demos') and module.demos:
                demo_count = len(module.demos)
                predictor_info['demo_count'] = demo_count

                # Extract up to 10 demos for display
                for i, demo in enumerate(module.demos[:10]):
                    demo_dict = {
                        'predictor': name,
                        'input': str(demo.question) if hasattr(demo, 'question') else '',
                        'output': str(demo.answer) if hasattr(demo, 'answer') else ''
                    }
                    results['demos'].append(demo_dict)

            results['predictors'].append(predictor_info)

        # If we have formatted prompts but no instructions, extract from formatted
        if not results['instructions'] and results['formatted_prompts']:
            for name, formatted in results['formatted_prompts'].items():
                # The formatted prompt is the complete optimized prompt
                results['instructions'][name] = str(formatted)

        log_progress(f"Extracted {len(results['demos'])} demos and {len(results['instructions'])} optimized instructions")

    except Exception as e:
        log_progress(f"Warning: Could not fully extract results: {str(e)}")
        import traceback
        log_progress(f"Traceback: {traceback.format_exc()}")

    return results


# ============================================================================
# SAVE COMPILED PROGRAM
# ============================================================================

def save_compiled_program(compiled_program: Any, save_path: str) -> str:
    """
    Save compiled DSPy program to disk

    Args:
        compiled_program: Compiled DSPy module
        save_path: Directory path to save program

    Returns:
        Absolute path where program was saved
    """
    import os

    try:
        # Create directory if it doesn't exist
        os.makedirs(save_path, exist_ok=True)

        # Save the program (DSPy handles serialization)
        compiled_program.save(save_path)

        abs_path = os.path.abspath(save_path)
        return abs_path

    except Exception as e:
        return save_path


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

        # Step 2: Import DSPy (check if installed)
        try:
            import dspy
        except ImportError as e:
            raise ImportError(
                "DSPy library not found. Please install it with: pip install dspy-ai"
            )

        # Step 3: Setup language model
        log_progress("Initializing DSPy optimizer...")
        lm = setup_language_model(config['model_config'])

        # Step 4: Prepare datasets
        trainset = prepare_dataset(config['train_dataset'], 'train_dataset')

        # Handle validation set
        if 'val_dataset' in config and config['val_dataset']:
            valset = prepare_dataset(config['val_dataset'], 'val_dataset')
        else:
            # Auto-split: 80% train, 20% val
            split_idx = int(len(trainset) * 0.8)
            if split_idx < len(trainset):
                valset = trainset[split_idx:]
                trainset = trainset[:split_idx]
                log_progress(f"Using {len(trainset)} training examples, {len(valset)} validation examples")
            else:
                # Dataset too small, use all for train and val
                valset = trainset
                log_progress(f"Using {len(trainset)} examples for training and validation")

        # Step 5: Create metric
        metric = create_metric(config['metric_config'])

        # Step 6: Create DSPy program with initial instruction
        program_type = config.get('program_type', 'predict')
        initial_instruction = config.get('initial_instruction', '')
        program = create_dspy_program(program_type, initial_instruction)

        # Step 7: Run optimization (MIPROv2 for instruction optimization)
        optimizer_type = config.get('optimizer', 'MIPROv2')
        optimizer_config = config.get('optimizer_config', {})

        if optimizer_type in ['MIPRO', 'MIPROv2']:
            compiled_program = run_mipro(
                program, trainset, valset, metric, optimizer_config
            )
        else:
            raise ValueError(f"Unknown optimizer: {optimizer_type}. Use 'MIPROv2' for instruction optimization.")

        # Step 8: Evaluate compiled program
        validation_score = evaluate_program(compiled_program, valset, metric)

        # Step 9: Extract results
        extracted_results = extract_optimized_results(compiled_program)

        # Step 10: Save compiled program
        save_path = config.get('save_path', './dspy_compiled_program')
        saved_path = save_compiled_program(compiled_program, save_path)

        # Step 11: Return success result
        log_progress(f"Optimization complete! Validation score: {(validation_score * 100):.1f}%")

        success_result = {
            'type': 'success',
            'validation_score': float(validation_score),
            'optimized_signature': extracted_results['instructions'],
            'optimized_demos': extracted_results['demos'],
            'predictors': extracted_results['predictors'],
            'compiled_program_path': saved_path,
            'dataset_sizes': {
                'train': len(trainset),
                'val': len(valset)
            },
            'optimizer': optimizer_type,
            'program_type': program_type
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
