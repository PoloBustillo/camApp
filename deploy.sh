#!/bin/bash
# deploy.sh — Script de deploy en producción con Bun
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

echo "⬆️  Starting postgres and redis..."
docker compose -f docker-compose.prod.yml up -d postgres redis

echo "⏳ Waiting for database (15s)..."
sleep 15

echo "📊 Running database migrations..."
docker compose -f docker-compose.prod.yml run --rm web bunx prisma migrate deploy

echo "🌱 Running seed if needed..."
docker compose -f docker-compose.prod.yml run --rm web bun run db:seed

echo "🌐 Starting web and nginx..."
docker compose -f docker-compose.prod.yml up -d web nginx

echo "✅ Deploy completo!"
echo "🔗 https://camapp.modest-benz.50-21-179-210.plesk.page"
