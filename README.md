# Plataforma de Monitoreo de Cámaras IP — Documentación Técnica Completa

> **Rol:** Arquitecto de Software Senior / Product Owner / Tech Lead  
> **Fecha:** Junio 2026  
> **Estado:** Sprint 3 — Auth + Sites + Cameras + MediaMTX + Dashboard + Layouts implementados ✅

---

## Descripción del Proyecto

Plataforma web para monitoreo en tiempo real de cámaras IP ubicadas en una instalación remota, utilizando **MediaMTX** como servidor de medios, **Tailscale** para conectividad segura, y **Next.js 15** como solución full-stack (frontend + API Routes) con **Prisma ORM** y **PostgreSQL**.

---

## Inicio Rápido

### Requisitos
- Bun 1.x
- Docker + Docker Compose v2

### Setup local

```bash
# 1. Clonar el repo
git clone <repo-url>
cd camera-platform

# 2. Instalar dependencias
bun install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus valores (especialmente ENCRYPTION_KEY y AUTH_SECRET)

# 4. Levantar base de datos y Redis
docker compose up postgres redis -d

# 5. Ejecutar migraciones y seed
bun run db:migrate
bun run db:seed

# 6. Iniciar en desarrollo
bun run dev
```

La aplicación estará disponible en `http://localhost:3000`.

**Credenciales de desarrollo por defecto:**
- Email: `admin@camwatch.local`
- Password: `Admin123!`

### Comandos útiles

```bash
bun run dev            # Inicia Next.js con Turbopack
bun run build          # Build de producción
bun run typecheck      # Verificación de tipos TypeScript
bun run lint           # ESLint

bun run db:migrate     # Aplica migraciones pendientes
bun run db:seed        # Carga datos iniciales (admin + EdgeServer + Site)
bun run db:studio      # Abre Prisma Studio (http://localhost:5555)
bun run db:reset       # Resetea la BD (CUIDADO: borra todo)

bun run test           # Ejecuta todos los tests (Vitest)
bun run storybook      # Inicia Storybook en http://localhost:6006

docker compose up -d   # Levanta todos los servicios (postgres + redis + web)
docker compose logs -f # Ver logs
```

---

## Estructura del Proyecto

```
camera-platform/
├── src/
│   ├── app/
│   │   ├── (auth)/login/       # Página de login
│   │   ├── (dashboard)/        # Páginas protegidas
│   │   └── api/                # API Routes (Route Handlers)
│   │       ├── auth/           # login, logout, refresh
│   │       ├── cameras/        # CRUD + stream token
│   │       ├── users/          # Gestión de usuarios (admin)
│   │       ├── layouts/        # Layouts de monitoreo
│   │       └── edge-servers/   # Servidores MediaMTX
│   ├── components/             # Componentes React
│   ├── lib/                    # Utilidades del servidor
│   │   ├── prisma.ts           # Cliente Prisma (singleton)
│   │   ├── auth.ts             # JWT sign/verify
│   │   ├── crypto.ts           # Cifrado AES-256-GCM
│   │   ├── middleware.ts       # requireAuth / requireRole
│   │   └── errors.ts           # Respuestas de error estandarizadas
│   ├── stores/                 # Estado global Zustand
│   ├── hooks/                  # Custom hooks React
│   └── types/                  # Tipos TypeScript compartidos
├── prisma/
│   ├── schema.prisma           # Modelo de datos
│   └── seed.ts                 # Datos iniciales
├── docker/
│   └── nginx/nginx.dev.conf    # Configuración Nginx dev
├── docker-compose.yml          # Servicios de desarrollo
├── Dockerfile                  # Multi-stage build
└── .env.example                # Variables de entorno de ejemplo
```

---

