# Backend API Specification

This document specifies the backend API endpoints required for DSPy and GEPA optimization nodes in the tokn web application.

## Overview

Since the web application cannot spawn local Python processes, DSPy and GEPA optimization nodes require a backend server to execute the Python-based optimization code.

## API Endpoints

### Base URL

The frontend will default to the same origin for API calls, but users can configure a custom backend URL in settings.

Default: `window.location.origin + '/api'`

---

## 1. DSPy Optimization Endpoint

### `POST /api/optimize/dspy`

Runs DSPy prompt optimization using the provided configuration and examples.

#### Request Body

```json
{
  "prompt": "string (required) - The initial prompt template to optimize",
  "examples": [
    {
      "input": "string - Input example",
      "expected_output": "string - Expected output for this input"
    }
  ],
  "model": "string (required) - Model ID (e.g., 'gpt-4o-mini', 'claude-3-5-sonnet-20241022')",
  "provider": "string (required) - Provider ID ('openai' or 'anthropic')",
  "apiKey": "string (required) - API key for the provider",
  "apiBase": "string (optional) - Custom API base URL",
  "config": {
    "metric": "string (optional) - Optimization metric",
    "maxBootstrappedDemos": "number (optional) - Max demos to bootstrap",
    "maxLabeledDemos": "number (optional) - Max labeled demos",
    "temperature": "number (optional) - Model temperature",
    "teacherSettings": {
      "model": "string (optional) - Teacher model",
      "temperature": "number (optional) - Teacher temperature"
    }
  }
}
```

#### Response

**Success (200):**
```json
{
  "success": true,
  "optimizedPrompt": "string - The optimized prompt",
  "metrics": {
    "score": "number - Optimization score",
    "iterations": "number - Number of iterations performed"
  },
  "logs": [
    "string - Log messages from optimization process"
  ]
}
```

**Error (400/500):**
```json
{
  "success": false,
  "error": "string - Error message"
}
```

#### Implementation Notes

- Use the `renderer/dspy/dspy_optimizer.py` script as the implementation base
- Stream progress logs back to client if possible (SSE or WebSocket)
- Timeout after 5 minutes if optimization hasn't completed
- Validate API keys before starting expensive operations

---

## 2. GEPA Optimization Endpoint

### `POST /api/optimize/gepa`

Runs GEPA (Genetic Evolution Prompt Algorithm) optimization using MLflow.

#### Request Body

```json
{
  "prompt": "string (required) - The initial prompt template with {{placeholders}}",
  "examples": [
    {
      "input": "object - Input data with keys matching prompt placeholders",
      "expected_output": "string - Expected output"
    }
  ],
  "config": {
    "inputKey": "string (optional, default: 'question') - Key for input in examples",
    "populationSize": "number (optional, default: 10) - Population size for genetic algorithm",
    "numGenerations": "number (optional, default: 5) - Number of generations",
    "mutationRate": "number (optional, default: 0.3) - Mutation rate",
    "eliteSize": "number (optional, default: 2) - Number of elite individuals to keep"
  },
  "providers": [
    {
      "provider": "string (required) - Provider ID ('openai', 'anthropic', or 'gemini')",
      "model": "string (required) - Model ID",
      "apiKey": "string (required) - API key",
      "apiBase": "string (optional) - Custom API base URL"
    }
  ],
  "mlflowConfig": {
    "trackingUri": "string (optional) - MLflow tracking server URI",
    "experimentName": "string (optional) - MLflow experiment name"
  }
}
```

#### Response

**Success (200):**
```json
{
  "success": true,
  "optimizedPrompt": "string - The best evolved prompt",
  "mlflowRunId": "string - MLflow run ID for tracking",
  "metrics": {
    "bestScore": "number - Best fitness score achieved",
    "avgScore": "number - Average score of final generation",
    "generations": "number - Number of generations completed"
  },
  "trackingUrl": "string (optional) - URL to view run in MLflow UI"
}
```

