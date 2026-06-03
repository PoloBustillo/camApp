# 3.8 — Manejo de Errores

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## Estrategia Global

1. **Error como valor en servicios:** Los servicios lanzan errores tipados (clases de error específicas).
2. **Handler global en Fastify:** Un `errorHandler` global captura todos los errores no manejados.
3. **Formato estandarizado:** Todas las respuestas de error siguen el mismo formato JSON.
4. **Sin información sensible en errores:** Los mensajes de error no exponen stack traces, detalles de infraestructura ni datos internos.
5. **Correlación:** Cada error incluye un `requestId` para correlacionar con logs.

---

## Formato de Respuesta de Error

```json
{
  "error": {
    "code": "CAMERA_NOT_FOUND",
    "message": "La cámara con el ID especificado no existe o fue eliminada.",
    "details": [],          // Solo presente en errores de validación
    "requestId": "req_abc123xyz"
  }
}
```

Para errores de validación:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Los datos de entrada contienen errores.",
    "details": [
      { "field": "email", "message": "Debe ser una dirección de email válida" },
      { "field": "password", "message": "Debe tener al menos 8 caracteres" }
    ],
    "requestId": "req_def456uvw"
  }
}
```

---

## Catálogo de Códigos de Error

### 400 Bad Request

| Código | Descripción |
|--------|-------------|
| `VALIDATION_ERROR` | El body, query params o path params no pasan la validación |
| `INVALID_UUID` | El ID proporcionado no es un UUID válido |
| `INVALID_RTSP_URL` | La URL RTSP no tiene el formato correcto |
| `INVALID_GRID_TYPE` | El tipo de grilla no es uno de los valores permitidos |

### 401 Unauthorized

| Código | Descripción |
|--------|-------------|
| `MISSING_TOKEN` | No se proporcionó el header Authorization |
| `INVALID_TOKEN` | El JWT no puede ser verificado (firma inválida) |
| `TOKEN_EXPIRED` | El access token ha expirado |
| `REFRESH_TOKEN_INVALID` | El refresh token no existe, está revocado o expiró |
| `INVALID_CREDENTIALS` | Email o contraseña incorrectos |
| `ACCOUNT_LOCKED` | La cuenta está bloqueada por intentos fallidos |
| `ACCOUNT_INACTIVE` | La cuenta está desactivada por un administrador |

### 403 Forbidden

| Código | Descripción |
|--------|-------------|
| `FORBIDDEN` | El usuario no tiene permisos para esta operación |
| `SELF_ROLE_CHANGE` | Un usuario no puede cambiar su propio rol |
| `LAST_ADMIN_DELETE` | No se puede eliminar el último administrador del sistema |
| `LAYOUT_NOT_OWNED` | El operador no puede modificar layouts ajenos |

### 404 Not Found

| Código | Descripción |
|--------|-------------|
| `CAMERA_NOT_FOUND` | La cámara no existe o fue eliminada |
| `LAYOUT_NOT_FOUND` | El layout no existe o fue eliminado |
| `LOCATION_NOT_FOUND` | La ubicación no existe |
| `USER_NOT_FOUND` | El usuario no existe o fue eliminado |
| `EDGE_SERVER_NOT_FOUND` | El servidor edge no existe |

### 409 Conflict

| Código | Descripción |
|--------|-------------|
| `EMAIL_ALREADY_EXISTS` | Ya existe un usuario con ese email |
| `SLUG_ALREADY_EXISTS` | Ya existe una cámara con ese slug |

### 422 Unprocessable Entity

| Código | Descripción |
|--------|-------------|
| `CAMERA_STREAM_UNAVAILABLE` | La cámara existe pero su stream no está disponible en MediaMTX |
| `LAYOUT_CELL_OVERFLOW` | El número de celdas excede las permitidas por el grid_type |

### 429 Too Many Requests

| Código | Descripción |
|--------|-------------|
| `RATE_LIMIT_EXCEEDED` | Demasiados intentos de login. Incluye `retryAfter` en segundos |

### 500 Internal Server Error

| Código | Descripción |
|--------|-------------|
| `INTERNAL_ERROR` | Error inesperado del servidor (no expone detalles al cliente) |
| `DATABASE_ERROR` | Error de base de datos (no expone detalles al cliente) |

### 502 Bad Gateway

| Código | Descripción |
|--------|-------------|
| `MEDIAMTX_UNAVAILABLE` | No se puede conectar al servidor MediaMTX |

### 503 Service Unavailable

| Código | Descripción |
|--------|-------------|
| `SERVICE_UNAVAILABLE` | El servicio no está disponible temporalmente |

---

## Jerarquía de Clases de Error (Backend)

```
AppError (base)
  ├── ValidationError (400)
  ├── AuthError (401)
  │     ├── MissingTokenError
  │     ├── InvalidTokenError
  │     ├── TokenExpiredError
  │     ├── InvalidCredentialsError
  │     └── AccountLockedError
  ├── ForbiddenError (403)
  ├── NotFoundError (404)
  │     ├── CameraNotFoundError
  │     ├── LayoutNotFoundError
  │     ├── UserNotFoundError
  │     └── LocationNotFoundError
  ├── ConflictError (409)
  ├── UnprocessableEntityError (422)
  ├── RateLimitError (429)
  └── ExternalServiceError (502)
        └── MediaMtxUnavailableError
```

---

## Errores de Infraestructura (No expuestos al cliente)

Los siguientes errores se registran en logs pero el cliente recibe un mensaje genérico:

| Error real | Log | Respuesta al cliente |
|-----------|-----|---------------------|
| `pg connection refused` | `[ERROR] Database connection failed` | 500 INTERNAL_ERROR |
| `redis ECONNREFUSED` | `[ERROR] Redis connection failed` | 500 INTERNAL_ERROR |
| `MediaMTX timeout` | `[ERROR] MediaMTX timeout after 5000ms` | 502 MEDIAMTX_UNAVAILABLE |
| `JSON parse error` | `[WARN] Invalid JSON in request body` | 400 VALIDATION_ERROR |

---

## Comportamiento del Frontend ante Errores

| Error recibido | Acción del frontend |
|---------------|---------------------|
| 401 TOKEN_EXPIRED | Intentar refresh automático → si falla, redirigir a login |
| 401 INVALID_CREDENTIALS | Mostrar "Email o contraseña incorrectos" |
| 401 ACCOUNT_LOCKED | Mostrar "Cuenta bloqueada. Intente en X minutos." |
| 403 FORBIDDEN | Mostrar "No tienes permisos para esta acción" |
| 404 xxx_NOT_FOUND | Mostrar mensaje específico o redirigir a lista |
| 409 SLUG_ALREADY_EXISTS | Destacar campo slug en formulario con mensaje |
| 422 CAMERA_STREAM_UNAVAILABLE | Mostrar "Sin señal" en el player de video |
| 429 RATE_LIMIT_EXCEEDED | Mostrar "Demasiados intentos. Espere X segundos." |
| 500 INTERNAL_ERROR | Mostrar "Error del servidor. Intente más tarde." |
| 502 MEDIAMTX_UNAVAILABLE | Mostrar advertencia de servidor de video no disponible |
| Network Error | Mostrar "Sin conexión. Verifique su red." |
