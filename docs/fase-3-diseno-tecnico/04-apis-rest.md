# 3.4 — APIs REST

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## Convenciones

| Convención | Valor |
|-----------|-------|
| Base URL | `https://camwatch.ejemplo.com/api/v1` |
| Formato de respuesta | JSON |
| Autenticación | `Authorization: Bearer <accessToken>` |
| Paginación | `?page=1&limit=20` (default limit=20, max=100) |
| Ordenamiento | `?sort=createdAt&order=desc` |
| Fechas | ISO 8601 en UTC |
| Errores | Formato estándar (ver Manejo de Errores) |

---

## AUTH — Autenticación

### POST /auth/login
Autentica un usuario con email y contraseña.

**Request:**
```json
{
  "email": "user@ejemplo.com",
  "password": "contraseña123"
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "María González",
    "email": "user@ejemplo.com",
    "role": "operator"
  }
}
```
+ `Set-Cookie: refreshToken=eyJ...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh; Max-Age=604800`

**Errores:** 400 (validación), 401 (credenciales inválidas), 429 (rate limit)

---

### POST /auth/refresh
Obtiene un nuevo access token usando el refresh token (cookie).

**Request:** Sin body. Requiere cookie `refreshToken`.

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9..."
}
```

**Errores:** 401 (token inválido/expirado/revocado)

---

### POST /auth/logout
Revoca el refresh token actual.

**Request:** Requiere `Authorization` header. Sin body.

**Response:** `204 No Content`
+ `Set-Cookie: refreshToken=; expires=...; HttpOnly` (invalida la cookie)

---

### GET /auth/me
Obtiene el perfil del usuario autenticado.

**Response 200:**
```json
{
  "id": "550e8400-...",
  "name": "María González",
  "email": "user@ejemplo.com",
  "role": "operator",
  "status": "active",
  "lastLoginAt": "2026-06-03T10:00:00Z"
}
```

---

## CAMERAS — Gestión de Cámaras

### GET /cameras
Lista todas las cámaras. Filtrables por location, status, edgeServer.

**Autorización:** ADMIN, OPERATOR, VIEWER

**Query params:** `?locationId=uuid&status=online&edgeServerId=uuid&page=1&limit=20&search=text`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Entrada Principal",
      "slug": "entrada-principal",
      "description": "Cámara de la entrada del edificio",
      "status": "online",
      "codec": "h264",
      "resolution": "1920x1080",
      "location": { "id": "uuid", "name": "Planta Baja" },
      "edgeServer": { "id": "uuid", "name": "Servidor Remoto 1" },
      "lastStatusAt": "2026-06-03T10:00:00Z",
      "createdAt": "2026-05-01T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 8,
    "totalPages": 1
  }
}
```

> **Nota:** `rtspUrlEncrypted` NUNCA se incluye en respuestas.

---

### GET /cameras/:id
Obtiene el detalle de una cámara.

**Autorización:** ADMIN, OPERATOR, VIEWER

**Response 200:** Objeto Camera (sin rtspUrl).

**Errores:** 404 (no encontrada)

---

### POST /cameras
Crea una nueva cámara.

**Autorización:** ADMIN únicamente

**Request:**
```json
{
  "name": "Entrada Principal",
  "slug": "entrada-principal",
  "description": "Cámara de la entrada del edificio",
  "rtspUrl": "rtsp://admin:pass@192.168.1.101:554/stream1",
  "resolution": "1920x1080",
  "codec": "h264",
  "locationId": "uuid-or-null",
  "edgeServerId": "uuid"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "name": "Entrada Principal",
  "slug": "entrada-principal",
  "status": "unknown",
  "createdAt": "2026-06-03T10:00:00Z"
}
```

**Efectos secundarios:** El backend registra el path en MediaMTX y actualiza el status.

**Errores:** 400 (validación), 409 (slug duplicado)

---

### PATCH /cameras/:id
Actualiza una cámara.

**Autorización:** ADMIN únicamente

**Request (campos opcionales):**
```json
{
  "name": "Nueva Entrada",
  "description": "Descripción actualizada",
  "rtspUrl": "rtsp://admin:newpass@192.168.1.101:554/stream1",
  "locationId": "uuid"
}
```

**Response 200:** Objeto Camera actualizado.

**Efectos secundarios:** Si `rtspUrl` cambia, el backend actualiza MediaMTX y reinicia el stream.

---

### DELETE /cameras/:id
Elimina (soft delete) una cámara.

**Autorización:** ADMIN únicamente

**Response:** `204 No Content`

**Efectos secundarios:** Elimina el path en MediaMTX. Las `layout_cells` que referenciaban esta cámara quedan con `camera_id = NULL`.

---

### GET /cameras/:id/stream-token
Obtiene un token temporal para iniciar una conexión WebRTC.