**Error (400/500):**
```json
{
  "success": false,
  "error": "string - Error message"
}
```

#### Implementation Notes

- Use the `renderer/gepa/gepa_optimizer.py` script as the implementation base
- Optionally integrate with MLflow tracking server
- Support multiple providers for ensemble evaluation
- Stream progress updates if possible
- Timeout after 10 minutes

---

## 3. Health Check Endpoint

### `GET /api/health`

Check if the backend server is running and responsive.

#### Response

**Success (200):**
```json
{
  "status": "ok",
  "version": "string - API version",
  "features": {
    "dspy": "boolean - DSPy optimization available",
    "gepa": "boolean - GEPA optimization available",
    "mlflow": "boolean - MLflow tracking available"
  }
}
```

---

## Authentication

API keys are passed in request bodies, not as headers. The backend should:
1. Validate API keys by making test requests to providers
2. Never log or store API keys
3. Use them only for the duration of the optimization request

---

## CORS Configuration

The backend must enable CORS for the frontend origin:

```python
# Example for Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=[
    "http://localhost:3000",  # Development
    "https://your-production-domain.com"  # Production
])
```

---

## Error Handling

All endpoints should return consistent error responses:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE (optional)",
  "details": "object (optional) - Additional error context"
}
```

Common error codes:
- `INVALID_REQUEST` - Malformed request body
- `INVALID_API_KEY` - API key validation failed
- `PROVIDER_ERROR` - Error from LLM provider
- `OPTIMIZATION_FAILED` - Optimization process failed
- `TIMEOUT` - Request timed out

---

## Rate Limiting

Recommended rate limits:
- 10 requests per minute per IP for optimization endpoints
- 100 requests per minute for health check

---

## Deployment Options

### Option 1: Flask/FastAPI Server
- Simple Python server
- Deploy to Heroku, Railway, Render, or AWS Lambda

### Option 2: Serverless Functions
- Deploy as individual functions
- Vercel, Netlify, or AWS Lambda
- Note: May have timeout constraints

### Option 3: Docker Container
- Package backend as Docker image
- Deploy to any container platform
- Easiest for dependency management

---

## Example Backend Structure

```
backend/
├── app.py                 # Main Flask/FastAPI app
├── routes/
│   ├── dspy_route.py     # DSPy endpoint
│   ├── gepa_route.py     # GEPA endpoint
│   └── health_route.py   # Health check
├── dspy/
│   ├── dspy_optimizer.py # From renderer/dspy/
│   └── requirements.txt
├── gepa/
│   ├── gepa_optimizer.py # From renderer/gepa/
│   └── requirements.txt
├── requirements.txt       # Combined dependencies
├── Dockerfile            # Docker configuration
└── README.md             # Setup instructions
```

---

## Security Considerations

1. **API Key Protection**: Never log API keys, store them temporarily in memory only
2. **Input Validation**: Validate all inputs to prevent injection attacks
3. **Resource Limits**: Enforce timeouts and memory limits to prevent DoS
4. **Rate Limiting**: Implement per-IP rate limiting
5. **HTTPS Only**: Require HTTPS in production
6. **CORS**: Restrict CORS to known frontend origins

---

## Testing

Use `curl` or Postman to test endpoints:

```bash
# Test DSPy endpoint
curl -X POST http://localhost:5000/api/optimize/dspy \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Answer the question.",
    "examples": [{"input": "What is 2+2?", "expected_output": "4"}],
    "model": "gpt-4o-mini",
    "provider": "openai",
    "apiKey": "your-api-key"
  }'

# Test health endpoint
curl http://localhost:5000/api/health
```

---

## Future Enhancements

- WebSocket support for real-time progress streaming
- Job queue for long-running optimizations
- Result caching to avoid redundant optimizations
- Multi-user authentication
- Persistent experiment storage
