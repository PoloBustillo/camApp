# 2.3 — Diagramas de Despliegue

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## Topología de Despliegue Completa

```
INTERNET PÚBLICO
─────────────────────────────────────────────────────────────────────
│
│   Browser del Usuario (cualquier lugar con internet)
│   ┌────────────────────────────────────────────────────────────┐
│   │  Chrome / Firefox / Safari / Edge                          │
│   │  Conexión HTTPS a: https://camwatch.ejemplo.com            │
│   │  Conexión WebRTC a: https://camwatch.ejemplo.com:8889      │
│   └────────────────────────────────┬───────────────────────────┘
│                                    │  HTTPS (443) + WebRTC (8889)
│                                    ▼
─────────────────────────────────────────────────────────────────────
VPS (Nube) — Ej: DigitalOcean, Hetzner, Linode
─────────────────────────────────────────────────────────────────────
│
│   ┌────────────────────────────────────────────────────────────┐
│   │  Docker Host (Ubuntu 22.04)                                │
│   │  IP Pública: 203.0.113.x                                   │
│   │  IP Tailscale: 100.y.y.y                                   │
│   │                                                            │
│   │  ┌──────────────────────────────────────────────────────┐ │
│   │  │  docker-compose.yml                                   │ │
│   │  │                                                       │ │
│   │  │  ┌─────────────────────────────────────────────────┐ │ │
│   │  │  │  nginx                                          │ │ │
│   │  │  │  • Imagen: nginx:alpine                         │ │ │
│   │  │  │  • Puertos: 80, 443 (host → container)          │ │ │
│   │  │  │  • TLS: Let's Encrypt (Certbot)                 │ │ │
│   │  │  │  • Config: /etc/nginx/conf.d/camwatch.conf      │ │ │
│   │  │  │  • Proxy: /api → backend:3001                   │ │ │
│   │  │  │  • Proxy: / → frontend:3000                     │ │ │
│   │  │  └─────────────────────────────────────────────────┘ │ │
│   │  │                                                       │ │
│   │  │  ┌─────────────────────────────────────────────────┐ │ │
│   │  │  │  backend                                        │ │ │
│   │  │  │  • Imagen: camwatch/backend:latest              │ │ │
│   │  │  │  • Puerto interno: 3001                         │ │ │
│   │  │  │  • Env: DATABASE_URL, JWT_SECRET, REDIS_URL,    │ │ │
│   │  │  │         MEDIAMTX_URL, MEDIAMTX_TOKEN            │ │ │
│   │  │  │  • Red: camwatch_network                        │ │ │
│   │  │  └─────────────────────────────────────────────────┘ │ │
│   │  │                                                       │ │
│   │  │  ┌─────────────────────────────────────────────────┐ │ │
│   │  │  │  frontend                                       │ │ │
│   │  │  │  • Imagen: camwatch/frontend:latest             │ │ │
│   │  │  │  • Puerto interno: 3000                         │ │ │
│   │  │  │  • Env: NEXT_PUBLIC_API_URL                     │ │ │
│   │  │  │  • Red: camwatch_network                        │ │ │
│   │  │  └─────────────────────────────────────────────────┘ │ │
│   │  │                                                       │ │
│   │  │  ┌─────────────────────────────────────────────────┐ │ │
│   │  │  │  postgres                                       │ │ │
│   │  │  │  • Imagen: postgres:16-alpine                   │ │ │
│   │  │  │  • Puerto interno: 5432                         │ │ │
│   │  │  │  • Volumen: pgdata (persistente)                │ │ │
│   │  │  │  • DB: camwatch_db                              │ │ │
│   │  │  └─────────────────────────────────────────────────┘ │ │
│   │  │                                                       │ │
│   │  │  ┌─────────────────────────────────────────────────┐ │ │
│   │  │  │  redis                                          │ │ │
│   │  │  │  • Imagen: redis:7-alpine                       │ │ │
│   │  │  │  • Puerto interno: 6379                         │ │ │
│   │  │  │  • Persistencia: AOF habilitado                 │ │ │
│   │  │  └─────────────────────────────────────────────────┘ │ │
│   │  └──────────────────────────────────────────────────────┘ │
│   │                                                            │
│   │  Tailscale Agent (en el host, no en Docker)               │
│   │  • IP: 100.y.y.y                                          │
│   │  • Se comunica con servidor remoto: 100.x.x.x             │
│   │  • El backend lo accede a través del host network         │
│   └────────────────────────────────────────────────────────────┘
│
│                    Red Tailscale (WireGuard)
│                    ─────────────────────────
│
─────────────────────────────────────────────────────────────────────
UBICACIÓN REMOTA — Servidor Edge
─────────────────────────────────────────────────────────────────────
│
│   ┌────────────────────────────────────────────────────────────┐
│   │  Ubuntu 22.04 (hardware dedicado o VM)                     │
│   │  IP Tailscale: 100.x.x.x                                   │
│   │  IP Local: 192.168.1.x                                     │
│   │                                                            │
│   │  ┌──────────────────────────────────────────────────────┐ │
│   │  │  MediaMTX (binario nativo, systemd service)           │ │
│   │  │  • Puerto 8554: RTSP inbound (solo LAN local)        │ │
│   │  │  • Puerto 8889: WebRTC/WHEP (acceso controlado)      │ │
│   │  │  • Puerto 9997: API HTTP (solo Tailscale)            │ │
│   │  │  • Config: /etc/mediamtx/mediamtx.yml               │ │
│   │  │                                                       │ │
│   │  │  Paths configurados:                                 │ │
│   │  │    camera1: rtsp://user:pass@192.168.1.101/stream1   │ │
│   │  │    camera2: rtsp://user:pass@192.168.1.102/stream1   │ │
│   │  │    ...                                               │ │
│   │  └──────────────────────────────────────────────────────┘ │
│   │                                                            │
│   │  ┌──────────────────────────────────────────────────────┐ │
│   │  │  Tailscale Agent (systemd service)                   │ │
│   │  │  • IP: 100.x.x.x                                     │ │
│   │  │  • ACL: solo acepta conexiones del VPS (100.y.y.y)   │ │
│   │  │  • Expone: puerto 9997 de MediaMTX API               │ │
│   │  └──────────────────────────────────────────────────────┘ │
│   └────────────────────────────────────────────────────────────┘
│
│   Red Local (LAN): 192.168.1.0/24
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│   │ Cám 1   │  │ Cám 2   │  │ Cám ... │  │ Cám N   │
│   │ .101    │  │ .102    │  │ ...     │  │ .110    │
│   └─────────┘  └─────────┘  └─────────┘  └─────────┘
```

