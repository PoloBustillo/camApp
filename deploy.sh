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

echo "🔨 Building Docker image..."
docker compose -f docker-compose.prod.yml build --no-cache web

echo "⬆️  Starting all services (postgres, redis, web)..."
docker compose -f docker-compose.prod.yml up -d --force-recreate

echo "⏳ Waiting for services to be healthy (20s)..."
sleep 20

echo "📊 Running database migrations..."
docker compose -f docker-compose.prod.yml exec web bunx prisma migrate deploy

echo "🌱 Running seed (skip if already seeded)..."
docker compose -f docker-compose.prod.yml exec web bun run db:seed || true

echo "✅ Deploy completo!"
echo "🔗 https://camapp.modest-benz.50-21-179-210.plesk.page"
