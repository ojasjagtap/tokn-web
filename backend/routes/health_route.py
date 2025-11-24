"""
Health check endpoint
"""

from flask import Blueprint, jsonify

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint
    Returns server status and available features
    """
    # Check if DSPy is available
    dspy_available = False
    try:
        import dspy
        dspy_available = True
    except ImportError:
        pass

    # Check if MLflow is available
    mlflow_available = False
    try:
        import mlflow
        mlflow_available = True
    except ImportError:
        pass

    return jsonify({
        'status': 'ok',
        'version': '1.0.0',
        'features': {
            'dspy': dspy_available,
            'gepa': mlflow_available,  # GEPA requires MLflow
            'mlflow': mlflow_available
        }
    }), 200
