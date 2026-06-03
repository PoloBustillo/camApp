# 2.6 — Integración con MediaMTX

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## ¿Qué es MediaMTX?

MediaMTX (antes llamado rtsp-simple-server) es un servidor de medios en tiempo real de código abierto que:
- Acepta streams RTSP, RTMP, SRT, HLS entrantes.
- Re-distribuye como WebRTC, RTSP, HLS, RTMP, SRT salientes.
- Expone una API HTTP REST para gestión de streams en tiempo real.
- Se configura con un archivo YAML y puede reconfigurarse en caliente vía API.

**Repositorio:** https://github.com/bluenviron/mediamtx  
**Versión mínima requerida:** v1.7.0 (soporte WHEP estable)

---

## API de MediaMTX Relevante para el Backend

### Endpoints utilizados por el backend

```
Base URL (vía Tailscale): http://100.x.x.x:9997

GET  /v3/paths                    → Lista todos los paths configurados
GET  /v3/paths/{name}             → Estado de un path específico
POST /v3/config/paths/add/{name}  → Agrega un path dinámicamente
PATCH /v3/config/paths/{name}     → Actualiza configuración de un path
DELETE /v3/config/paths/{name}    → Elimina un path
GET  /v3/rtspconns                → Lista conexiones RTSP activas
GET  /v3/webrtcsessions           → Lista sesiones WebRTC activas
```

### Estructura de respuesta de GET /v3/paths/{name}

```json
{
  "name": "camera1",
  "source": {
    "type": "rtspSource",
    "id": "29e06e19-c386-4bfc-847a-fc21c94c9b2d"
  },
  "ready": true,
  "readyTime": "2026-06-03T10:00:00Z",
  "tracks": [
    { "type": "video", "codec": "H264" },
    { "type": "audio", "codec": "MPEG-4 Audio" }
  ],
  "bytesReceived": 1234567,
  "bytesSent": 7654321,
  "readers": [
    { "type": "webRTCSession", "id": "abc123" }
  ]
}
```

---

## Modelo de Gestión de Paths

### Adición Dinámica de Cámara

Cuando el Admin agrega una nueva cámara a través de la UI, el backend:

1. Valida y almacena la cámara en PostgreSQL.
2. Genera el nombre del path: `camera_{uuid_corto}` o `camera_{slug}`.
3. Llama a MediaMTX API para registrar el path dinámicamente.
4. MediaMTX inicia la conexión RTSP con la cámara.
5. El backend actualiza el estado de la cámara a "activa" o "inactiva" según la respuesta.

```
POST http://100.x.x.x:9997/v3/config/paths/add/camera1
Content-Type: application/json

{
  "source": "rtsp://admin:password@192.168.1.101:554/stream1",
  "sourceOnDemand": false,
  "record": false,
  "maxReaders": 10
}
```

### Eliminación de Cámara

```
DELETE http://100.x.x.x:9997/v3/config/paths/camera1
```

### Verificación de Estado de Stream

El backend consulta periódicamente (o bajo demanda) el estado de cada stream:

```
GET http://100.x.x.x:9997/v3/paths/camera1

Respuesta "ready: true"  → Cámara conectada y transmitiendo
Respuesta "ready: false" → Cámara desconectada o no disponible
Respuesta 404            → Path no configurado en MediaMTX
```

---

## Configuración de MediaMTX (mediamtx.yml)