---

## Puertos y Protocolos por Nodo

### Servidor Edge (Ubuntu Remoto)

| Puerto | Protocolo | Origen Permitido | Destino | Descripción |
|--------|-----------|-----------------|---------|-------------|
| 8554 | TCP | LAN 192.168.1.0/24 | MediaMTX | RTSP inbound desde cámaras |
| 8889 | TCP/UDP | Internet (controlado) | MediaMTX | WebRTC/WHEP outbound |
| 9997 | TCP | Solo Tailscale (100.y.y.y) | MediaMTX API | API HTTP de gestión |
| 41641 | UDP | Internet | Tailscale | WireGuard (Tailscale) |

> **Nota sobre 8889:** Si se sigue la arquitectura de conexión directa browser → MediaMTX, este puerto necesita ser accesible desde internet. Se protege con tokens temporales. Si esto no es aceptable, se puede usar el backend como relay (mayor carga).

### VPS (Servidor Backend/Frontend)

| Puerto | Protocolo | Origen Permitido | Destino | Descripción |
|--------|-----------|-----------------|---------|-------------|
| 80 | TCP | Internet | Nginx | HTTP → redirect a HTTPS |
| 443 | TCP | Internet | Nginx | HTTPS (app y API) |
| 3000 | TCP | Solo Docker network | Frontend | Next.js (interno) |
| 3001 | TCP | Solo Docker network | Backend | API Fastify (interno) |
| 5432 | TCP | Solo Docker network | PostgreSQL | Base de datos (interno) |
| 6379 | TCP | Solo Docker network | Redis | Caché (interno) |
| 41641 | UDP | Internet | Tailscale | WireGuard (Tailscale) |

---

## Configuración de Firewall (UFW) — VPS

```
# Reglas UFW en el VPS
ufw allow 22/tcp      # SSH (solo desde IPs confiables si es posible)
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw allow 41641/udp   # Tailscale WireGuard
ufw deny incoming
ufw allow outgoing
```

## Configuración de Firewall (UFW) — Servidor Remoto

```
# Reglas UFW en el servidor remoto
ufw allow 22/tcp                          # SSH
ufw allow from 192.168.1.0/24 to any port 8554  # RTSP solo LAN
ufw allow 8889/tcp                        # WebRTC (si acceso directo)
ufw allow 8889/udp                        # WebRTC UDP
ufw deny 9997                             # API MediaMTX solo por Tailscale
ufw allow 41641/udp                       # Tailscale WireGuard
```

---

## Estrategia de Despliegue

### Ambientes

| Ambiente | Dominio | VPS | Propósito |
|---------|---------|-----|-----------|
| Producción | camwatch.ejemplo.com | VPS-PROD | Uso real |
| Staging | staging.camwatch.ejemplo.com | VPS-PROD (mismo, diferente puerto) o VPS separado | QA y pruebas pre-producción |
| Desarrollo | localhost:3000 | — | Desarrollo local con MediaMTX simulado |

### Pipeline de Despliegue

```
Commit → GitHub Actions → Build Docker images → Push a Registry
    → SSH deploy al VPS → docker compose pull → docker compose up -d
    → Health checks → Notificación de éxito/fallo
```

### Estrategia de Rollback

1. Cada imagen Docker se etiqueta con el hash del commit.
2. El `docker-compose.yml` de producción referencia versiones específicas.
3. En caso de fallo: `docker compose down && docker compose up -d` con la versión anterior.
4. RTO objetivo en rollback: < 5 minutos.