## API Endpoints

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| POST | `/api/auth/login` | Autenticación | Público |
| POST | `/api/auth/logout` | Cierre de sesión | Autenticado |
| POST | `/api/auth/refresh` | Renovar access token | Cookie |
| GET | `/api/cameras` | Listar cámaras (filtros: siteId, protocol, enabled, online) | Todos |
| POST | `/api/cameras` | Crear cámara | Admin |
| GET | `/api/cameras/:id` | Ver cámara | Todos |
| PUT | `/api/cameras/:id` | Editar cámara completa | Admin |
| DELETE | `/api/cameras/:id` | Eliminar cámara | Admin |
| POST | `/api/cameras/:id/stream` | Token de stream WebRTC | Todos |
| GET | `/api/layouts` | Listar layouts | Todos |
| POST | `/api/layouts` | Crear layout | Todos |
| PATCH | `/api/layouts/:id` | Editar layout + celdas | Dueño/Admin |
| DELETE | `/api/layouts/:id` | Eliminar layout | Dueño/Admin |
| POST | `/api/layouts/:id/duplicate` | Duplicar layout | Todos |
| GET | `/api/users` | Listar usuarios | Admin |
| POST | `/api/users` | Crear usuario | Admin |
| PATCH | `/api/users/:id` | Editar usuario | Admin |
| DELETE | `/api/users/:id` | Eliminar usuario | Admin |
| GET | `/api/edge-servers` | Listar servidores edge | Todos |
| POST | `/api/edge-servers` | Registrar servidor | Admin |
| GET | `/api/edge-servers/:id/health` | Health check MediaMTX | Todos |
| GET | `/api/edge-servers/:id/streams` | Listar streams activos | Todos |
| POST | `/api/edge-servers/:id/sync` | Sincronizar estado online | Admin, Operator |
| GET | `/api/sites` | Listar sitios | Todos |
| POST | `/api/sites` | Crear sitio | Admin, Operator |
| GET | `/api/sites/:id` | Ver sitio | Todos |
| PATCH | `/api/sites/:id` | Editar sitio | Admin, Operator |
| DELETE | `/api/sites/:id` | Eliminar sitio | Admin |

---

---

## Índice de Documentación

### FASE 1 — Descubrimiento
| # | Documento | Descripción |
|---|-----------|-------------|
| 1.1 | [Visión del Producto](./fase-1-descubrimiento/01-vision-producto.md) | Objetivos, propuesta de valor, criterios de éxito |
| 1.2 | [Casos de Uso](./fase-1-descubrimiento/02-casos-de-uso.md) | Flujos funcionales principales y alternativos |
| 1.3 | [Personas de Usuario](./fase-1-descubrimiento/03-personas-usuario.md) | Arquetipos de usuarios y sus necesidades |
| 1.4 | [Restricciones Técnicas](./fase-1-descubrimiento/04-restricciones-tecnicas.md) | Límites tecnológicos, de infraestructura y de negocio |
| 1.5 | [Riesgos Técnicos](./fase-1-descubrimiento/05-riesgos-tecnicos.md) | Registro de riesgos con probabilidad, impacto y mitigación |
| 1.6 | [Supuestos](./fase-1-descubrimiento/06-supuestos.md) | Supuestos que sustentan las decisiones de diseño |
| 1.7 | [Preguntas Abiertas](./fase-1-descubrimiento/07-preguntas-abiertas.md) | Incógnitas que requieren respuesta antes de implementar |

### FASE 2 — Arquitectura
| # | Documento | Descripción |
|---|-----------|-------------|
| 2.1 | [Arquitectura de Alto Nivel](./fase-2-arquitectura/01-arquitectura-alto-nivel.md) | Visión general del sistema, capas y responsabilidades |
| 2.2 | [Diagramas de Componentes](./fase-2-arquitectura/02-diagramas-componentes.md) | Componentes internos de cada capa |
| 2.3 | [Diagramas de Despliegue](./fase-2-arquitectura/03-diagramas-despliegue.md) | Infraestructura física y virtual |
| 2.4 | [Flujo de Video](./fase-2-arquitectura/04-flujo-video.md) | Pipeline completo de RTSP a WebRTC en browser |
| 2.5 | [Flujo de Autenticación](./fase-2-arquitectura/05-flujo-autenticacion.md) | Flujos JWT, refresh tokens, sesiones |
| 2.6 | [Integración MediaMTX](./fase-2-arquitectura/06-integracion-mediamtx.md) | API, configuración y control de streams |
| 2.7 | [Integración Tailscale](./fase-2-arquitectura/07-integracion-tailscale.md) | Topología de red privada y acceso seguro |
| 2.8 | [Estrategia de Escalabilidad](./fase-2-arquitectura/08-estrategia-escalabilidad.md) | Crecimiento horizontal y vertical planificado |
| 2.9 | [Estrategia de Seguridad](./fase-2-arquitectura/09-estrategia-seguridad.md) | Modelo de amenazas y controles de seguridad |

