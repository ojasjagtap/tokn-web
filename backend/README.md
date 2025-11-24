# tokn Backend API

Backend server for tokn web application, providing DSPy and GEPA optimization endpoints.

## Features

- **DSPy Optimization**: Prompt optimization using DSPy MIPRO algorithm
- **GEPA Optimization**: Genetic evolution-based prompt optimization with MLflow tracking
- **Health Check**: Endpoint to verify backend availability and features

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

## Installation

### Option 1: Local Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv

# Activate on Windows
venv\Scripts\activate

# Activate on macOS/Linux
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the server:
```bash
python app.py
```

The server will start on `http://localhost:5000`

### Option 2: Docker

1. Build the Docker image:
```bash
docker build -t tokn-backend .
```

2. Run the container:
```bash
docker run -p 5000:5000 tokn-backend
```

### Option 3: Docker Compose (with MLflow)

1. Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "5000:5000"
    environment:
      - MLFLOW_TRACKING_URI=http://mlflow:5001
    depends_on:
      - mlflow

  mlflow:
    image: python:3.11-slim
    ports:
      - "5001:5001"
    command: >
      sh -c "pip install mlflow && mlflow server --host 0.0.0.0 --port 5001"
```

2. Run:
```bash
docker-compose up
```

## Environment Variables

Create a `.env` file in the backend directory:

```env
# Server configuration
PORT=5000
DEBUG=False

# MLflow configuration (optional)
MLFLOW_TRACKING_URI=http://localhost:5001

# CORS allowed origins (comma-separated)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

## API Endpoints

### Health Check
```
GET /api/health
```

### DSPy Optimization
```
POST /api/optimize/dspy
Content-Type: application/json

{
  "prompt": "Answer the question.",
  "examples": [
    {"input": "What is 2+2?", "expected_output": "4"}
  ],
  "model": "gpt-4o-mini",
  "provider": "openai",
  "apiKey": "your-api-key"
}
```

### GEPA Optimization
```
POST /api/optimize/gepa
Content-Type: application/json

{
  "prompt": "Answer: {{question}}",
  "examples": [
    {"input": {"question": "What is 2+2?"}, "expected_output": "4"}
  ],
  "providers": [
    {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "apiKey": "your-api-key"
    }
  ]
}
```

See `docs/BACKEND_API.md` in the root directory for complete API documentation.

## Deployment

### Heroku

1. Install Heroku CLI
2. Create app:
```bash
heroku create tokn-backend
```

3. Deploy:
```bash
git subtree push --prefix backend heroku main
```

### Railway

1. Install Railway CLI
2. Initialize:
```bash
railway init
```

3. Deploy:
```bash
railway up
```

### AWS Lambda (Serverless)

Use AWS SAM or Serverless Framework to deploy as Lambda functions.

### Vercel/Netlify Functions

Convert Flask routes to serverless functions format.

## Security Notes

⚠️ **Important Security Considerations:**

1. **API Keys**: The backend receives API keys in request bodies. Never log or persist these keys.

2. **CORS**: Update `CORS_ORIGINS` in production to restrict access to your frontend domain only.

3. **Rate Limiting**: Implement rate limiting for production (e.g., using Flask-Limiter).

4. **HTTPS**: Always use HTTPS in production. Configure your deployment platform accordingly.

5. **Input Validation**: All inputs are validated, but review for your security requirements.

## Monitoring

### Check Backend Health

```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "features": {
    "dspy": true,
    "gepa": true,
    "mlflow": true
  }
}
```

### Logs

- Check terminal output for request logs
- Use `DEBUG=True` for detailed logging (development only)
- Configure proper logging service in production

## Troubleshooting

### DSPy Import Error
```
ImportError: No module named 'dspy'
```
**Solution**: Install DSPy with `pip install dspy-ai`

### MLflow Import Error
```
ImportError: No module named 'mlflow'
```
**Solution**: Install MLflow with `pip install mlflow>=3.5.0`

### CORS Error
```
Access to fetch at 'http://localhost:5000/api/...' from origin 'http://localhost:3000' has been blocked by CORS policy
```
**Solution**: Update `CORS_ORIGINS` in `.env` or `app.py`

### Port Already in Use
```
OSError: [Errno 98] Address already in use
```
**Solution**: Change port with `PORT=5001 python app.py` or kill the process using port 5000

## Development

### Running Tests

```bash
# Install dev dependencies
pip install pytest pytest-flask

# Run tests
pytest
```

### Code Structure

```
backend/
├── app.py                  # Main Flask application
├── routes/                 # Route handlers
│   ├── health_route.py    # Health check endpoint
│   ├── dspy_route.py      # DSPy optimization endpoint
│   └── gepa_route.py      # GEPA optimization endpoint
├── dspy/                   # DSPy Python scripts
│   ├── dspy_optimizer.py
│   └── requirements.txt
├── gepa/                   # GEPA Python scripts
│   ├── gepa_optimizer.py
│   └── requirements.txt
├── requirements.txt        # Combined dependencies
├── Dockerfile             # Docker configuration
└── README.md              # This file
```

## Support

For issues or questions:
1. Check the main project README
2. Review API documentation in `docs/BACKEND_API.md`
3. Open an issue on GitHub

## License

Same as the main tokn project.
