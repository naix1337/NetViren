.PHONY: help install dev dev-api dev-frontend build build-api build-frontend start start-api start-frontend clean lint

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	npm install

dev: ## Start both API and Frontend in dev mode
	npm run dev:api & npm run dev:frontend

dev-api: ## Start API dev server
	npm run dev:api

dev-frontend: ## Start Frontend dev server
	npm run dev:frontend

build: ## Build all packages
	npm run build

build-api: ## Build API only
	npm run build:api

build-frontend: ## Build Frontend only
	npm run build:frontend

start: ## Start all production services
	npm run start:api & npm run start:frontend

start-api: ## Start API production server
	npm run start:api

start-frontend: ## Start Frontend production server
	npm run start:frontend

clean: ## Remove build artifacts
	rm -rf packages/api/dist packages/frontend/.next

lint: ## Run linter (if configured)
	npm run lint 2>/dev/null || echo "No linter configured"

update: ## Pull latest code and rebuild
	@echo "Run: bash <(curl -sSL https://github.com/naix1337/NetViren/raw/master/update.sh)"
