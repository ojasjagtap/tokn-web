"""
tokn Backend API Server
Flask application providing DSPy and GEPA optimization endpoints
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__)

# Configure CORS - Update origins for production
CORS(app, origins=[
    "http://localhost:3000",  # Vite dev server
    "http://localhost:5173",  # Alternative Vite port
    "*"  # Allow all for development - RESTRICT IN PRODUCTION
])

# Import route handlers
from routes.health_route import health_bp
from routes.dspy_route import dspy_bp
from routes.gepa_route import gepa_bp

# Register blueprints
app.register_blueprint(health_bp, url_prefix='/api')
app.register_blueprint(dspy_bp, url_prefix='/api')
app.register_blueprint(gepa_bp, url_prefix='/api')

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Endpoint not found',
        'code': 'NOT_FOUND'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'error': 'Internal server error',
        'code': 'INTERNAL_ERROR'
    }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'

    print(f"Starting tokn Backend API on port {port}")
    print(f"Debug mode: {debug}")

    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug
    )