### FASE 3 — Diseño Técnico
| # | Documento | Descripción |
|---|-----------|-------------|
| 3.1 | [Modelo de Dominio](./fase-3-diseno-tecnico/01-modelo-dominio.md) | Entidades, agregados y relaciones del negocio |
| 3.2 | [Modelo Entidad-Relación](./fase-3-diseno-tecnico/02-modelo-er.md) | ER completo con atributos y cardinalidades |
| 3.3 | [Diseño de Base de Datos](./fase-3-diseno-tecnico/03-diseno-base-datos.md) | Esquemas, índices, particionamiento, migraciones |
| 3.4 | [APIs REST](./fase-3-diseno-tecnico/04-apis-rest.md) | Contratos de API completos con ejemplos |
| 3.5 | [Eventos del Sistema](./fase-3-diseno-tecnico/05-eventos.md) | Eventos de dominio y mensajería asíncrona |
| 3.6 | [DTOs](./fase-3-diseno-tecnico/06-dtos.md) | Objetos de transferencia de datos para cada operación |
| 3.7 | [Autenticación y Autorización](./fase-3-diseno-tecnico/07-autenticacion-autorizacion.md) | RBAC, JWT, políticas de acceso |
| 3.8 | [Manejo de Errores](./fase-3-diseno-tecnico/08-manejo-errores.md) | Estrategia global de errores y códigos |
| 3.9 | [Logging](./fase-3-diseno-tecnico/09-logging.md) | Estructura de logs, niveles y retención |
| 3.10 | [Observabilidad](./fase-3-diseno-tecnico/10-observabilidad.md) | Métricas, trazas distribuidas, alertas |

### FASE 4 — Product Backlog
| # | Documento | Descripción |
|---|-----------|-------------|
| 4.1 | [Backlog Completo](./fase-4-product-backlog/backlog.md) | Épicas, features, user stories con criterios y estimados |

### FASE 5 — Roadmap
| # | Documento | Descripción |
|---|-----------|-------------|
| 5.1 | [Roadmap por Sprints](./fase-5-roadmap/roadmap.md) | Sprint 0 al 4, objetivos, entregables y dependencias |

### FASE 6 — Plan de Implementación
| # | Documento | Descripción |
|---|-----------|-------------|
| 6.1 | [Stack Tecnológico](./fase-6-plan-implementacion/stack-tecnologico.md) | Tecnologías seleccionadas con justificación en cada capa |

---

## Decisiones Arquitectónicas Clave (ADR Summary)

| ID | Decisión | Estado |
|----|----------|--------|
| ADR-001 | WebRTC como protocolo de streaming hacia el browser | Aprobado |
| ADR-002 | MediaMTX como servidor de medios (no Nginx-RTMP, no Wowza) | Aprobado |
| ADR-003 | Tailscale para conectividad segura sin VPN compleja | Aprobado |
| ADR-004 | JWT + Refresh Tokens para autenticación sin estado | Aprobado |
| ADR-005 | PostgreSQL como base de datos principal | Aprobado |
| ADR-006 | Next.js (App Router) para el frontend | Aprobado |
| ADR-007 | Next.js 15 (App Router + API Routes) como solución full-stack — sin backend separado | Aprobado (revisado) |
| ADR-008 | RBAC de 3 niveles: Admin, Operator, Viewer | Aprobado |

---

## Convenciones del Proyecto

- **Idioma de código:** Inglés (variables, funciones, clases)
- **Idioma de documentación:** Español
- **Formato de fechas:** ISO 8601 (`YYYY-MM-DD`)
- **Versionado:** Semantic Versioning (`MAJOR.MINOR.PATCH`)
- **Ramas Git:** `main`, `develop`, `feature/`, `fix/`, `release/`

## Entidades del Dominio

