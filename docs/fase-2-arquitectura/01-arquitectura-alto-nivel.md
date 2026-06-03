# 2.1 — Arquitectura de Alto Nivel

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## Visión General

CamWatch Platform sigue una arquitectura de **tres zonas** con separación clara de responsabilidades:

1. **Zona Edge (Remota):** Infraestructura en la ubicación física de las cámaras.
2. **Zona Cloud (VPS):** Backend y Frontend en servidor independiente.
3. **Zona Cliente:** Browser del usuario final.

---

## Diagrama de Arquitectura de Alto Nivel

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ZONA EDGE — Ubicación Remota (Ubuntu)                                       ║
║                                                                               ║
║  ┌─────────┐  RTSP   ┌──────────────────────────────────────────────────┐   ║
║  │ Cám 1   ├────────►│                                                  │   ║
║  └─────────┘         │           MediaMTX Server                        │   ║
║  ┌─────────┐  RTSP   │                                                  │   ║
║  │ Cám 2   ├────────►│  • Ingesta RTSP de cada cámara                   │   ║
║  └─────────┘         │  • Re-transmite como WebRTC (WHEP)               │   ║
║      ...             │  • API HTTP para gestión de streams               │   ║
║  ┌─────────┐  RTSP   │  • Puerto 8554 (RTSP in), 8889 (WebRTC/HTTP)     │   ║
║  │ Cám N   ├────────►│                                                  │   ║
║  └─────────┘         └──────────────────┬──────────────────────────────┘   ║
║                                          │                                    ║
║                       ┌─────────────────▼────────────────────┐              ║
║                       │         Tailscale Agent               │              ║
║                       │  • IP Tailscale: 100.x.x.x            │              ║
║                       │  • Expone MediaMTX solo en tailnet    │              ║
║                       └─────────────────┬────────────────────┘              ║
╚═════════════════════════════════════════╪════════════════════════════════════╝
                                          │  Red Privada Tailscale (WireGuard)