**Autorización:** ADMIN, OPERATOR, VIEWER

**Response 200:**
```json
{
  "streamToken": "eyJ...",
  "whepUrl": "https://camwatch.ejemplo.com:8889/entrada-principal/whep",
  "expiresIn": 30
}
```

**Errores:** 404 (cámara no encontrada), 503 (stream no disponible en MediaMTX)

---

## LAYOUTS — Gestión de Layouts

### GET /layouts
Lista layouts del usuario autenticado + layouts compartidos.

**Autorización:** ADMIN, OPERATOR, VIEWER

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Monitor Principal",
      "gridType": "quad",
      "isDefault": true,
      "isShared": false,
      "owner": { "id": "uuid", "name": "María González" },
      "cells": [
        { "position": 0, "cameraId": "uuid", "cameraName": "Entrada Principal", "label": null },
        { "position": 1, "cameraId": "uuid", "cameraName": "Estacionamiento", "label": null },
        { "position": 2, "cameraId": null, "cameraName": null, "label": null },
        { "position": 3, "cameraId": null, "cameraName": null, "label": null }
      ],
      "updatedAt": "2026-06-01T10:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

---

### POST /layouts
Crea un nuevo layout.

**Autorización:** ADMIN, OPERATOR

**Request:**
```json
{
  "name": "Monitor Principal",
  "gridType": "quad",
  "isDefault": false,
  "isShared": false,
  "cells": [
    { "position": 0, "cameraId": "uuid", "label": null },
    { "position": 1, "cameraId": "uuid", "label": "Zoom" },
    { "position": 2, "cameraId": null, "label": null },
    { "position": 3, "cameraId": null, "label": null }
  ]
}
```

**Response 201:** Objeto Layout creado con cells.

---

### PATCH /layouts/:id
Actualiza un layout (nombre, celdas, configuración).

**Autorización:** Owner del layout o ADMIN

**Response 200:** Layout actualizado.

---

### DELETE /layouts/:id
Elimina un layout (soft delete).

**Autorización:** Owner del layout o ADMIN

**Response:** `204 No Content`

---

## LOCATIONS — Gestión de Ubicaciones

### GET /locations
Lista todas las ubicaciones.

**Autorización:** ADMIN, OPERATOR, VIEWER

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Planta Baja",
      "description": "Área de recepción y estacionamiento",
      "edgeServer": { "id": "uuid", "name": "Servidor Remoto 1" },
      "cameraCount": 4,
      "createdAt": "2026-05-01T00:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

### POST /locations | PATCH /locations/:id | DELETE /locations/:id
CRUD estándar.

**Autorización:** ADMIN únicamente

---

## USERS — Gestión de Usuarios

### GET /users
Lista todos los usuarios.

**Autorización:** ADMIN únicamente

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "María González",
      "email": "maria@ejemplo.com",
      "role": "operator",
      "status": "active",
      "lastLoginAt": "2026-06-03T09:00:00Z",
      "createdAt": "2026-05-01T00:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

---

### POST /users
Crea un nuevo usuario.

**Autorización:** ADMIN únicamente

**Request:**
```json
{
  "name": "Carlos Nuevo",
  "email": "carlos@ejemplo.com",
  "password": "TempPass123!",
  "role": "viewer"
}
```

**Response 201:** Usuario creado (sin passwordHash).

---

### PATCH /users/:id
Actualiza un usuario (nombre, rol, status, contraseña).

**Autorización:** ADMIN. El propio usuario puede actualizar su nombre y contraseña.

---

### DELETE /users/:id
Elimina (soft delete) un usuario.

**Autorización:** ADMIN únicamente

**Validación:** No puede eliminarse el último Admin.

**Response:** `204 No Content`

---

## EDGE SERVERS — Gestión de Servidores Edge

### GET /edge-servers
Lista servidores edge configurados con su estado.

**Autorización:** ADMIN

### POST /edge-servers | PATCH /edge-servers/:id | DELETE /edge-servers/:id
CRUD de servidores edge.

**Autorización:** ADMIN únicamente

---

## SYSTEM — Estado del Sistema

### GET /health
Health check sin autenticación (para load balancers y monitoreo).

**Response 200:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-03T10:00:00Z",
  "version": "1.0.0",
  "services": {
    "database": "ok",
    "redis": "ok",
    "mediamtx": "ok"
  }
}
```

### GET /system/stats
Estadísticas del sistema.

**Autorización:** ADMIN

**Response 200:**
```json
{
  "cameras": { "total": 8, "online": 7, "offline": 1 },
  "users": { "total": 5, "active": 5 },
  "activeSessions": 3,
  "mediamtx": {
    "connected": true,
    "activeStreams": 7,
    "webrtcSessions": 3
  }
}
```
