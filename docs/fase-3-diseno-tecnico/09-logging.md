# 3.9 — Logging

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## Estrategia de Logging

| Decisión | Valor |
|----------|-------|
| Librería | Pino (Node.js) — alto rendimiento, JSON estructurado |
| Formato | JSON estructurado (parseable por herramientas) |
| Nivel en producción | `info` |
| Nivel en desarrollo | `debug` |
| Destino en producción | `stdout` → Docker → sistema de logs del host |
| Rotación | Gestionada por logrotate en el host (no en la app) |
| Retención | 30 días en el servidor, archivado 90 días |
| Correlación | `requestId` en cada log de request |

---

## Niveles de Log

| Nivel | Cuándo usar | Ejemplos |
|-------|-------------|---------|
| `fatal` | El proceso debe terminar | DB no accesible al arrancar |
| `error` | Error inesperado que afecta una operación | Excepción no manejada, fallo de query DB |
| `warn` | Situación anómala pero recuperable | Stream de cámara offline, retry de MediaMTX |
| `info` | Eventos normales del negocio | Request HTTP, login exitoso, cámara creada |
| `debug` | Detalles de depuración | Parámetros de query, estado de caché |
| `trace` | Muy detallado (solo desarrollo) | Cada línea de ejecución |

---

## Estructura del Log (Campos Estándar)

```json
{
  "level": 30,                            // Pino numeric: 10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal
  "levelName": "info",
  "time": "2026-06-03T10:15:30.123Z",     // ISO 8601 UTC
  "pid": 1234,
  "hostname": "vps-camwatch",
  "service": "camwatch-backend",
  "version": "1.0.0",
  "requestId": "req_550e8400e29b",        // UUID corto del request (si aplica)
  "userId": "550e8400-...",               // ID del usuario autenticado (si aplica)
  "userRole": "operator",                 // Rol del usuario (si aplica)
  "msg": "Camera stream token requested", // Mensaje del log
  "data": { ... }                         // Datos adicionales del evento
}
```

---

## Logs de Request HTTP

Cada request HTTP genera automáticamente dos logs (inicio y fin):

### Log de inicio de request (debug):
```json
{
  "level": 20,
  "msg": "incoming request",
  "requestId": "req_abc123",
  "method": "GET",
  "url": "/api/v1/cameras",
  "userAgent": "Mozilla/5.0...",
  "ip": "203.0.113.50",
  "userId": "uuid-del-usuario"
}
```

### Log de respuesta (info):
```json
{
  "level": 30,
  "msg": "request completed",
  "requestId": "req_abc123",
  "method": "GET",
  "url": "/api/v1/cameras",
  "statusCode": 200,
  "responseTime": 45,    // ms
  "userId": "uuid-del-usuario"
}
```

---

## Logs de Dominio (Eventos de Negocio)

### Autenticación
```json
// Login exitoso
{ "msg": "user.login.success", "userId": "uuid", "email": "user@ejemplo.com", "ip": "..." }

// Login fallido
{ "msg": "user.login.failed", "email": "user@ejemplo.com", "reason": "INVALID_CREDENTIALS", "ip": "...", "attempts": 3 }

// Cuenta bloqueada
{ "msg": "user.account.locked", "userId": "uuid", "lockedUntil": "...", "ip": "..." }
```

### Streams
```json
// Acceso a stream
{ "msg": "stream.access", "userId": "uuid", "cameraId": "uuid", "cameraSlug": "entrada-principal", "ip": "..." }

// Cambio de estado de cámara
{ "msg": "camera.status.changed", "cameraId": "uuid", "previousStatus": "online", "newStatus": "offline" }

// Error de MediaMTX
{ "level": 50, "msg": "mediamtx.request.failed", "url": "http://100.x.x.x:9997/v3/paths/camera1", "error": "ECONNREFUSED", "attempt": 1 }
```

### Operaciones CRUD
```json
// Cámara creada
{ "msg": "camera.created", "userId": "uuid", "cameraId": "uuid", "slug": "entrada-principal" }

// Usuario creado
{ "msg": "user.created", "adminId": "uuid", "newUserId": "uuid", "role": "operator" }
```

---

## Logs de Errores

```json
// Error inesperado
{
  "level": 50,
  "msg": "unhandled_error",
  "requestId": "req_abc123",
  "error": {
    "name": "Error",
    "message": "duplicate key value violates unique constraint",
    "stack": "Error: ...\n  at ..."  // Solo en desarrollo, nunca en producción
  }
}

// Error de base de datos
{
  "level": 50,
  "msg": "database.query.failed",
  "requestId": "req_abc123",
  "query": "cameras.findById",
  "error": "connection refused"
}
```

---

## Información Excluida de Logs

| Información | Razón |
|------------|-------|
| Contraseñas | Datos sensibles |
| Tokens JWT completos | Datos sensibles |
| Credenciales RTSP | Datos sensibles |
| Stack traces completos | Solo en desarrollo; expone internos en producción |
| Datos personales completos | GDPR / privacidad |

**Regla:** Si un campo se llama `password`, `token`, `secret`, `key`, `credential` — no registrarlo.

---

## Configuración de Pino en Producción

```javascript
// Configuración del logger Pino para producción
{
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level(label) { return { level: label, levelName: label }; }
  },
  redact: {
    paths: ['*.password', '*.passwordHash', '*.token', '*.secret', '*.rtspUrl', '*.rtspUrlEncrypted'],
    censor: '[REDACTED]'
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    }),
    res: (res) => ({
      statusCode: res.statusCode
    })
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  base: {
    service: 'camwatch-backend',
    version: process.env.APP_VERSION || 'unknown'
  }
}
```

---

## Estrategia de Centralización de Logs (v1)

En el MVP, los logs van a stdout y se gestionan con logrotate en el host. En v1, centralizar con:

```
Opción A (self-hosted): Loki + Grafana + Promtail
  • Bajo costo, control total
  • Loki almacena logs indexados
  • Grafana para visualización y alertas de logs

Opción B (SaaS): Datadog, Logtail, Papertrail
  • Menor esfuerzo de configuración
  • Costo mensual
```
