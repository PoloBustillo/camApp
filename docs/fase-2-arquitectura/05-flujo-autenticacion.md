# 2.5 — Flujo de Autenticación

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## Estrategia de Autenticación

El sistema usa **JWT (JSON Web Tokens)** con el patrón de **Access Token + Refresh Token**:

| Token | Duración | Almacenamiento Cliente | Uso |
|-------|----------|----------------------|-----|
| Access Token (JWT) | 15 minutos | Memoria (no localStorage) | Autenticar cada request a la API |
| Refresh Token | 7 días | Cookie HttpOnly segura | Obtener nuevo Access Token |
| Stream Token (JWT) | 30 segundos | Memoria temporal | Autorizar conexión WebRTC a MediaMTX |

---

## Flujo 1: Login Inicial

```
Browser                        Backend API                     PostgreSQL / Redis
──────────                     ───────────                     ─────────────────

1. POST /auth/login
   { email, password }
   ──────────────────────────►
                               2. Busca usuario por email
                                  ──────────────────────────────►
                                                                 3. Retorna usuario
                                  ◄──────────────────────────────
                               │
                               4. bcrypt.compare(password, hash)
                               │  [Si falla: incrementa contador
                               │   de intentos fallidos en Redis]
                               │
                               5. Genera Access Token (JWT):
                                  {
                                    sub: userId,
                                    role: "operator",
                                    exp: now + 15min
                                  }
                                  firmado con JWT_SECRET (HS256)
                               │
                               6. Genera Refresh Token (JWT):
                                  {
                                    sub: userId,
                                    jti: uuid(),    ← ID único del token
                                    exp: now + 7d
                                  }
                                  firmado con REFRESH_JWT_SECRET (HS256)
                               │
                               7. Persiste refresh token jti en Redis
                                  SET refresh:userId:jti "active" EX 604800
                                  ──────────────────────────────►
                               │
   8. Respuesta:
   ◄──────────────────────────
   {
     accessToken: "eyJ...",          ← en body
     user: { id, name, role }
   }
   Set-Cookie: refreshToken=eyJ...
     HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=604800
   │
   9. Cliente almacena accessToken en memoria (variable JS, NO localStorage)
```

---

## Flujo 2: Request Autenticado a la API

```
Browser                        Backend API (Middleware)
──────────                     ────────────────────────

1. GET /api/cameras
   Authorization: Bearer <accessToken>
   ──────────────────────────────────►
                               2. JWT Middleware:
                                  • Extrae Bearer token
                                  • jwt.verify(token, JWT_SECRET)
                                  • [Si exp → 401 TokenExpired]
                                  • [Si firma inválida → 401 Unauthorized]
                                  │
                               3. RBAC Middleware:
                                  • req.user.role === required_role?
                                  • [Si no → 403 Forbidden]
                                  │
                               4. Procesa la request
                                  Retorna datos
   ◄──────────────────────────────────
   200 OK + datos
```

---

## Flujo 3: Renovación de Access Token (Refresh)

```
Browser                        Backend API                     Redis
──────────                     ───────────                     ─────

[Access Token expirado → 401 TokenExpired]
│
1. POST /auth/refresh
   Cookie: refreshToken=eyJ...   ← automático por HttpOnly cookie
   ──────────────────────────►
                               2. Extrae refresh token de cookie
                               3. jwt.verify(refreshToken, REFRESH_JWT_SECRET)
                               4. Extrae jti (ID del token)
                               │
                               5. Verifica en Redis que el jti está activo
                                  GET refresh:userId:jti
                                  ──────────────────────────────►
                                                                 6. Retorna "active"
                                  ◄──────────────────────────────
                               │
                               7. Genera nuevo Access Token
                               │
   8. Respuesta:
   ◄──────────────────────────
   { accessToken: "eyJ...(nuevo)" }
   │
   9. Cliente actualiza accessToken en memoria
   10. Reintenta el request original con el nuevo token
```

