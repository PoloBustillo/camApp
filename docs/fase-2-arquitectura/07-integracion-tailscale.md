# 2.7 — Integración con Tailscale

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## ¿Por qué Tailscale?

Tailscale crea una red privada virtual mesh (basada en WireGuard) entre los nodos registrados en la misma "tailnet". Las ventajas para este proyecto son:

| Ventaja | Aplicación en el proyecto |
|---------|--------------------------|
| Sin configuración de router/NAT | No se necesita port-forwarding en la ubicación remota |
| Conectividad directa (P2P) | El VPS se conecta directamente al servidor remoto sin relay |
| Cifrado WireGuard | La comunicación entre VPS y servidor remoto es cifrada de extremo a extremo |
| ACLs centralizadas | Se puede restringir qué nodos pueden comunicarse con qué puertos |
| Resiliencia ante pérdida del control plane | Los nodos que ya se conocen mantienen conexión P2P |
| Autenticación por dispositivo | Solo dispositivos autorizados pueden unirse a la tailnet |

---

## Topología de la Red Tailscale

```
Tailscale Control Plane (tailscale.com)
              │
              │  Coordinación inicial
              │  y distribución de claves
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
┌──────────────┐    ┌──────────────────────────────┐
│   VPS        │    │  Servidor Remoto (Ubuntu)     │
│  backend     │    │                               │
│              │    │  MediaMTX                     │
│  IP Tailscale│◄──►│  API: 100.x.x.x:9997         │
│  100.y.y.y   │    │  IP Tailscale: 100.x.x.x     │
│              │    │                               │
│  Puerto      │    │  [Solo Tailscale]             │
│  accesible:  │    │  Puerto 9997 accesible        │
│  9997 del    │    │  para 100.y.y.y               │
│  servidor    │    └──────────────────────────────┘
│  remoto      │
└──────────────┘

Conexión: WireGuard (UDP 41641)
Cifrado: ChaCha20-Poly1305 (WireGuard)
```

---

## Configuración de Tailscale ACL

Las ACLs de Tailscale se definen en el admin panel de Tailscale (tailscale.com/admin/acls):

```json
{
  "acls": [
    {
      "action": "accept",
      "src": ["tag:vps"],
      "dst": ["tag:edge-server:9997"]
    },
    {
      "action": "accept",
      "src": ["tag:admin"],
      "dst": ["tag:edge-server:22", "tag:vps:22"]
    },
    {
      "action": "deny",
      "src": ["*"],
      "dst": ["tag:edge-server:9997"]
    }
  ],
  "tagOwners": {
    "tag:vps": ["autogroup:admin"],
    "tag:edge-server": ["autogroup:admin"],
    "tag:admin": ["autogroup:admin"]
  }
}
```

**Resultado:**
- El VPS (tag:vps) puede acceder al servidor remoto (tag:edge-server) en el puerto 9997 (API MediaMTX).
- Solo los administradores de Tailscale pueden acceder por SSH (tag:admin).
- Nadie más puede acceder al puerto 9997 del servidor remoto.

---

## Instalación y Configuración de Nodos

### Nodo 1: Servidor Remoto (Ubuntu)

```bash
# Instalación de Tailscale
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/focal.noalias.gpg | apt-key add -
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/focal.list | tee /etc/apt/sources.list.d/tailscale.list
apt-get update && apt-get install -y tailscale

# Autenticación y configuración
tailscale up \
  --authkey=<TAILSCALE_AUTH_KEY> \
  --advertise-tags=tag:edge-server \
  --hostname=edge-camwatch

# Verificar conectividad
tailscale status
tailscale ping 100.y.y.y
```

### Nodo 2: VPS Backend

```bash
# Tailscale se instala en el HOST del VPS (no dentro de Docker)
curl -fsSL https://tailscale.com/install.sh | sh

tailscale up \
  --authkey=<TAILSCALE_AUTH_KEY> \
  --advertise-tags=tag:vps \
  --hostname=vps-camwatch

# El backend (Docker) accede a Tailscale a través del host network
# MEDIAMTX_URL=http://100.x.x.x:9997 (IP Tailscale del servidor remoto)
```

---

## Integración del Backend con Tailscale

El backend (corriendo en Docker) no necesita instalación de Tailscale dentro del contenedor. Solo necesita:

1. El contenedor de backend usa `network_mode: host` O
2. El contenedor accede al host de Docker mediante `host.docker.internal`

**Configuración recomendada (docker-compose.yml):**

```yaml
# El backend se comunica con Tailscale a través del host
# La IP de MediaMTX (100.x.x.x) es enrutable desde el host del VPS
# gracias a Tailscale instalado en el host

services:
  backend:
    # Sin network_mode: host (preferido por aislamiento)
    # El host tiene la ruta Tailscale configurada
    # Los contenedores Docker pueden acceder a IPs Tailscale
    # a través de la tabla de rutas del host
    networks:
      - camwatch_network
    environment:
      - MEDIAMTX_URL=http://100.x.x.x:9997
```

> **Nota:** Por defecto, los contenedores Docker en modo bridge pueden acceder a las interfaces de red del host, incluyendo las rutas de Tailscale. Esto es suficiente para que el backend acceda a `100.x.x.x:9997`.

---

## Escenarios de Fallo y Recuperación

### Escenario 1: Control Plane de Tailscale no disponible

Tailscale usa el control plane (servidores de Tailscale) para distribuir claves y coordinar. Si el control plane no está disponible:

- **Impacto:** Los nodos que ya se conocen entre sí mantienen la conexión P2P (WireGuard directo).
- **Riesgo:** Si el servidor remoto se reinicia, puede que no pueda reconectarse sin el control plane.
- **Mitigación:** Usar la opción `--persistentKeepalive` de WireGuard para mantener conexiones vivas.

### Escenario 2: Servidor remoto se reinicia

Al reiniciar, Tailscale se reconecta automáticamente si está configurado como servicio systemd:

```bash
systemctl enable tailscaled
systemctl start tailscaled
```

### Escenario 3: Cambio de IP pública del servidor remoto

No hay impacto porque Tailscale maneja el enrutamiento por identidad de dispositivo, no por IP pública.

---

## Monitoreo de Conectividad Tailscale

El backend incluye un health check que verifica la conectividad con el servidor remoto antes de cada operación crítica:

```
Proceso: MediaMTX Health Check (cada 60s)
  1. Intenta GET http://100.x.x.x:9997/v3/paths (timeout: 3s)
  2. Si responde: estado = "connected"
  3. Si timeout: estado = "tailscale_unreachable"
     - Registra en log
     - Las cámaras se marcan como "unknown" (no "offline")
     - El frontend muestra advertencia de conectividad
```

---

## Alternativas a Tailscale (Para Evaluación Futura)

Si por alguna razón Tailscale no es viable:

| Alternativa | Complejidad | Ventaja | Desventaja |
|-------------|-------------|---------|-----------|
| WireGuard manual | Alta | Sin dependencia de tercero | Requiere IP estática o DynDNS, configuración compleja de NAT |
| OpenVPN | Media | Muy maduro | Mayor overhead, configuración compleja |
| Cloudflare Tunnel | Baja | Sin puertos abiertos | Dependencia de Cloudflare, solo HTTP |
| Nebula | Media | Opensource, similar a Tailscale | Requiere servidor lighthouse propio |
