# Docker Guide

Complete guide for running tokn with Docker.

## Quick Start

### Frontend Only (Recommended)

Most users only need the frontend:

```bash
docker-compose --profile frontend up
# or: make dev-frontend
```

Access at: **http://localhost:3000**

### Full Stack (Frontend + Backend)

Only needed for DSPy/GEPA optimization:

```bash
docker-compose --profile full up
# or: make dev
```

Access:
- Frontend: **http://localhost:3000**
- Backend API: **http://localhost:5000/api/health**

## Prerequisites

- Docker Desktop installed
- 4GB+ RAM available
- Ports 3000 and 5000 available

## Services

### Frontend
- **Development**: Vite dev server with hot reloading
- **Production**: Nginx serving optimized static files
- **Port**: 3000 (dev) / 80 (prod)
- **Standalone**: Works without backend

### Backend (Optional)
- **Purpose**: DSPy and GEPA prompt optimization
- **Technology**: Python Flask API
- **Port**: 5000
- **Required for**: Optimization features only
- **Note**: MLflow is used as a Python library, not a separate service

## Development Commands

### Starting Services

```bash
# Frontend only
make dev-frontend

# Backend only
make dev-backend

# Both services
make dev

# With rebuild
make dev-build

# In background
docker-compose --profile full up -d
```

### Viewing Logs

```bash
# All services
make logs

# Frontend only
make logs-f

# Backend only
make logs-b

# Follow logs
docker-compose logs -f
```

### Managing Services

```bash
# Stop all
make down

# Restart all
make restart

# Restart specific service
docker-compose restart frontend
docker-compose restart backend

# Service status
make status
```

### Accessing Containers

```bash
# Frontend shell
make shell-f

# Backend shell
make shell-b

# Run commands
docker-compose exec frontend npm install <package>
docker-compose exec backend pip install <package>
```

## Production

### Build and Run

```bash
# Frontend only
make prod-frontend
# or: docker-compose -f docker-compose.prod.yml --profile frontend up -d

# Full stack
make prod
# or: docker-compose -f docker-compose.prod.yml --profile full up -d
```

### Production Configuration

1. **Environment Variables**

Create `backend/.env` for production:
```env
PORT=5000
DEBUG=False
CORS_ORIGINS=https://yourdomain.com
```

2. **SSL/HTTPS**

The nginx container is SSL-ready. Add certificates to `docker/nginx.conf`:
```nginx
listen 443 ssl http2;
ssl_certificate /etc/nginx/ssl/cert.pem;
ssl_certificate_key /etc/nginx/ssl/key.pem;
```

3. **Resource Limits**

Backend has default limits in `docker-compose.prod.yml`:
- CPU: 2 cores max, 1 core reserved
- Memory: 2GB max, 512MB reserved

Adjust as needed for your server.

## Troubleshooting

### Port Already in Use

```bash
# Find process
lsof -i :3000
lsof -i :5000

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "3001:3000"
```

### Container Won't Start

```bash
# Check logs
docker-compose logs <service-name>

# Rebuild
docker-compose build --no-cache <service-name>

# Remove everything and start fresh
make clean
make dev
```

### Backend Connection Issues

**Symptom**: DSPy/GEPA fails with "connection refused"

**Fix**: The Vite proxy is configured to use `http://backend:5000` in Docker. If running locally without Docker, change `VITE_BACKEND_URL` in `.env`:
```env
VITE_BACKEND_URL=http://localhost:5000
```

### Frontend Not Updating

```bash
# Clear browser cache
# Rebuild frontend
docker-compose up --build frontend
```

## Health Checks

All services have built-in health checks:

```bash
# Frontend
curl http://localhost:3000/health

# Backend
curl http://localhost:5000/api/health
```

Expected responses:
- Frontend: `healthy`
- Backend: `{"status":"ok","features":{"dspy":true,"gepa":true,"mlflow":true}}`

## Cleanup

```bash
# Stop containers
make down

# Remove containers and volumes
make clean

# Complete cleanup (includes images)
make clean-all
```

## Common Workflows

### Regular Development

```bash
# 1. Start frontend only
make dev-frontend

# 2. Open http://localhost:3000
# 3. Build and test prompts

# 4. Stop when done
make down
```

### Testing Optimization Features

```bash
# 1. Start full stack
make dev

# 2. Add API keys in Settings
# 3. Test DSPy or GEPA nodes

# 4. View backend logs
make logs-b

# 5. Stop when done
make down
```

### Production Deployment

See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for detailed deployment instructions.

## Configuration Files

- **`docker-compose.yml`** - Development setup
- **`docker-compose.prod.yml`** - Production setup
- **`Dockerfile`** - Frontend multi-stage build
- **`backend/Dockerfile`** - Backend multi-stage build
- **`docker/nginx.conf`** - Production nginx config
- **`.dockerignore`** - Frontend build exclusions
- **`backend/.dockerignore`** - Backend build exclusions

## FAQ

**Q: Do I need the backend?**
A: Only if using DSPy or GEPA optimization. Regular prompt building works without it.

**Q: What about MLflow?**
A: MLflow is a Python library used by GEPA. No separate service needed.

**Q: Can I run just the backend?**
A: Yes: `make dev-backend` or `docker-compose --profile backend up`

**Q: How do I update dependencies?**
A: Edit `package.json` or `requirements.txt`, then rebuild: `make dev-build`

**Q: Production ready?**
A: Yes! Use `make prod` and configure SSL, domains, and resource limits.

## Support

For deployment guides and cloud platform instructions, see:
- [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) - Deployment guide
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - Traditional deployment options

For issues:
- Check logs: `make logs`
- Rebuild: `make dev-build`
- GitHub Issues: https://github.com/ojasjagtap/tokn-web/issues