---

## Flujo 4: Logout

```
Browser                        Backend API                     Redis
──────────                     ───────────                     ─────

1. POST /auth/logout
   Authorization: Bearer <accessToken>
   Cookie: refreshToken=eyJ...
   ──────────────────────────►
                               2. Extrae jti del refresh token
                               3. Elimina de Redis:
                                  DEL refresh:userId:jti
                                  ──────────────────────────────►
                               │
                               4. [Opcional] Agrega jti a blacklist
                                  hasta su expiración natural
                               │
   5. Respuesta: 204 No Content
   ◄──────────────────────────
   Set-Cookie: refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT
   │
   6. Cliente elimina accessToken de memoria
   7. Redirige a /login
```

---

## Flujo 5: Obtención de Stream Token para WebRTC

```
Browser                        Backend API              MediaMTX
──────────                     ───────────              ─────────

[Usuario abre cámara en dashboard]
│
1. GET /api/cameras/:id/stream-token
   Authorization: Bearer <accessToken>
   ──────────────────────────────────►
                               2. Verifica JWT (acceso a esta cámara)
                               3. Verifica rol (Admin/Operator/Viewer)
                               4. Consulta MediaMTX si el stream está activo
                                  GET http://100.x.x.x:9997/v3/paths/{name}
                                  ─────────────────────────────────────────►
                                                                  5. 200 OK / stream activo
                                  ◄─────────────────────────────────────────
                               │
                               6. Genera Stream Token (JWT temporal):
                                  {
                                    sub: cameraId,
                                    path: "camera1",
                                    action: "read",
                                    exp: now + 30s   ← muy corto
                                  }
                                  firmado con MEDIAMTX_JWT_SECRET
                               │
   7. Respuesta:
   ◄──────────────────────────────────
   {
     streamToken: "eyJ...",
     whepUrl: "https://camwatch.ejemplo.com:8889/camera1/whep",
     expiresIn: 30
   }
   │
8. Browser inicia WHEP handshake con streamToken
   POST https://camwatch.ejemplo.com:8889/camera1/whep
   Authorization: Bearer <streamToken>
   Body: SDP Offer
   ─────────────────────────────────────────────────────►
                                                         9. MediaMTX valida JWT
                                                            con MEDIAMTX_JWT_SECRET
                                                            Genera SDP Answer
   ◄─────────────────────────────────────────────────────
10. Conexión WebRTC establecida
```

---

## Modelo de Control de Acceso (RBAC)

```
Role: ADMIN
  └─ Permisos:
     • cameras:create, cameras:read, cameras:update, cameras:delete
     • users:create, users:read, users:update, users:delete
     • layouts:create, layouts:read, layouts:update, layouts:delete
     • locations:create, locations:read, locations:update, locations:delete
     • streams:read (todas las cámaras)
     • system:config

Role: OPERATOR
  └─ Permisos:
     • cameras:read
     • layouts:create, layouts:read, layouts:update, layouts:delete (solo propios)
     • locations:read
     • streams:read (cámaras asignadas a su grupo)

Role: VIEWER
  └─ Permisos:
     • cameras:read (solo metadatos, no credenciales)
     • layouts:read (solo layouts compartidos)
     • locations:read
     • streams:read (cámaras accesibles)
```

---

## Protección contra Ataques

| Amenaza | Contramedida |
|---------|-------------|
| Brute force en login | Rate limiting por IP (max 5 intentos/15min) con Redis |
| Token robado (Access) | Corta duración (15 min) minimiza ventana de ataque |
| Token robado (Refresh) | HttpOnly Cookie (inaccesible desde JS), revocación en Redis |
| CSRF | SameSite=Strict en la cookie de refresh token |
| Replay attack en stream | Stream Token dura 30 segundos; inútil después |
| XSS | Access Token en memoria (no localStorage ni sessionStorage) |
| Inyección SQL | Uso de ORM/query builder con parámetros preparados |
