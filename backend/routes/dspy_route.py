"""
DSPy optimization endpoint
"""

from flask import Blueprint, request, jsonify
import sys
import os
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

dspy_bp = Blueprint('dspy', __name__)

@dspy_bp.route('/optimize/dspy', methods=['POST'])
def optimize_dspy():
    """
    DSPy optimization endpoint
    Receives optimization configuration and returns optimized prompt
    """
    try:
        # Parse request body
        data = request.get_json()

        if not data:
            return jsonify({
                'success': False,
                'error': 'Request body is required',
                'code': 'INVALID_REQUEST'
            }), 400

        # Validate required fields
        required_fields = ['prompt', 'examples', 'model', 'provider', 'apiKey']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}',
                    'code': 'INVALID_REQUEST'
                }), 400

        # Import DSPy optimizer
        from dspy.dspy_optimizer import optimize_prompt

        # Transform API request to dspy_optimizer format
        config = {
            'model_config': {
                'provider': data['provider'],
                'model': data['model'],
                'api_key': data['apiKey'],
                'api_base': data.get('apiBase')
            },
            'optimizer': 'MIPRO',  # Default optimizer
            'optimizer_config': {
                'max_bootstrapped_demos': data.get('config', {}).get('maxBootstrappedDemos', 4),
                'max_labeled_demos': data.get('config', {}).get('maxLabeledDemos', 16),
                'temperature': data.get('config', {}).get('temperature', 1.0),
                'teacher_settings': data.get('config', {}).get('teacherSettings', {})
            },
            'metric_config': {
                'type': data.get('config', {}).get('metric', 'exact_match')
            },
            'train_dataset': [
                {'input': ex['input'], 'output': ex['expected_output']}
                for ex in data['examples']
            ]
        }

        # Run optimization
        logs = []

        def progress_callback(message):
            logs.append(message)
            print(f"[DSPy] {message}")

        result = optimize_prompt(config, progress_callback)

        if result['type'] == 'success':
            return jsonify({
                'success': True,
                'optimizedPrompt': result['optimized_prompt'],
                'metrics': result.get('metrics', {}),
                'logs': logs
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': result.get('message', 'Optimization failed'),
                'code': 'OPTIMIZATION_FAILED'
            }), 500

    except ImportError as e:
        return jsonify({
            'success': False,
            'error': f'DSPy not installed: {str(e)}',
            'code': 'DEPENDENCY_MISSING'
        }), 500

    except Exception as e:
        print(f"[DSPy Error] {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'code': 'INTERNAL_ERROR'
        }), 500
