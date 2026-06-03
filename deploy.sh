#!/bin/bash
# deploy.sh — Script de deploy en producción
# Uso: ./deploy.sh
# Ejecutar desde el directorio raíz del proyecto en el servidor

set -e

echo "🚀 CamWatch Deploy — $(date)"

# Verificar que existe .env
if [ ! -f .env ]; then
  echo "❌ ERROR: Falta el archivo .env. Copia .env.example y completa los valores."
  exit 1
fi

# Pull de cambios
echo "📥 Pulling latest changes..."
git pull origin main

# Build de la imagen
echo "🔨 Building Docker image..."
docker compose -f docker-compose.prod.yml build --no-cache web

# Levantar servicios
echo "⬆️  Starting services..."
docker compose -f docker-compose.prod.yml up -d postgres redis

echo "⏳ Waiting for database..."
sleep 5

# Correr migraciones
echo "📊 Running database migrations..."
docker compose -f docker-compose.prod.yml run --rm web npx prisma migrate deploy

# Seed solo si DB está vacía
echo "🌱 Running seed if needed..."
docker compose -f docker-compose.prod.yml run --rm web npm run db:seed

# Levantar app
echo "🌐 Starting web and nginx..."
docker compose -f docker-compose.prod.yml up -d web nginx

echo "✅ Deploy completo!"
echo "🔗 https://camapp.modest-benz.50-21-179-210.plesk.page"