| Entidad | Tabla | Descripción |
|---------|-------|-------------|
| User | `users` | Usuarios con roles RBAC y lockout |
| Site | `sites` | Ubicaciones/instalaciones (timezone, activo) |
| EdgeServer | `edge_servers` | Servidores MediaMTX remotos |
| Location | `locations` | Ubicaciones físicas en un EdgeServer |
| Camera | `cameras` | Cámaras IP con path cifrado AES-256 y protocolo (RTSP/RTMP/WebRTC/HLS) |
| Layout | `layouts` | Grillas de monitoreo multi-cámara |
| LayoutCell | `layout_cells` | Celdas individuales de un Layout |
| RefreshToken | `refresh_tokens` | Tokens de renovación de sesión |
| StreamEvent | `stream_events` | Eventos de estado de streams |
| AuditLog | `audit_logs` | Registro de acciones del sistema |

---

## Autenticación

La plataforma usa **Auth.js v5** (next-auth@beta) con proveedor Credentials y sesiones JWT almacenadas en cookies HttpOnly.

### Flujo de login

1. El usuario accede a `/login` y completa el formulario (`LoginForm`)
2. Se invoca la Server Action `loginAction` → `signIn("credentials")`
3. Auth.js llama a `authorizeCredentials()` en `src/lib/authorize.ts`
4. Se verifica bcrypt y se registra auditoría; en éxito devuelve `{ id, name, email, role }`
5. Auth.js firma un JWT con `AUTH_SECRET` y lo almacena en una cookie HttpOnly
6. El middleware protege todas las rutas: API sin sesión → 401, páginas sin sesión → redirect `/login`

### Variables de entorno requeridas

```bash
AUTH_SECRET="$(openssl rand -base64 32)"
AUTH_URL="http://localhost:3000"
```

### Protección de rutas

- **Middleware** (`src/middleware.ts`): protección global de rutas
- **`requireSession()`** (`src/lib/session.ts`): para Server Components
- **`requireAuth()`** (`src/lib/middleware.ts`): para API Routes

Ver documentación detallada en [`docs/fase-3-diseno-tecnico/auth-authjs.md`](./docs/fase-3-diseno-tecnico/auth-authjs.md).

---

## Sitios (Epic 2)

Los **Sitios** representan ubicaciones físicas o lógicas que agrupan cámaras y recursos.

### Entidad Site

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Identificador único |
| name | string | Nombre único del sitio (max 255) |
| description | string? | Descripción opcional (max 1000) |
| timezone | string | Zona horaria IANA (default: UTC) |
| active | boolean | Si el sitio está activo (default: true) |
| createdAt / updatedAt / deletedAt | timestamp | Lifecycle |

### Soft delete

Los sitios usan **soft delete** (`deletedAt`). Para restaurar, usa `PATCH /api/sites/:id` con un `PUT` equivalente (o directamente en Prisma Studio).

---

## Deploy en Producción

### Servidor: `camapp.modest-benz.50-21-179-210.plesk.page`

```bash
# 1. Clonar repo en el servidor
git clone <tu-repo> /var/www/camwatch
cd /var/www/camwatch

# 2. Crear .env (Docker Compose lo lee automáticamente)
cp .env.example .env
# Editar .env con valores reales:
#   POSTGRES_PASSWORD=<password_seguro>
#   AUTH_SECRET=$(openssl rand -base64 32)
#   MEDIAMTX_JWT_SECRET=$(openssl rand -hex 32)
#   ENCRYPTION_KEY=$(openssl rand -hex 32)  # debe ser 64 hex chars
#   AUTH_URL=https://camapp.modest-benz.50-21-179-210.plesk.page
#   NEXT_PUBLIC_APP_URL=https://camapp.modest-benz.50-21-179-210.plesk.page

# 3. Deploy con script automatizado
chmod +x deploy.sh
./deploy.sh
```

### Variables de entorno Docker Compose

`${POSTGRES_USER:-camwatch}` lee del `.env` (no `.env.local`). Si la variable no está en `.env`, usa el valor por defecto `camwatch`.

| Variable | Default (dev) | Producción requerida |
|----------|---------------|----------------------|
| POSTGRES_USER | camwatch | ✅ en `.env` |
| POSTGRES_PASSWORD | camwatch_dev_password | 🔴 cambiar |
| POSTGRES_DB | camwatch | ✅ en `.env` |
| AUTH_SECRET | — | 🔴 generar con openssl |
| ENCRYPTION_KEY | — | 🔴 64 hex chars |

