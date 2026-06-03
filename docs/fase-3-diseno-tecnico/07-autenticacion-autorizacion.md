# 3.7 — Autenticación y Autorización

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## Estrategia General

| Aspecto | Decisión |
|---------|----------|
| Mecanismo | JWT (JSON Web Tokens) — stateless para el access token |
| Access Token duración | 15 minutos |
| Refresh Token duración | 7 días |
| Algoritmo JWT | HS256 (HMAC-SHA256) |
| Almacenamiento Access Token | Memoria del cliente (variable JS) — NO localStorage |
| Almacenamiento Refresh Token | Cookie HttpOnly; Secure; SameSite=Strict |
| Revocación | JTI del refresh token en Redis (blacklist/allowlist) |
| Hashing de contraseñas | bcrypt con cost factor 12 |

---

## Estructura del JWT (Access Token)

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "550e8400-e29b-41d4-a716-446655440000",  // userId
    "role": "operator",
    "iat": 1717408800,     // issued at (unix timestamp)
    "exp": 1717409700,     // expires at (iat + 900 seconds = 15min)
    "iss": "camwatch-api"  // issuer
  },
  "signature": "HMACSHA256(base64(header) + '.' + base64(payload), JWT_SECRET)"
}
```

## Estructura del JWT (Refresh Token)

```json
{
  "payload": {
    "sub": "550e8400-...",  // userId
    "jti": "unique-token-id",  // JWT ID para revocación individual
    "iat": 1717408800,
    "exp": 1718013600,     // iat + 604800 seconds = 7 days
    "iss": "camwatch-api"
  }
}
```

## Estructura del JWT (Stream Token)

```json
{
  "payload": {
    "sub": "camera-uuid",
    "path": "entrada-principal",  // nombre del path en MediaMTX
    "action": "read",
    "iat": 1717408800,
    "exp": 1717408830,     // iat + 30 seconds
    "iss": "camwatch-api"
  }
}
```

---

## Matriz de Autorización RBAC

### Endpoints de API

| Endpoint | ADMIN | OPERATOR | VIEWER |
|----------|:-----:|:--------:|:------:|
| POST /auth/login | ✅ | ✅ | ✅ |
| POST /auth/refresh | ✅ | ✅ | ✅ |
| POST /auth/logout | ✅ | ✅ | ✅ |
| GET /auth/me | ✅ | ✅ | ✅ |
| GET /cameras | ✅ | ✅ | ✅ |
| GET /cameras/:id | ✅ | ✅ | ✅ |
| POST /cameras | ✅ | ❌ | ❌ |
| PATCH /cameras/:id | ✅ | ❌ | ❌ |
| DELETE /cameras/:id | ✅ | ❌ | ❌ |
| GET /cameras/:id/stream-token | ✅ | ✅ | ✅ |
| GET /layouts | ✅ | ✅ (propios+shared) | ✅ (shared) |
| POST /layouts | ✅ | ✅ | ❌ |
| PATCH /layouts/:id | ✅ (cualquiera) | ✅ (solo propios) | ❌ |
| DELETE /layouts/:id | ✅ (cualquiera) | ✅ (solo propios) | ❌ |
| GET /locations | ✅ | ✅ | ✅ |
| POST/PATCH/DELETE /locations | ✅ | ❌ | ❌ |
| GET /users | ✅ | ❌ | ❌ |
| POST /users | ✅ | ❌ | ❌ |
| PATCH /users/:id | ✅ (cualquiera) | ✅ (solo propio: nombre+pass) | ✅ (solo propio: nombre+pass) |
| DELETE /users/:id | ✅ | ❌ | ❌ |
| GET /edge-servers | ✅ | ❌ | ❌ |
| POST/PATCH/DELETE /edge-servers | ✅ | ❌ | ❌ |
| GET /system/stats | ✅ | ❌ | ❌ |
| GET /health | ✅ | ✅ | ✅ (sin auth) |

---

## Implementación del Middleware de Autenticación

```
Request llega con: Authorization: Bearer <accessToken>
                                              │
                           ┌──────────────────▼─────────────────────┐
                           │        JWT Auth Middleware               │
                           │                                         │
                           │  1. ¿Existe header Authorization?       │
                           │     No → 401 { code: "MISSING_TOKEN" }  │
                           │                                         │
                           │  2. ¿Es "Bearer <token>"?               │
                           │     No → 401 { code: "INVALID_TOKEN" }  │
                           │                                         │
                           │  3. jwt.verify(token, JWT_SECRET)        │
                           │     Firma inválida → 401 INVALID_TOKEN   │
                           │     Expirado → 401 TOKEN_EXPIRED         │
                           │     Issuer incorrecto → 401              │
                           │                                         │
                           │  4. ¿Usuario existe y está activo?       │
                           │     (opcional: cache en Redis, 60s TTL)  │
                           │     No → 401 USER_INACTIVE               │
                           │                                         │
                           │  5. req.user = { id, role } ✅           │
                           └─────────────────────────────────────────┘
                                              │
                           ┌──────────────────▼─────────────────────┐
                           │        RBAC Middleware                   │
                           │                                         │
                           │  requireRole('admin', 'operator') →     │
                           │    req.user.role in allowed_roles?       │
                           │    No → 403 { code: "FORBIDDEN" }        │
                           │    Sí → next()                          │
                           └─────────────────────────────────────────┘
                                              │
                                         Controller
```

---

## Política de Contraseñas

| Regla | Valor |
|-------|-------|
| Longitud mínima | 8 caracteres |
| Longitud máxima | 128 caracteres |
| Complejidad | Al menos 1 mayúscula + 1 minúscula + 1 dígito |
| Caracteres especiales | No requeridos (pero permitidos) |
| Historial | No verificado en MVP |
| Expiración | No en MVP |
| Bcrypt cost | 12 |

**Estimación de tiempo de bcrypt con cost=12:** ~300ms por operación (aceptable para login/cambio de contraseña; no afecta el rendimiento general).

---

## Manejo de Sesiones Concurrentes

En el MVP, un usuario puede tener múltiples sesiones activas (desde distintos dispositivos). Cada sesión tiene su propio refresh token con JTI único.

Operaciones disponibles:
- `DELETE /auth/logout` — Revoca solo el refresh token de la sesión actual.
- `DELETE /auth/logout/all` (v1) — Revoca todos los refresh tokens del usuario.

---

## Rotación de Secretos JWT

Proceso de rotación sin downtime:

1. Agregar nuevo secreto como `JWT_SECRET_NEW` manteniendo `JWT_SECRET_OLD`.
2. El middleware verifica primero con `JWT_SECRET_NEW`, luego con `JWT_SECRET_OLD`.
3. Los nuevos tokens se firman con `JWT_SECRET_NEW`.
4. Después de 15 minutos (vida máxima de un access token), todos los tokens activos usan el nuevo secreto.
5. Remover `JWT_SECRET_OLD`.

Para refresh tokens (vida 7 días): forzar re-login gradualmente o invalidar todos si hay incidente de seguridad.
