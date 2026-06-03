# 3.10 — Observabilidad

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## Pilares de Observabilidad

```
         LOGS                    MÉTRICAS                 TRAZAS
         ─────                   ────────                 ──────
    Qué pasó y por qué       Cuánto y cómo está       Cómo fluye
                             el sistema                una request

    Pino (JSON)              Prometheus               OpenTelemetry (v1)
         │                        │                        │
         ▼                        ▼                        ▼
    stdout/logrotate         /metrics (Fastify)        Jaeger/Zipkin (v1)
         │                        │
         ▼                        ▼
    [v1: Loki]               Grafana Dashboard
```

---

## Métricas (MVP — Prometheus)

### Métricas HTTP del Backend

```
# Implementadas automáticamente con fastify-metrics

http_request_duration_seconds{method, route, status_code}  — histograma
http_requests_total{method, route, status_code}             — contador
http_active_connections                                      — gauge
```

### Métricas de Dominio (Custom)

```
# Cámaras
camwatch_cameras_total{status}          — gauge: total de cámaras por estado
camwatch_stream_tokens_issued_total     — contador: tokens de stream emitidos
camwatch_webrtc_sessions_active         — gauge: sesiones WebRTC activas (de MediaMTX)

# Autenticación
camwatch_login_attempts_total{result}   — contador: logins exitosos/fallidos
camwatch_active_sessions_total          — gauge: refresh tokens activos no revocados

# MediaMTX
camwatch_mediamtx_health_checks_total{result}    — contador: checks exitosos/fallidos
camwatch_mediamtx_api_request_duration_seconds   — histograma: latencia de la API de MediaMTX

# Sistema
camwatch_db_pool_active_connections     — gauge: conexiones activas al pool de DB
camwatch_db_query_duration_seconds{operation}   — histograma: latencia de queries
```

---

## Dashboard de Grafana

### Panel 1: Estado del Sistema (Overview)
- Número de cámaras online/offline/unknown
- Número de usuarios activos
- Sesiones WebRTC activas
- Estado de conectividad con MediaMTX

### Panel 2: Rendimiento de la API
- Request rate (req/s)
- Latencia p50, p95, p99
- Tasa de errores 4xx y 5xx
- Endpoints más lentos

### Panel 3: Autenticación y Seguridad
- Intentos de login exitosos vs fallidos
- Cuentas bloqueadas en las últimas 24h
- Rate limit triggers

### Panel 4: Streams de Video
- Timeline de estado de cada cámara (online/offline)
- Sesiones WebRTC activas por hora
- Tokens de stream emitidos por hora

### Panel 5: Infraestructura
- CPU y RAM del VPS (node_exporter)
- Latencia de red entre VPS y servidor remoto
- Uso de almacenamiento DB

---

## Alertas

### Alertas Críticas (notificación inmediata)

| Alerta | Condición | Canal |
|--------|-----------|-------|
| `MediaMTXDown` | MediaMTX no responde por > 5 minutos | Email + Webhook |
| `AllCamerasOffline` | Todas las cámaras están offline por > 5 minutos | Email + Webhook |
| `BackendDown` | `/health` no responde por > 1 minuto | Uptime monitor externo |
| `DatabaseDown` | Health check DB falla por > 2 minutos | Email |
| `DiskSpaceCritical` | Disco > 90% utilizado | Email |

### Alertas de Advertencia (notificación dentro de 1 hora)

| Alerta | Condición | Canal |
|--------|-----------|-------|
| `CameraOffline` | Una cámara específica offline > 10 minutos | Email |
| `HighErrorRate` | Tasa de errores 5xx > 5% por > 5 minutos | Email |
| `HighApiLatency` | p95 de latencia API > 500ms por > 5 minutos | Email |
| `BruteForceDetected` | > 50 intentos fallidos de login en 5 minutos | Email + Webhook |
| `DiskSpaceWarning` | Disco > 75% utilizado | Email |
| `TailscaleDisconnected` | No se puede alcanzar la IP Tailscale del servidor remoto | Email |

---

## Health Checks

### Endpoint: GET /health

```json
{
  "status": "ok",         // "ok" | "degraded" | "down"
  "timestamp": "...",
  "version": "1.0.0",
  "uptime": 86400,        // segundos desde el inicio
  "services": {
    "database": {
      "status": "ok",
      "responseTime": 5   // ms
    },
    "redis": {
      "status": "ok",
      "responseTime": 2   // ms
    },
    "mediamtx": {
      "status": "ok",     // "ok" | "degraded" | "down"
      "responseTime": 45, // ms
      "activeStreams": 8
    }
  }
}
```

**Lógica de status:**
- `ok`: Todos los servicios responden normalmente.
- `degraded`: MediaMTX no responde, pero DB y Redis están bien. El sistema funciona parcialmente.
- `down`: DB o Redis no responden. El sistema no está operativo.

**HTTP Status codes:**
- `ok` → 200
- `degraded` → 200 (para no triggear restart del contenedor)
- `down` → 503

---

## Monitoreo Externo (MVP)

Para el MVP, usar un servicio externo de uptime monitoring gratuito o de bajo costo:

| Servicio | Tipo | Qué monitorea |
|---------|------|---------------|
| UptimeRobot (free) | HTTP | GET /health cada 5 minutos |
| Better Uptime | HTTP + SSL | /health + expiración de certificado |

Estos servicios notifican al Admin por email cuando el sistema no responde.

---

## Tracing (v1 — No en MVP)

En v1, implementar distributed tracing con OpenTelemetry:

```
Request → Fastify (span: http.server)
   └── Auth Middleware (span: auth.verify)
   └── Camera Service (span: camera.get)
        └── DB Query (span: db.query)
        └── MediaMTX Client (span: mediamtx.api)
```

Esto permite identificar exactamente en qué paso se pierde tiempo cuando hay latencia alta.

---

## SLOs (Service Level Objectives)

| Métrica | SLO | Ventana |
|---------|-----|---------|
| Disponibilidad del servicio | > 99% | 30 días |
| Latencia API p95 | < 500ms | 7 días |
| Latencia video e2e | < 2 segundos | En tiempo real |
| Tasa de errores API | < 1% de requests 5xx | 24 horas |
| Tiempo de recuperación ante fallo | < 30 minutos | Por incidente |