╔═════════════════════════════════════════╪════════════════════════════════════╗
║  ZONA CLOUD — VPS Independiente         │                                    ║
║                                         ▼                                    ║
║  ┌──────────────────────────────────────────────────────────────────────┐   ║
║  │                     Tailscale Agent (VPS)                            │   ║
║  │  • IP Tailscale: 100.y.y.y                                           │   ║
║  │  • Conecta con servidor remoto a través de la tailnet                │   ║
║  └─────────────────────────────┬────────────────────────────────────────┘   ║
║                                 │                                            ║
║  ┌──────────────────────────────▼────────────────────────────────────────┐  ║
║  │                        Nginx (Reverse Proxy)                          │  ║
║  │  • TLS Termination (Let's Encrypt)                                    │  ║
║  │  • /api/* → Backend (Puerto 3001)                                     │  ║
║  │  /* → Frontend Next.js (Puerto 3000)                                  │  ║
║  └────────────────┬─────────────────────────────┬─────────────────────── ┘  ║
║                   │                             │                            ║
║  ┌────────────────▼──────────┐   ┌─────────────▼────────────────────────┐  ║
║  │   Backend API (Fastify)   │   │   Frontend (Next.js)                  │  ║
║  │  • Puerto 3001            │   │  • Puerto 3000                        │  ║
║  │  • REST API               │   │  • App Router (SSR + Client)          │  ║
║  │  • JWT Auth               │   │  • WebRTC Player                      │  ║
║  │  • Gestión de cámaras     │   │  • Dashboard de monitoreo             │  ║
║  │  • Gestión de usuarios    │   │  • Gestión de layouts                 │  ║
║  │  • Proxy de streams       │   │  • Gestión de cámaras (Admin)         │  ║
║  └────────────────┬──────────┘   └──────────────────────────────────────┘  ║
║                   │                                                          ║
║  ┌────────────────▼──────────┐   ┌────────────────────────────────────────┐ ║
║  │   PostgreSQL              │   │   Redis (Caché + Token Blacklist)      │ ║
║  │  • Cámaras                │   │  • Refresh token revocation            │ ║
║  │  • Usuarios               │   │  • Caché de estado de streams          │ ║
║  │  • Layouts                │   │  • Rate limiting                       │ ║
║  │  • Ubicaciones            │   └────────────────────────────────────────┘ ║
║  │  • Sesiones/Auditoría     │                                              ║
║  └───────────────────────────┘                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
                              │  HTTPS / WSS (Internet público)
╔═════════════════════════════╪════════════════════════════════════════════════╗
║  ZONA CLIENTE — Browser     │                                                ║
║                             ▼                                                ║
║  ┌──────────────────────────────────────────────────────────────────────┐   ║
║  │                    Browser (Chrome / Firefox / Safari / Edge)        │   ║
║  │                                                                       │   ║
║  │  Next.js App (Client-side)                                           │   ║
║  │  ┌─────────────────────────┐   ┌──────────────────────────────────┐  │   ║
║  │  │  Dashboard / Layouts    │   │  WebRTC Player (RTCPeerConnection)│  │   ║
║  │  │  Gestión de Cámaras     │   │                                  │  │   ║
║  │  │  Gestión de Usuarios    │   │  WHEP ◄──────── MediaMTX WHEP   │  │   ║
║  │  └─────────────────────────┘   │  Signaling via Backend API       │  │   ║
║  │                                 └──────────────────────────────────┘  │   ║
║  └──────────────────────────────────────────────────────────────────────┘   ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## Capas del Sistema

### Capa 1: Edge Media Layer
**Responsabilidad:** Capturar y retransmitir streams de video.

| Componente | Tecnología | Función |
|-----------|-----------|---------|
| Servidor de cámaras | MediaMTX | Ingesta RTSP, retransmite WebRTC/WHEP |
| Conectividad segura | Tailscale | VPN mesh, expone MediaMTX solo en tailnet |

### Capa 2: Application Layer (VPS)
**Responsabilidad:** Lógica de negocio, autenticación, gestión de datos.

| Componente | Tecnología | Función |
|-----------|-----------|---------|
| API Backend | Fastify (Node.js) | REST API, gestión de recursos, proxy de señalización |
| Frontend | Next.js | UI de monitoreo y administración |
| Reverse Proxy | Nginx | TLS termination, routing |
| Base de datos | PostgreSQL | Persistencia de datos |
| Caché/Tokens | Redis | Token blacklist, caché de estado |

### Capa 3: Client Layer
**Responsabilidad:** Renderizado de UI y reproducción de video.

| Componente | Tecnología | Función |
|-----------|-----------|---------|
| Browser App | Next.js (React) | Interfaz de usuario |
| Video Player | RTCPeerConnection (WebRTC nativo) | Reproducción de streams con baja latencia |

---

## Principios Arquitectónicos

| Principio | Aplicación |
|-----------|-----------|
| **Separación de preocupaciones** | Medios (MediaMTX), Lógica (Backend), Presentación (Frontend) en componentes separados |
| **Zero-trust networking** | Tailscale para el acceso a la red de cámaras; JWT para la API |
| **Stateless Backend** | El backend no mantiene estado de sesión; JWT en el cliente |
| **Passthrough de video** | MediaMTX no transcodifica; preserva el stream original |
| **Credenciales en el servidor** | Las credenciales RTSP solo existen en el backend; nunca en el cliente |
| **Escalabilidad horizontal preparada** | El backend puede escalarse añadiendo instancias detrás del proxy |

---

## Flujo de Datos Principal

```
1. Usuario → HTTPS → Nginx → Next.js   [Carga la aplicación]
2. Usuario → POST /auth/login → Backend  [Obtiene JWT]
3. Browser → GET /cameras/:id/stream    [Solicita parámetros WebRTC]
4. Backend → Tailscale → MediaMTX API   [Verifica stream activo]
5. Backend → Browser                    [Devuelve SDP offer/answer]
6. Browser → WebRTC → MediaMTX:8889     [Establece conexión WebRTC directa]
7. MediaMTX → Browser                   [Transmite video H.264 vía WebRTC]
```

> **Nota:** El paso 6 establece una conexión WebRTC directa desde el browser al MediaMTX. Esto requiere que el puerto WebRTC de MediaMTX sea accesible desde internet, O que la señalización se haga a través del backend y el video viaje por la red privada Tailscale (ver Flujo de Video para detalles y trade-offs).

---

## Decisiones de Diseño Críticas

### ¿El browser se conecta directamente a MediaMTX o pasa por el backend?

**Opción A — Conexión directa (recomendada para MVP):**
- Browser → MediaMTX WebRTC directamente
- MediaMTX expone un puerto WebRTC (8889) en internet público
- El backend gestiona la autenticación y autorización; MediaMTX valida un token temporal
- **Ventaja:** Menor latencia, menor carga en el backend
- **Desventaja:** MediaMTX necesita un puerto expuesto al público (con autenticación)

**Opción B — Proxy a través del backend:**
- Browser → Backend → MediaMTX (relay de medios)
- El backend actúa como relay WebRTC
- **Ventaja:** MediaMTX completamente privado (solo Tailscale)
- **Desventaja:** Alta carga de CPU/red en el backend para cada stream

**Decisión:** Opción A con tokens temporales de acceso. MediaMTX expone el puerto WebRTC con autenticación por token de corta duración (30 segundos) generado por el backend.
