# 2.2 — Diagramas de Componentes

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## Componentes del Backend (API Server)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Backend API (Fastify / Node.js)                  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    HTTP Layer                                    │ │
│  │  ┌──────────────┐  ┌───────────────┐  ┌────────────────────┐   │ │
│  │  │  Auth Routes │  │  Camera Routes│  │  Layout Routes     │   │ │
│  │  │  /auth/*     │  │  /cameras/*   │  │  /layouts/*        │   │ │
│  │  └──────┬───────┘  └───────┬───────┘  └─────────┬──────────┘   │ │
│  │         │                  │                     │               │ │
│  │  ┌──────▼───────┐  ┌───────▼──────────────────────────────────┐ │ │
│  │  │  User Routes │  │  Location Routes  │  Stream Routes        │ │ │
│  │  │  /users/*    │  │  /locations/*     │  /streams/*           │ │ │
│  │  └──────┬───────┘  └───────┬───────────┬──────────────────────┘ │ │
│  └─────────╪──────────────────╪───────────╪────────────────────────┘ │
│            │                  │           │                           │
│  ┌─────────▼──────────────────▼───────────▼────────────────────────┐ │
│  │                    Middleware Stack                              │ │
│  │  ┌─────────────┐  ┌───────────┐  ┌──────────┐  ┌────────────┐  │ │
│  │  │  JWT Auth   │  │  RBAC     │  │  Rate    │  │  Request   │  │ │
│  │  │  Middleware │  │  Middleware│  │  Limiter │  │  Logger    │  │ │
│  │  └─────────────┘  └───────────┘  └──────────┘  └────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    Service Layer                               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │  │
│  │  │ AuthService  │  │CameraService │  │  StreamService       │ │  │
│  │  │  • login()   │  │  • create()  │  │  • getStreamToken()  │ │  │
│  │  │  • refresh() │  │  • update()  │  │  • verifyStream()    │ │  │
│  │  │  • logout()  │  │  • delete()  │  │  • getStreamStatus() │ │  │
│  │  └──────────────┘  │  • list()    │  └──────────────────────┘ │  │
│  │                     └──────────────┘                           │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │  │
│  │  │ UserService  │  │LayoutService │  │  LocationService     │ │  │
│  │  │  • create()  │  │  • create()  │  │  • create()          │ │  │
│  │  │  • update()  │  │  • update()  │  │  • assignCameras()   │ │  │
│  │  │  • delete()  │  │  • delete()  │  └──────────────────────┘ │  │
│  │  │  • list()    │  │  • list()    │                            │  │
│  │  └──────────────┘  └──────────────┘                           │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                  Infrastructure / Adapters                     │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │  │
│  │  │  PostgreSQL  │  │    Redis     │  │  MediaMTX Client     │ │  │
│  │  │  Repository  │  │  Adapter     │  │  (HTTP client sobre  │ │  │
│  │  │  (pg / knex) │  │  (ioredis)   │  │  Tailscale)          │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Componentes del Frontend (Next.js)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js App Router)                    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    Pages / Routes                                │ │
│  │  /login          /dashboard        /cameras      /layouts       │ │
│  │  /users          /locations        /settings                    │ │
│  └───────────────────────────────┬─────────────────────────────────┘ │
│                                   │                                   │
│  ┌────────────────────────────────▼────────────────────────────────┐ │
│  │                    Page Components                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │ │
│  │  │  LoginPage   │  │ DashboardPage│  │  CamerasPage       │   │ │
│  │  │  (Server)    │  │  (Client)    │  │  (Client)          │   │ │
│  │  └──────────────┘  └──────────────┘  └────────────────────┘   │ │
│  └────────────────────────────────┬────────────────────────────────┘ │
│                                   │                                   │
│  ┌────────────────────────────────▼────────────────────────────────┐ │
│  │                    Feature Components                           │ │
│  │  ┌──────────────────────┐  ┌──────────────────────────────────┐ │ │
│  │  │  MonitoringGrid      │  │  CameraManager                  │ │ │
│  │  │  • CameraCell        │  │  • CameraForm                   │ │ │
│  │  │  • LayoutSelector    │  │  • CameraList                   │ │ │
│  │  │  • FullscreenViewer  │  │  • CameraStatusBadge            │ │ │
│  │  └──────────────────────┘  └──────────────────────────────────┘ │ │
│  │  ┌──────────────────────┐  ┌──────────────────────────────────┐ │ │
│  │  │  LayoutBuilder       │  │  UserManager                    │ │ │
│  │  │  • GridEditor        │  │  • UserForm                     │ │ │
│  │  │  • CameraDraggable   │  │  • UserList                     │ │ │
│  │  │  • LayoutSaver       │  │  • RoleBadge                    │ │ │
│  │  └──────────────────────┘  └──────────────────────────────────┘ │ │
│  └────────────────────────────────┬────────────────────────────────┘ │
│                                   │                                   │
│  ┌────────────────────────────────▼────────────────────────────────┐ │
│  │                    Core / Shared Components                     │ │
│  │  ┌──────────────────┐  ┌───────────┐  ┌────────────────────┐  │ │
│  │  │  WebRTCPlayer    │  │  AuthGuard│  │  Notifications     │  │ │
│  │  │  (RTCPeerConn.)  │  │  (RBAC)   │  │  (Toast)           │  │ │
│  │  └──────────────────┘  └───────────┘  └────────────────────┘  │ │
│  └────────────────────────────────┬────────────────────────────────┘ │
│                                   │                                   │
│  ┌────────────────────────────────▼────────────────────────────────┐ │
│  │                    State & Data Layer                           │ │
│  │  ┌────────────────────┐  ┌─────────────────────────────────┐   │ │
│  │  │  Zustand Store     │  │  TanStack Query (API calls)     │   │ │
│  │  │  • authStore       │  │  • useCameras()                 │   │ │
│  │  │  • layoutStore     │  │  • useLayouts()                 │   │ │
│  │  │  • uiStore         │  │  • useUsers()                   │   │ │
│  │  └────────────────────┘  └─────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Componente WebRTCPlayer (Detalle)

```
┌─────────────────────────────────────────────────────────┐
│                   WebRTCPlayer Component                 │
│                                                          │
│  Props: { cameraId, token, mediamtxUrl }                 │
│                                                          │
│  Lifecycle:                                              │
│  1. Mount → requestStreamToken(cameraId) → Backend       │
│  2. Token recibido → WHEPClient.connect(mediamtxUrl)     │
│  3. RTCPeerConnection.createOffer()                      │
│  4. Enviar SDP offer → MediaMTX /whep endpoint           │
│  5. Recibir SDP answer → setRemoteDescription()          │
│  6. ICE candidates exchange                              │
│  7. Track recibido → video.srcObject = stream            │
│  8. Unmount → WHEPClient.disconnect()                    │
│                                                          │
│  Estados:                                                │
│  • connecting  → Spinner overlay                        │
│  • connected   → Video player activo                    │
│  • error       → Mensaje de error + retry button        │
│  • no-signal   → Icono de cámara desconectada           │
│                                                          │
│  Reconexión automática:                                  │
│  • ontrack lost → backoff (5s, 10s, 30s, 60s)           │
│  • Max retries: 5 antes de mostrar "Sin señal"           │
└─────────────────────────────────────────────────────────┘
```

---

## Componente MediaMTX Client (Backend Adapter)

```
┌─────────────────────────────────────────────────────────┐
│               MediaMTX Client (Backend)                  │
│                                                          │
│  Configuración:                                          │
│  • baseUrl: http://100.x.x.x:9997  (via Tailscale)      │
│  • authToken: (variable de entorno)                      │
│                                                          │
│  Métodos:                                                │
│  • getStreamList() → GET /v3/rtspconns                   │
│  • getStreamStatus(id) → GET /v3/paths/{name}            │
│  • addStream(config) → POST /v3/config/paths/add/{name}  │
│  • removeStream(id) → DELETE /v3/config/paths/{name}     │
│  • generateStreamToken(id) → lógica JWT interna          │
│                                                          │
│  Error Handling:                                         │
│  • Timeout: 5 segundos                                   │
│  • Retry: 3 intentos con backoff exponencial             │
│  • Circuit breaker si MediaMTX no responde en 3 calls    │
└─────────────────────────────────────────────────────────┘
```

---

## Mapa de Dependencias entre Componentes

```
Frontend                    Backend                     Infraestructura
──────────                  ───────                     ───────────────
LoginPage                →  POST /auth/login          →  PostgreSQL (users)
                                                      →  Redis (tokens)

DashboardPage             →  GET /cameras             →  PostgreSQL (cameras)
  WebRTCPlayer            →  GET /cameras/:id/stream  →  MediaMTX (Tailscale)
  LayoutSelector          →  GET /layouts             →  PostgreSQL (layouts)

CamerasPage (Admin)       →  CRUD /cameras            →  PostgreSQL + MediaMTX
LayoutBuilder             →  CRUD /layouts            →  PostgreSQL
UsersPage (Admin)         →  CRUD /users              →  PostgreSQL
LocationsPage (Admin)     →  CRUD /locations          →  PostgreSQL
```