### Nota sobre Plesk + Nginx

Si Plesk gestiona el Nginx externo y el SSL, usa `docker-compose.prod.yml` **sin** el servicio `nginx` (Plesk hace proxy al puerto 3000 directamente). Añade en Plesk un Virtual Host → Proxy → `http://localhost:3000`.

---

## Cámaras (Epic 3)

Las **Cámaras** representan dispositivos IP registrados en la plataforma y gestionados por MediaMTX.

### Entidad Camera

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Identificador único |
| siteId | UUID | Sitio al que pertenece (requerido) |
| name | string | Nombre (max 255) |
| description | string? | Descripción opcional (max 1000) |
| path | string | URL/path del stream (guardado cifrado con AES-256-GCM) |
| protocol | enum | `rtsp` \| `rtmp` \| `webrtc` \| `hls` (default: rtsp) |
| enabled | boolean | Si la cámara está habilitada (default: true) |
| online | boolean | Estado de conectividad en tiempo real (default: false) |
| createdAt / updatedAt | timestamp | Lifecycle |

### Seguridad

- El campo `path` (URL/stream path) se **cifra en AES-256-GCM** antes de guardarse como `pathEncrypted`
- La API nunca expone `pathEncrypted` — siempre devuelve el `path` descifrado
- La clave de cifrado se define en `ENCRYPTION_KEY` (64 caracteres hex)

### Filtros disponibles en GET /api/cameras

```
GET /api/cameras?siteId=xxx&protocol=rtsp&enabled=true&online=false&search=entrada&page=1&limit=20
```

### Tests

```bash
bun run test -- src/__tests__/cameras/
```

18 tests cubriendo `createCameraSchema` y `updateCameraSchema`.

---

## Integración MediaMTX (Epic 4)

Sincronización entre las cámaras registradas en la plataforma y los streams activos en MediaMTX.

### Servicio `MediaMtxClient`

Archivo: `src/lib/mediamtx/client.ts`

| Método | Descripción |
|--------|-------------|
| `healthCheck()` | Ping rápido a `/v3/paths/list`. Devuelve `healthy`, `latencyMs`, `streamCount` |
| `validateConnection()` | Verifica conectividad vía `/v3/config/global/get` con fallback al listado |
| `listStreams()` | Lista todos los streams activos (nombre, estado `ready`, tracks, bytes) |
| `getStream(name)` | Obtiene un stream por nombre; devuelve `null` si no existe (404) |

```typescript
import { MediaMtxClient } from "@/lib/mediamtx/client";

const client = MediaMtxClient.fromEdgeServer(edgeServer);

const health = await client.healthCheck();
// { healthy: true, latencyMs: 12, streamCount: 3 }

const streams = await client.listStreams();
// [{ name: "camera-uuid", ready: true, tracks: ["H264"], ... }]
```

### API Routes

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/api/edge-servers/:id/health` | Health check + actualiza `status`/`lastSeenAt` | Todos |
| GET | `/api/edge-servers/:id/streams` | Lista streams activos en MediaMTX | Todos |
| POST | `/api/edge-servers/:id/sync` | Sincroniza `camera.online` con MediaMTX | Admin, Operator |

### Convención de nombres

MediaMTX identifica streams por **nombre de path**. La plataforma usa el **UUID de la cámara** como nombre de path en MediaMTX. Ejemplo:

```
# En MediaMTX config:
paths:
  550e8400-e29b-41d4-a716-446655440000:
    source: rtsp://admin:pass@192.168.1.100:554/stream
