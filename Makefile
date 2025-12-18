# tokn Docker Makefile
# Convenient shortcuts for common Docker operations

.PHONY: help dev prod build up down logs clean test restart

# Default target
help:
	@echo "tokn Docker Commands"
	@echo "===================="
	@echo ""
	@echo "Development:"
	@echo "  make dev              - Start full stack (frontend + backend)"
	@echo "  make dev-frontend     - Start frontend only"
	@echo "  make dev-backend      - Start backend only"
	@echo "  make dev-build        - Rebuild and start full stack"
	@echo "  make logs             - View logs from all running services"
	@echo "  make logs-f           - Follow logs from frontend"
	@echo "  make logs-b           - Follow logs from backend"
	@echo ""
	@echo "Production:"
	@echo "  make prod             - Start production environment (full stack)"
	@echo "  make prod-frontend    - Start production frontend only"
	@echo "  make prod-backend     - Start production backend only"
	@echo "  make prod-build       - Rebuild and start production"
	@echo ""
	@echo "Management:"
	@echo "  make down             - Stop all services"
	@echo "  make restart          - Restart all services"
	@echo "  make clean            - Stop services and remove volumes"
	@echo "  make clean-all        - Complete cleanup (containers, volumes, images)"
	@echo ""
	@echo "Testing:"
	@echo "  make test             - Run health checks on running services"
	@echo "  make shell-f          - Open shell in frontend container"
	@echo "  make shell-b          - Open shell in backend container"
	@echo ""
	@echo "Note: Backend is optional and only needed for DSPy/GEPA optimization"
	@echo ""

# Development targets
dev:
	@echo "Starting full development stack (frontend + backend)..."
	@test -f backend/.env || (echo "Creating backend/.env from example..." && cp backend/.env.example backend/.env)
	docker-compose --profile full up

dev-frontend:
	@echo "Starting frontend only..."
	docker-compose --profile frontend up

dev-backend:
	@echo "Starting backend only..."
	@test -f backend/.env || (echo "Creating backend/.env from example..." && cp backend/.env.example backend/.env)
	docker-compose --profile backend up

dev-build:
	@echo "Rebuilding and starting full development stack..."
	docker-compose --profile full up --build

dev-detached:
	@echo "Starting development environment in background..."
	@test -f backend/.env || (echo "Creating backend/.env from example..." && cp backend/.env.example backend/.env)
	docker-compose --profile full up -d

# Production targets
prod:
	@echo "Starting production environment (full stack)..."
	@test -f backend/.env || (echo "Creating backend/.env from example..." && cp backend/.env.example backend/.env)
	docker-compose -f docker-compose.prod.yml --profile full up -d

prod-frontend:
	@echo "Starting production frontend only..."
	docker-compose -f docker-compose.prod.yml --profile frontend up -d

prod-backend:
	@echo "Starting production backend only..."
	@test -f backend/.env || (echo "Creating backend/.env from example..." && cp backend/.env.example backend/.env)
	docker-compose -f docker-compose.prod.yml --profile backend up -d

prod-build:
	@echo "Rebuilding and starting production environment..."
	docker-compose -f docker-compose.prod.yml --profile full up --build -d

prod-logs:
	docker-compose -f docker-compose.prod.yml logs -f

# Log targets
logs:
	docker-compose logs

logs-follow:
	docker-compose logs -f

logs-f:
	docker-compose logs -f frontend

logs-b:
	docker-compose logs -f backend


# Management targets
down:
	@echo "Stopping all services..."
	docker-compose down
	docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

restart:
	@echo "Restarting all services..."
	docker-compose restart

restart-f:
	@echo "Restarting frontend..."
	docker-compose restart frontend

restart-b:
	@echo "Restarting backend..."
	docker-compose restart backend


# Cleanup targets
clean:
	@echo "Stopping services and removing volumes..."
	docker-compose down -v
	docker-compose -f docker-compose.prod.yml down -v 2>/dev/null || true

clean-all:
	@echo "Complete cleanup (this may take a moment)..."
	docker-compose down -v --rmi all
	docker-compose -f docker-compose.prod.yml down -v --rmi all 2>/dev/null || true
	@echo "Cleanup complete!"

# Testing targets
test:
	@echo "Running health checks on running services..."
	@echo ""
	@echo "Frontend:"
	@curl -sf http://localhost:3000/health && echo "✓ Frontend is healthy" || echo "✗ Frontend is not running"
	@echo ""
	@echo "Backend:"
	@curl -sf http://localhost:5000/api/health && echo "✓ Backend is healthy" || echo "✗ Backend is not running (optional)"
	@echo ""

status:
	@echo "Service status:"
	@docker-compose ps

shell-f:
	@echo "Opening shell in frontend container..."
	docker-compose exec frontend sh

shell-b:
	@echo "Opening shell in backend container..."
	docker-compose exec backend bash

# Build targets
build:
	docker-compose build

build-f:
	docker-compose build frontend

build-b:
	docker-compose build backend

# Setup target
setup:
	@echo "Setting up tokn for the first time..."
	@test -f backend/.env || (echo "Creating backend/.env..." && cp backend/.env.example backend/.env)
	@echo "Setup complete! Run 'make dev' to start development environment."
