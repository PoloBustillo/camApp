#!/bin/bash
# deploy.sh — Script de deploy en producción con Bun + Plesk
# Uso: ./deploy.sh
set -e

echo "🚀 CamWatch Deploy — $(date)"

if [ ! -f .env ]; then
  echo "❌ ERROR: Falta el archivo .env. Copia .env.example y completa los valores."
  exit 1
fi

echo "📥 Pulling latest changes..."
git pull origin main

echo "🔨 Building Docker images..."
docker compose -f docker-compose.prod.yml build web
docker compose --profile migration -f docker-compose.prod.yml build migrate

echo "⬆️  Starting postgres and redis..."
docker compose -f docker-compose.prod.yml up -d postgres redis

echo "⏳ Waiting for database to be healthy..."
docker compose -f docker-compose.prod.yml wait postgres

echo "📊 Running database migrations..."
docker compose --profile migration -f docker-compose.prod.yml run --rm migrate

echo "🌱 Running seed (skip if already seeded)..."
docker compose --profile migration -f docker-compose.prod.yml run --rm migrate \
  sh -c "bun run prisma/seed.ts" || true

echo "⬆️  Starting web..."
docker compose -f docker-compose.prod.yml up -d web

echo "✅ Deploy completo!"
echo "🔗 https://camapp.modest-benz.50-21-179-210.plesk.page"