```

### Sincronización

El endpoint `POST /api/edge-servers/:id/sync`:
1. Verifica health del EdgeServer
2. Lista todos los streams desde MediaMTX
3. Compara con cámaras en BD (`enabled=true`)
4. Actualiza `camera.online` y registra `StreamEvent` por cada cambio
5. Devuelve resumen: `{ synced, online, offline, errors, latencyMs }`

### Tests

```bash
bun run test -- src/__tests__/mediamtx/
```

18 tests cubriendo constructor, `healthCheck`, `validateConnection`, `listStreams` y `getStream`.

---

## Dashboard (Epic 5)

Visualización en tiempo real de múltiples cámaras con soporte para WebRTC, drag-and-drop y pantalla completa.

### Layouts disponibles

| Layout | Celdas | Descripción |
|--------|--------|-------------|
| 1×1 | 1 | Foco en una sola cámara |
| 2×2 | 4 | Vista cuádruple |
| 3×3 | 9 | Vista 9 cámaras |
| 4×4 | 16 | Vista 16 cámaras |
| Custom | N×M | Definir columnas y filas (máx 6×6) |

### Componentes principales

| Componente | Archivo | Descripción |
|------------|---------|-------------|
| `CameraGrid` | `src/components/dashboard/camera-grid.tsx` | Grilla principal con dnd-kit sortable + LayoutSelector + polling |
| `CameraCard` | `src/components/dashboard/camera-card.tsx` | Tarjeta de cámara con indicador online/offline, badge de protocolo |
| `CameraPlayer` | `src/components/dashboard/camera-player.tsx` | Reproductor WebRTC/WHEP con estados: idle/loading/playing/error/offline |

### Estado global (Zustand)

```typescript
import { useDashboardStore } from "@/stores/dashboard.store";

const { layout, setLayout, cellCameraIds, setCellCamera } = useDashboardStore();
```

El estado se persiste en `localStorage` como `camwatch-dashboard`.

### Reproductor WebRTC (WHEP)

El reproductor usa el protocolo **WHEP** (WebRTC-HTTP Egress Protocol) de MediaMTX:

1. `POST /api/cameras/:id/stream` → devuelve `{ streamToken, whepUrl, expiresIn: 30 }`
2. El player crea un `RTCPeerConnection` y negocia SDP via `POST whepUrl`
3. El track remoto se asigna al elemento `<video>`

Requiere la variable de entorno:

```bash
MEDIAMTX_WEBRTC_URL=http://100.64.0.1:8889  # IP de Tailscale del servidor MediaMTX
```

### Funcionalidades

- **Pantalla completa**: botón por celda → fullscreen nativo del navegador
- **Drag & drop**: arrastrar celdas para reorganizar con `@dnd-kit/core`
- **Polling**: actualización automática del estado online/offline cada 10 s
- **Asignación de cámaras**: click en celda vacía → picker con lista de cámaras

### Storybook

```bash
bun run storybook          # Inicia en http://localhost:6006
bun run build-storybook    # Build estático
```

Stories disponibles:
- `Dashboard/CameraCard` — variantes Online, Offline, Compact, Protocols, Selected
- `Dashboard/CameraPlayer` — Idle, AutoPlay, ErrorState
- `Dashboard/CameraGrid` — Default, NoCameras, AllOffline, SingleCamera, SixteenCameras

### Tests

```bash
bun run test -- src/__tests__/dashboard/
```

21 tests: `camera-card.test.tsx` (14) + `camera-grid.test.tsx` (7).

---

## Layouts (Epic 6)

Permite guardar y cargar configuraciones del dashboard como **layouts persistentes** en base de datos.

### Entidad Layout

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Identificador único |
| userId | UUID | Propietario del layout |
| name | string | Nombre (max 100, trim) |
| configuration | JSONB | Snapshot del estado del dashboard (ver abajo) |
| isDefault | boolean | Si es el layout predeterminado del usuario |
| isShared | boolean | Visible por otros usuarios |
| createdAt / updatedAt / deletedAt | timestamp | Lifecycle + soft delete |

### LayoutConfiguration (campo JSON)

```typescript
interface LayoutConfiguration {
  gridLayout: "1x1" | "2x2" | "3x3" | "4x4" | "custom";
  cellCameraIds: (string | null)[];  // UUIDs de cámaras por celda
  customCols: number;  // 1–6
  customRows: number;  // 1–6
}
```

El campo `configuration` es un snapshot exacto del estado del store de Zustand.

### API Routes

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/api/layouts` | Listar layouts (propios + compartidos) | Todos |
| POST | `/api/layouts` | Crear layout con configuración | Todos |
| GET | `/api/layouts/:id` | Ver layout | Dueño/Admin |
| PATCH | `/api/layouts/:id` | Editar nombre, isDefault, isShared, configuration | Dueño/Admin |
| DELETE | `/api/layouts/:id` | Soft delete | Dueño/Admin |
| POST | `/api/layouts/:id/duplicate` | Duplicar layout con nuevo nombre | Todos |

