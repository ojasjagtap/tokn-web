"""
GEPA optimization endpoint
"""

from flask import Blueprint, request, jsonify
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

gepa_bp = Blueprint('gepa', __name__)

@gepa_bp.route('/optimize/gepa', methods=['POST'])
def optimize_gepa():
    """
    GEPA optimization endpoint
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
        required_fields = ['prompt', 'examples', 'providers']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}',
                    'code': 'INVALID_REQUEST'
                }), 400

        # Import GEPA optimizer
        from gepa.gepa_optimizer import optimize_with_gepa

        # Transform API request to gepa_optimizer format
        config = {
            'prompt_template': data['prompt'],
            'dataset': [
                {
                    'input': ex['input'],
                    'expected_output': ex['expected_output']
                }
                for ex in data['examples']
            ],
            'input_key': data.get('config', {}).get('inputKey', 'question'),
            'model_configs': [
                {
                    'provider': p['provider'],
                    'model': p['model'],
                    'api_key': p['apiKey'],
                    'api_base': p.get('apiBase')
                }
                for p in data['providers']
            ],
            'gepa_config': {
                'population_size': data.get('config', {}).get('populationSize', 10),
                'num_generations': data.get('config', {}).get('numGenerations', 5),
                'mutation_rate': data.get('config', {}).get('mutationRate', 0.3),
                'elite_size': data.get('config', {}).get('eliteSize', 2)
            },
            'mlflow_config': {
                'tracking_uri': data.get('mlflowConfig', {}).get('trackingUri'),
                'experiment_name': data.get('mlflowConfig', {}).get('experimentName', 'tokn-gepa')
            }
        }

        # Run optimization
        result = optimize_with_gepa(config)

        if result['type'] == 'success':
            tracking_url = None
            if result.get('mlflow_run_id'):
                tracking_url = f"{config['mlflow_config'].get('tracking_uri', '')}/experiments/{result.get('experiment_id')}/runs/{result['mlflow_run_id']}"

            return jsonify({
                'success': True,
                'optimizedPrompt': result['optimized_prompt'],
                'mlflowRunId': result.get('mlflow_run_id'),
                'metrics': result.get('metrics', {}),
                'trackingUrl': tracking_url
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
            'error': f'GEPA dependencies not installed: {str(e)}',
            'code': 'DEPENDENCY_MISSING'
        }), 500

    except Exception as e:
        print(f"[GEPA Error] {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'code': 'INTERNAL_ERROR'
        }), 500
