# 3.5 — Eventos del Sistema

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## Categorías de Eventos

El sistema produce dos tipos de eventos:

1. **Eventos de Dominio (internos):** Se generan cuando algo importante ocurre en el dominio. Son síncronos y se procesan dentro del mismo proceso del backend.
2. **Eventos de Sistema (infraestructura):** Cambios de estado detectados por procesos periódicos (health checks). Se registran en la base de datos.

---

## Eventos de Dominio

### Categoría: Autenticación

| Evento | Disparado por | Acción resultante |
|--------|--------------|-------------------|
| `auth.login.success` | Login exitoso | Actualizar `lastLoginAt`. Registrar en audit_log. |
| `auth.login.failed` | Credenciales incorrectas | Incrementar `failedAttempts`. Registrar en audit_log. |
| `auth.account.locked` | failedAttempts >= 5 | Establecer `lockedUntil`. Registrar en audit_log. |
| `auth.logout` | Logout explícito | Revocar refresh token. Registrar en audit_log. |
| `auth.token.refresh` | Renovación de token | Log de actividad (solo debug level). |

### Categoría: Cámaras

| Evento | Disparado por | Acción resultante |
|--------|--------------|-------------------|
| `camera.created` | POST /cameras | Registrar path en MediaMTX. Registrar en audit_log. |
| `camera.updated` | PATCH /cameras/:id | Actualizar configuración en MediaMTX (si cambió rtspUrl). Registrar en audit_log. |
| `camera.deleted` | DELETE /cameras/:id | Eliminar path de MediaMTX. Registrar en audit_log. |
| `camera.stream.accessed` | GET /cameras/:id/stream-token | Registrar en audit_log (quién accedió a qué cámara). |
| `camera.status.changed` | Health check periódico | Actualizar DB. Registrar en stream_events. |

### Categoría: Usuarios

| Evento | Disparado por | Acción resultante |
|--------|--------------|-------------------|
| `user.created` | POST /users | Registrar en audit_log. (Futuro: enviar email de bienvenida) |
| `user.updated` | PATCH /users/:id | Registrar en audit_log. |
| `user.deleted` | DELETE /users/:id | Revocar todos los refresh tokens activos del usuario. Registrar en audit_log. |
| `user.role.changed` | PATCH /users/:id (rol) | Revocar sesiones activas (para que tomen el nuevo rol). Registrar en audit_log. |

### Categoría: Layouts

| Evento | Disparado por | Acción resultante |
|--------|--------------|-------------------|
| `layout.created` | POST /layouts | Registrar en audit_log. |
| `layout.updated` | PATCH /layouts/:id | Registrar en audit_log. |
| `layout.deleted` | DELETE /layouts/:id | Registrar en audit_log. |

---

## Eventos del Proceso de Health Check

El backend ejecuta un proceso periódico cada 60 segundos que:

1. Consulta el estado de cada stream en MediaMTX.
2. Compara con el estado almacenado en la DB.
3. Si hay cambio, emite un evento `camera.status.changed`.

### Máquina de Estados del Stream

```
         ┌────────────────────────────────────┐
         │  UNKNOWN (estado inicial)          │
         └────────────────┬───────────────────┘
                          │ Primera consulta
              ┌───────────┴───────────┐
              │ ready: true           │ ready: false
              ▼                       ▼
         ┌─────────┐           ┌──────────┐
         │ ONLINE  │           │ OFFLINE  │
         └────┬────┘           └────┬─────┘
              │                    │
              │ ready: false       │ ready: true
              ▼                    ▼
         ┌──────────┐         ┌─────────┐
         │ OFFLINE  │         │ ONLINE  │
         └──────────┘         └─────────┘
              │
              │ 404 path not found
              ▼
         ┌──────────────────────┐
         │ ERROR (no configurado│
         │ en MediaMTX)         │
         └──────────────────────┘
```

---

## Eventos WebSocket (Frontend) — Futuro v1

En el MVP, el frontend actualiza el estado de los streams por polling al backend (GET /cameras cada 30s para conocer estados actualizados). En v1 se implementará WebSocket para actualizaciones en tiempo real:

### Eventos enviados al cliente

```json
// Conexión: wss://camwatch.ejemplo.com/ws
// Autenticación: el cliente envía el accessToken al conectar

{ "type": "camera.status",   "cameraId": "uuid", "status": "offline", "timestamp": "..." }
{ "type": "camera.status",   "cameraId": "uuid", "status": "online",  "timestamp": "..." }
{ "type": "system.alert",    "severity": "warning", "message": "MediaMTX sin respuesta", "timestamp": "..." }
{ "type": "ping",            "timestamp": "..." }
```

### Suscripción del cliente

```json
// Cliente envía al conectar:
{ "type": "subscribe", "channels": ["cameras", "system"] }
```

---

## Procesamiento de Eventos (MVP: Síncrono)

En el MVP todos los eventos se procesan síncronamente dentro del ciclo de request/response:

```
Request → Controller → Service → [lado: registra en audit_log] → Repository → Response
```

Para operaciones que podrían ser lentas (como comunicarse con MediaMTX), se usa un patrón "fire and forget" con manejo de errores:

```
Request → Controller → Service
  ├─ [inmediato] Persiste en DB
  ├─ [async, no bloquea] Llama a MediaMTX API
  └─ Response (ya enviada con el estado de la DB)
  
[async handler] Si MediaMTX falla:
  → Log de error
  → Actualiza status de cámara a 'error'
```

---

## Sistema de Cola (v1 — Para Implementación Futura)

Cuando el sistema necesite notificaciones, procesamiento de video en background, o alta confiabilidad en la entrega de eventos, se incorporará una cola de mensajes:

```
Stack recomendado: BullMQ (Redis-based)

Colas planificadas:
  camera-sync     → Re-registrar paths en MediaMTX al arranque
  notifications   → Enviar alertas por email/webhook
  recording       → Gestionar segmentos de grabación
  analytics       → Procesar eventos para analítica
```