### Flujo de uso

1. Desde el **Dashboard** → botón **"💾 Guardar"** en la barra de herramientas
2. Modal: nombre + opciones → `POST /api/layouts` con `configuration` del store
3. Desde **Layouts** (`/layouts`) → ver lista de layouts guardados
4. Click **"Aplicar"** → `loadConfiguration()` en el store → redirect a `/dashboard`
5. Click **"⎘"** (duplicar) → prompt de nombre → `POST /api/layouts/:id/duplicate`
6. Click **"★"** → marcar como predeterminado → `PATCH /api/layouts/:id { isDefault: true }`

### Estado global (Zustand)

Nuevas acciones en `useDashboardStore`:

```typescript
// Tomar snapshot del estado actual para guardar
const cfg = useDashboardStore.getState().getConfiguration();

// Cargar un layout guardado (reemplaza el estado actual)
useDashboardStore.getState().loadConfiguration(cfg);
```

### Página de Layouts

`/layouts` — tabla con columnas: Nombre, Grid, Creado por, Actualizado, Acciones.

### Tests

```bash
bun run test -- src/__tests__/layouts/
```

23 tests cubriendo todas las variantes de `layoutConfigurationSchema`, `createLayoutSchema`, `updateLayoutSchema` y `duplicateLayoutSchema`.

---

## Plesk — Configurar subdominio para Docker

### Contexto

- Dominio: `camapp.modest-benz.50-21-179-210.plesk.page`
- Docker expone Next.js en el **puerto 3000** del servidor
- Plesk gestiona Nginx externo + SSL

### Paso a paso

#### 1. Levantar la aplicación Docker

```bash
ssh root@50.21.179.210
cd /var/www/camwatch
./deploy.sh          # primera vez
# O para actualizaciones:
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Verifica que el contenedor está corriendo en el puerto 3000:

```bash
curl -I http://localhost:3000
# HTTP/1.1 200 OK
```

#### 2. Plesk → Sitio → Hosting → Modo Proxy

1. Accede a **Plesk Panel** → selecciona el dominio `camapp.modest-benz.50-21-179-210.plesk.page`
2. Ve a **Hosting Settings** → habilita **"Proxy mode"** (si está disponible en tu versión)
3. Establece la URL de destino: `http://localhost:3000`

#### 3. (Alternativa) Plesk → Configuración Nginx adicional

Si no tienes Proxy Mode, usa directivas Nginx personalizadas:

1. Ve al dominio → **Apache & Nginx Settings**
2. Busca el campo **"Additional nginx directives"** (o "Nginx include")
3. Pega lo siguiente:

```nginx
location / {
    proxy_pass         http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection 'upgrade';
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 86400;
}
```

4. Haz clic en **Apply** / **OK**

#### 4. Habilitar SSL (Let's Encrypt)

1. En Plesk, ve a tu dominio → **SSL/TLS Certificates**
2. Haz clic en **Let's Encrypt**
3. Marca "Redirect HTTP to HTTPS"
4. Emite el certificado

#### 5. Verificar variables de entorno en producción

Asegúrate de que tu `.env` en el servidor tenga:

```bash
AUTH_URL=https://camapp.modest-benz.50-21-179-210.plesk.page
NEXT_PUBLIC_APP_URL=https://camapp.modest-benz.50-21-179-210.plesk.page
NODE_ENV=production
```

#### 6. Verificar al final

```bash
curl -I https://camapp.modest-benz.50-21-179-210.plesk.page
# HTTP/2 200
```

### Resumen de puertos

| Servicio | Puerto | Expuesto |
|----------|--------|----------|
| Next.js (web) | 3000 | Solo localhost (Plesk hace proxy) |
| PostgreSQL | 5432 | Solo interno Docker |
| Redis | 6379 | Solo interno Docker |
| MediaMTX API | 9997 | Tailscale únicamente |
