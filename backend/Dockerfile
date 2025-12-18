# tokn Backend API Dockerfile
FROM python:3.11-slim AS base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Production stage
FROM base AS production

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Create non-root user for security
RUN useradd -m -u 1000 tokn && \
    chown -R tokn:tokn /app

# Copy application code
COPY --chown=tokn:tokn . .

# Switch to non-root user
USER tokn

# Expose port
EXPOSE 5000

# Set environment variables
ENV FLASK_APP=app.py \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Run the application
CMD ["python", "app.py"]

# Development stage
FROM base AS development

# Copy requirements
COPY requirements.txt .

# Install dependencies including dev tools
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir flask-debugtoolbar pytest

# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Set environment variables for development
ENV FLASK_APP=app.py \
    PYTHONUNBUFFERED=1 \
    FLASK_DEBUG=1 \
    PORT=5000

# Run with auto-reload
CMD ["python", "app.py"]
