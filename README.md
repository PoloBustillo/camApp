# Plataforma de Monitoreo de Cámaras IP — Documentación Técnica Completa

> **Rol:** Arquitecto de Software Senior / Product Owner / Tech Lead  
> **Fecha:** Junio 2026  
> **Estado:** Sprint 0 — Estructura inicial creada

---

## Descripción del Proyecto

Plataforma web para monitoreo en tiempo real de cámaras IP ubicadas en una instalación remota, utilizando **MediaMTX** como servidor de medios, **Tailscale** para conectividad segura, y **Next.js 15** como solución full-stack (frontend + API Routes) con **Prisma ORM** y **PostgreSQL**.

---

## Inicio Rápido

### Requisitos
- Node.js 20 LTS
- Docker + Docker Compose v2
- npm 10+

### Setup local

```bash
# 1. Clonar el repo
git clone <repo-url>
cd camera-platform

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus valores (especialmente ENCRYPTION_KEY y JWT secrets)

# 4. Levantar base de datos y Redis
docker compose up postgres redis -d

# 5. Ejecutar migraciones y seed
npm run db:migrate
npm run db:seed

# 6. Iniciar en desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

**Credenciales de desarrollo por defecto:**
- Email: `admin@camwatch.local`
- Password: `Admin123!`

### Comandos útiles

```bash
npm run dev            # Inicia Next.js con Turbopack
npm run build          # Build de producción
npm run typecheck      # Verificación de tipos TypeScript
npm run lint           # ESLint

npm run db:migrate     # Aplica migraciones pendientes
npm run db:seed        # Carga datos iniciales
npm run db:studio      # Abre Prisma Studio (http://localhost:5555)
npm run db:reset       # Resetea la BD (CUIDADO: borra todo)

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
| GET | `/api/cameras` | Listar cámaras | Todos |
| POST | `/api/cameras` | Crear cámara | Admin |
| GET | `/api/cameras/:id` | Ver cámara | Todos |
| PATCH | `/api/cameras/:id` | Editar cámara | Admin |
| DELETE | `/api/cameras/:id` | Eliminar cámara | Admin |
| POST | `/api/cameras/:id/stream` | Token de stream WebRTC | Todos |
| GET | `/api/layouts` | Listar layouts | Todos |
| POST | `/api/layouts` | Crear layout | Todos |
| PATCH | `/api/layouts/:id` | Editar layout + celdas | Dueño/Admin |
| DELETE | `/api/layouts/:id` | Eliminar layout | Dueño/Admin |
| GET | `/api/users` | Listar usuarios | Admin |
| POST | `/api/users` | Crear usuario | Admin |
| PATCH | `/api/users/:id` | Editar usuario | Admin |
| DELETE | `/api/users/:id` | Eliminar usuario | Admin |
| GET | `/api/edge-servers` | Listar servidores edge | Todos |
| POST | `/api/edge-servers` | Registrar servidor | Admin |
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
| Camera | `cameras` | Cámaras IP con URL RTSP cifrada |
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
