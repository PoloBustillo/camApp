#!/bin/bash
# deploy-direct.sh — Deploy sin Docker para VPS con RAM limitada
set -e

APP_DIR="/opt/camApp"
REPO_URL="https://github.com/tuusuario/camwatch-platform.git"
BRANCH="main"

echo "=== 1/9 Deteniendo Docker ==="
if command -v docker &>/dev/null; then
  cd "$APP_DIR" 2>/dev/null && docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
  docker system prune -af --volumes 2>/dev/null || true
  systemctl stop docker docker.socket 2>/dev/null || true
  systemctl disable docker docker.socket 2>/dev/null || true
  apt-get purge -y docker-ce docker-ce-cli containerd.io docker-compose-plugin 2>/dev/null || true
  echo "Docker detenido y eliminado."
else
  echo "Docker no instalado — saltando."
fi

echo "=== 2/9 Instalando dependencias del sistema ==="
apt-get update
apt-get install -y curl gnupg postgresql postgresql-client redis-server git

echo "=== 3/9 Instalando Bun ==="
if ! command -v bun &>/dev/null; then
  curl -fsSL https://bun.sh/install | bash
fi
export BUN="$HOME/.bun/bin/bun"

echo "=== 4/9 Clonando/actualizando repositorio ==="
mkdir -p "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git pull origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

echo "=== 5/9 Configurando .env ==="
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Edita $APP_DIR/.env con tus valores reales y vuelve a ejecutar el script."
  echo "   nano $APP_DIR/.env"
  exit 1
fi
source .env

echo "=== 6/9 Dependencias y servicios ==="
bun install --frozen-lockfile
systemctl start postgresql redis-server
systemctl enable postgresql redis-server

echo "=== 7/9 Base de datos ==="
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${POSTGRES_USER:-camwatch}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${POSTGRES_USER:-camwatch} WITH PASSWORD '${POSTGRES_PASSWORD:-camwatch_dev_password}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB:-camwatch}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${POSTGRES_DB:-camwatch} OWNER ${POSTGRES_USER:-camwatch};"

./node_modules/.bin/prisma generate
./node_modules/.bin/prisma migrate deploy

echo "=== 8/9 Build ==="
bun run build

echo "=== 9/9 Servicio systemd ==="
cat > /etc/systemd/system/camapp.service << 'SERVICE'
[Unit]
Description=CamWatch Next.js App
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/camApp/.next/standalone
Environment=NODE_ENV=production
ExecStart=/root/.bun/bin/bun server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE

# Copiar assets estaticos (Next.js standalone no los incluye)
mkdir -p /opt/camApp/.next/standalone/.next
cp -r /opt/camApp/.next/static /opt/camApp/.next/standalone/.next/static

systemctl daemon-reload
systemctl enable --now camapp.service

echo ""
echo "✅ Deploy completado!"
echo "   App → http://localhost:3000"
echo ""
echo "Comandos utiles:"
echo "  journalctl -u camapp -f     # Logs en vivo"
echo "  systemctl restart camapp    # Reiniciar"
echo "  systemctl status camapp     # Estado"