```yaml
# /etc/mediamtx/mediamtx.yml

###############################################################################
# Configuración general
###############################################################################
logLevel: info
logDestinations: [stdout, file]
logFile: /var/log/mediamtx/mediamtx.log

# API de gestión
api: yes
apiAddress: :9997
# La API escucha en todas las interfaces pero el firewall solo permite Tailscale

###############################################################################
# RTSP (inbound de cámaras)
###############################################################################
rtsp: yes
rtspAddress: :8554
# Solo accesible desde la LAN local (controlado por firewall)

###############################################################################
# WebRTC (outbound hacia browsers)
###############################################################################
webrtc: yes
webrtcAddress: :8889
webrtcEncryption: no      # TLS terminado en Nginx del VPS si se usa proxy
                           # O yes si MediaMTX sirve directamente al browser

# STUN para ICE
webrtcICEServers2:
  - urls: [stun:stun.l.google.com:19302]
# En producción agregar servidor TURN propio

###############################################################################
# Autenticación WebRTC vía JWT
###############################################################################
auth:
  - action: read
    path: "~.*"
    ips: []               # Cualquier IP
    query: ""
    user: ""
    pass: ""
    jwtClaimsKey: "mediamtxPath"  # El JWT debe tener este claim
    # MediaMTX valida el JWT con la clave pública

authJWTJWKS: ""
authJWTClaimKey: "mediamtxPath"

# Para validación JWT, MediaMTX usa el secret compartido
# Configurado como variable de entorno MEDIAMTX_AUTH_JWT_SECRET

###############################################################################
# Paths (configuración base — el backend agrega más dinámicamente)
###############################################################################
pathDefaults:
  sourceOnDemand: no
  record: no
  maxReaders: 20
  overridePublisher: no

paths: {}
# Los paths se agregan dinámicamente vía API cuando el Admin agrega cámaras
```

---

## Seguridad de la API de MediaMTX

La API de MediaMTX (puerto 9997) **solo es accesible a través de la red Tailscale**:

```
Backend (VPS) → Tailscale → Servidor Remoto → MediaMTX API

Firewall del servidor remoto:
  - Bloquear 9997 desde cualquier origen
  - Tailscale maneja el acceso a través de WireGuard
  - ACL de Tailscale: solo 100.y.y.y (VPS) puede acceder a 100.x.x.x:9997
```

### Autenticación de la API de MediaMTX

MediaMTX soporta autenticación básica en su API. Se configura con:

```yaml
api: yes
apiAddress: :9997
apiEncryption: no  # TLS no necesario en red Tailscale
# Sin auth adicional — la seguridad la provee Tailscale
# En v1: agregar apiUsername y apiPassword como capa extra de defensa
```

---

## Monitoreo de Streams desde el Backend

### Health Check de Streams (Proceso Periódico)

El backend ejecuta un job periódico (cada 60 segundos) que:

1. Obtiene todos los cámaras activas de PostgreSQL.
2. Para cada cámara, consulta el estado del path en MediaMTX.
3. Actualiza el campo `status` en PostgreSQL (online/offline/unknown).
4. Si el estado cambió, registra el evento en la tabla `stream_events`.

```
Proceso: StreamHealthCheck (ejecuta cada 60s)

  Para cada cámara en DB:
    path_status = GET /v3/paths/{cameraSlug}
    
    Si path_status.ready == true:
      DB.cameras.setStatus(cameraId, 'online')
    
    Si path_status.ready == false:
      DB.cameras.setStatus(cameraId, 'offline')
    
    Si response == 404:
      DB.cameras.setStatus(cameraId, 'not_configured')
      → Intenta registrar el path nuevamente en MediaMTX
```

---

## Manejo de Fallos de Comunicación con MediaMTX

| Escenario | Comportamiento del Backend |
|----------|---------------------------|
| MediaMTX no responde (timeout) | Retry 3 veces con backoff. Si persiste, marca todas las cámaras como "desconocidas". Log de error. |
| MediaMTX devuelve 401 | Error de configuración de credenciales. Alert al administrador. |
| MediaMTX devuelve 404 para un path | El path no está configurado. Backend intenta re-registrarlo. |
| Tailscale desconectado | El backend detecta que no puede alcanzar la IP Tailscale. Circuit breaker activo. |
| MediaMTX reiniciado | Los paths dinámicos se pierden. El backend debe re-registrarlos al detectar que están ausentes. |

### Re-registro Automático de Paths

Si MediaMTX se reinicia, los paths dinámicos se pierden (solo persisten los del YAML). El backend tiene una lógica de recuperación:

1. Al arrancar el backend, registra todos los paths de cámaras activas en MediaMTX.
2. Si el health check detecta un path ausente (404), lo vuelve a registrar.
3. Si un path no puede registrarse después de 3 intentos, la cámara se marca como "error de configuración".
