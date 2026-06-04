# 6.1 — Stack Tecnológico Completo

**Proyecto:** CamWatch Platform  
**Versión:** 1.1  
**Fecha:** Junio 2026  
**Última actualización:** Sprint 0 — Stack simplificado a Next.js full-stack

---

> **ADR-007 (Revisado):** Se reemplaza Fastify (backend separado) por **Next.js 15 API Routes**,
> eliminando el servicio backend como proceso independiente. El acceso a datos usa **Prisma ORM**
> en lugar de Knex.js. Esto reduce la complejidad operacional y el número de contenedores.

---

## Resumen Ejecutivo del Stack

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CAMWATCH TECHNOLOGY STACK                        │
├──────────────────┬──────────────────────────────────────────────────────┤
│ App (Full-stack) │ Next.js 15 (App Router) + TypeScript + Tailwind CSS  │
│ API              │ Next.js API Routes (Route Handlers) — mismo proceso  │
│ ORM              │ Prisma ORM 6 + PostgreSQL 16                         │
│ Caché/Sessions   │ Redis 7                                               │
│ Servidor Medios  │ MediaMTX (latest stable)                             │
│ VPN              │ Tailscale                                             │
│ Reverse Proxy    │ Nginx 1.25                                           │
│ Contenedores     │ Docker + Docker Compose                              │
│ CI/CD            │ GitHub Actions                                        │
│ Monitoreo        │ Prometheus + Grafana + UptimeRobot                   │
│ Pruebas          │ Vitest + Testing Library + Playwright                │
└──────────────────┴──────────────────────────────────────────────────────┘
```

---

## 1. APLICACIÓN FULL-STACK (Next.js 15)

### Next.js 15 (App Router + API Routes)

| Aspecto                        | Detalle                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Versión**                    | Next.js 15 con App Router                                                                           |
| **Lenguaje**                   | TypeScript 5                                                                                        |
| **Rol**                        | Frontend (React) + Backend (API Route Handlers) en un solo proceso                                  |
| **Por qué Next.js full-stack** | Elimina un servicio extra, comparte tipos entre UI y API, deployment más simple, un solo Dockerfile |
| **API Routes**                 | `src/app/api/**` — Route Handlers (`GET`, `POST`, `PATCH`, `DELETE`)                                |
| **Alternativas descartadas**   | Fastify separado: más flexibilidad pero más complejidad operacional para este tamaño de proyecto    |

### Librerías de UI y Estilos

| Librería                  | Versión | Uso                                                                           |
| ------------------------- | ------- | ----------------------------------------------------------------------------- |
| **Tailwind CSS**          | 3.x     | Estilos utilitarios, responsive design                                        |
| **shadcn/ui**             | Latest  | Componentes de UI accesibles (Dialog, Toast, Form, Table) basados en Radix UI |
| **Radix UI**              | Latest  | Primitivos accesibles para componentes complejos                              |
| **Lucide React**          | Latest  | Iconografía consistente                                                       |
| **clsx + tailwind-merge** | Latest  | Composición de clases CSS                                                     |

### Estado y Datos

| Librería              | Versión | Uso                                                                                   |
| --------------------- | ------- | ------------------------------------------------------------------------------------- |
| **Zustand**           | 4.x     | Estado global ligero (auth store, ui store, layout store)                             |
| **TanStack Query v5** | 5.x     | Fetching, caching y sincronización de datos del servidor (cámaras, usuarios, layouts) |
| **Zod**               | 3.x     | Validación de formularios en el cliente (compartido con el backend)                   |
| **React Hook Form**   | 7.x     | Gestión de formularios con mínimas re-renderizaciones                                 |

### Video y WebRTC

| Librería               | Versión               | Uso                                       |
| ---------------------- | --------------------- | ----------------------------------------- |
| **WebRTC nativo**      | Browser API           | `RTCPeerConnection` para streaming        |
| **WHEP client custom** | Implementación propia | Protocolo WHEP para negociar con MediaMTX |

> **Por qué implementación propia de WHEP:** Es un protocolo HTTP simple (un POST con SDP), no requiere librería. Las librerías existentes son demasiado genéricas o tienen overhead innecesario.

### Drag & Drop (Layout Builder)

| Librería          | Versión | Uso                                                            |
| ----------------- | ------- | -------------------------------------------------------------- |
| **@dnd-kit/core** | 6.x     | Drag & drop accesible para asignar cámaras a celdas del layout |

---

## 2. API (Next.js Route Handlers)

> **Nota:** No existe un proceso backend separado. Las API Routes de Next.js reemplazan a Fastify.
> Se ejecutan en el mismo proceso Node.js que el frontend (desarrollo) o en funciones serverless/standalone (producción).

### Acceso a Datos — Prisma ORM

| Librería               | Uso                                                                               |
| ---------------------- | --------------------------------------------------------------------------------- |
| **Prisma ORM 6**       | ORM type-safe para PostgreSQL. Migraciones con `prisma migrate`. Client generado. |
| **Prisma Client**      | Queries type-safe auto-generadas desde el schema                                  |
| `prisma/schema.prisma` | Fuente de verdad del modelo de datos                                              |
| `prisma/seed.ts`       | Datos iniciales: admin + edge server de dev                                       |

> **Por qué Prisma:**
>
> - Type-safety completa desde el schema hasta la query
> - Migrations integradas en el flujo de desarrollo
> - Prisma Studio para inspección visual de la BD en desarrollo
> - Compatibilidad perfecta con TypeScript y Next.js

### Validación y Seguridad

| Librería           | Uso                                                                 |
| ------------------ | ------------------------------------------------------------------- |
| **Zod**            | Validación de request bodies en API Routes                          |
| **jose**           | JWT firmado/verificado con HS256 (access + refresh + stream tokens) |
| **bcryptjs**       | Hash de contraseñas (work factor 12)                                |
| **Node.js crypto** | AES-256-GCM para cifrar credenciales RTSP                           |

### Cifrado y Seguridad

| Librería                 | Uso                                           |
| ------------------------ | --------------------------------------------- |
| **bcryptjs**             | Hash de contraseñas (bcrypt, work factor 12)  |
| **crypto (Node nativo)** | AES-256-GCM para cifrado de credenciales RTSP |
| **jsonwebtoken**         | Firma y verificación de JWTs                  |

### Tareas en Background

| Librería      | Uso                                                                             |
| ------------- | ------------------------------------------------------------------------------- |
| **node-cron** | Cron jobs para health check de streams (cada 60s), limpieza de tokens expirados |

---

## 3. BASE DE DATOS

### PostgreSQL 16

| Aspecto                      | Detalle                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Versión**                  | PostgreSQL 16                                                                                                    |
| **Imagen Docker**            | `postgres:16-alpine`                                                                                             |
| **Por qué PostgreSQL**       | ACID, JSONB, particionamiento, row-level security, excelente rendimiento, amplio soporte en VPS                  |
| **Alternativas descartadas** | MySQL: menos features avanzados. SQLite: no apto para concurrencia. MongoDB: no relacional, overhead innecesario |

### Estrategia de Migraciones

| Herramienta         | Uso                                                           |
| ------------------- | ------------------------------------------------------------- |
| **Knex Migrations** | Archivos de migración versionados en `db/migrations/`         |
| **Knex Seeds**      | Datos iniciales (primer usuario Admin, EdgeServer de ejemplo) |

---

## 4. CACHÉ

### Redis 7

| Aspecto           | Detalle                                                                           |
| ----------------- | --------------------------------------------------------------------------------- |
| **Versión**       | Redis 7                                                                           |
| **Imagen Docker** | `redis:7-alpine`                                                                  |
| **Persistencia**  | AOF (Append Only File) habilitado                                                 |
| **Usos**          | Token blacklist, rate limiting counters, caché de estado de streams               |
| **Por qué Redis** | Estándar de la industria, muy rápido, soporte nativo en casi todos los frameworks |

---

## 5. SERVIDOR DE MEDIOS

### MediaMTX

| Aspecto                      | Detalle                                                                                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Versión**                  | Última estable con soporte WHEP                                                                                                                                       |
| **Instalación**              | Binario nativo en Ubuntu (systemd service)                                                                                                                            |
| **Por qué MediaMTX**         | Único servidor de medios open source que soporta RTSP inbound → WebRTC/WHEP outbound sin transcodificación. Ligero, configurable vía API HTTP, activamente mantenido. |
| **Alternativas descartadas** | Nginx-RTMP: no WebRTC. Janus: más complejo, no RTSP nativo. Wowza: comercial y caro. SRS: menos maduro en WebRTC.                                                     |

---

## 6. INFRAESTRUCTURA

### Contenedores — Docker + Docker Compose

| Aspecto                      | Detalle                                                               |
| ---------------------------- | --------------------------------------------------------------------- |
| **Runtime**                  | Docker Engine 24+                                                     |
| **Orquestación**             | Docker Compose v2 (MVP) → Kubernetes (futuro lejano)                  |
| **Por qué Docker Compose**   | Suficiente para el volumen del MVP. Simple de operar. Fácil rollback. |
| **Alternativas descartadas** | Kubernetes: overkill para MVP. Swarm: menos adoptado.                 |

### Reverse Proxy — Nginx

| Configuración  | Valor                                  |
| -------------- | -------------------------------------- |
| TLS            | Let's Encrypt (Certbot)                |
| Protocolos SSL | TLSv1.2, TLSv1.3                       |
| HTTP/2         | Habilitado                             |
| Gzip           | Habilitado para texto                  |
| Caché estático | Next.js assets con Cache-Control largo |

### VPN — Tailscale

| Aspecto                      | Detalle                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| **Por qué Tailscale**        | Configuración cero de NAT, basado en WireGuard, ACLs centralizadas, sin gestión de certificados |
| **Alternativas descartadas** | WireGuard manual: complejo sin IP estática. OpenVPN: más overhead.                              |

---

## 7. CI/CD

### GitHub Actions

```yaml
# Pipeline completo

on: push (main/develop) + PR

Jobs:
  lint: ESLint + TypeScript check (2 min)
  test: Vitest unit + integration tests (3-5 min)
  build: Docker image build (5-8 min)
  push: Push a Docker Hub/GHCR (2 min)
  deploy: SSH → docker compose pull && docker compose up -d (3 min)
  e2e: Playwright E2E en staging (10-15 min) [solo en main]

Total tiempo en main: ~25-30 minutos
Total tiempo en PRs: ~10-15 minutos (sin deploy ni E2E)
```

### Estrategia de Branches

| Branch      | Uso                     | Deploy                |
| ----------- | ----------------------- | --------------------- |
| `main`      | Código de producción    | Auto-deploy a prod    |
| `develop`   | Integración de features | Auto-deploy a staging |
| `feature/*` | Desarrollo de features  | No deploy             |
| `fix/*`     | Bug fixes               | No deploy             |
| `release/*` | Preparación de release  | No deploy             |

---

## 8. MONITOREO Y OBSERVABILIDAD

### Stack de Monitoreo

| Herramienta            | Rol                                                    | Tier         |
| ---------------------- | ------------------------------------------------------ | ------------ |
| **UptimeRobot** (free) | Monitoreo externo de disponibilidad, alertas por email | MVP          |
| **Prometheus**         | Recolección de métricas del backend                    | MVP (básico) |
| **Grafana**            | Visualización de métricas                              | v1           |
| **Pino**               | Logging estructurado                                   | MVP          |
| **Loki**               | Agregación de logs                                     | v1           |
| **Sentry**             | Error tracking del frontend                            | v1           |

---

## 9. PRUEBAS

### Estrategia de Testing

| Tipo                            | Herramienta              | Cobertura objetivo                                          |
| ------------------------------- | ------------------------ | ----------------------------------------------------------- |
| **Unit Tests (Backend)**        | Vitest                   | Services, utils, validators — 80%                           |
| **Integration Tests (Backend)** | Vitest + Supertest       | Endpoints API con DB real (test DB) — 70%                   |
| **Unit Tests (Frontend)**       | Vitest + Testing Library | Componentes críticos (WebRTCPlayer, LayoutBuilder) — 60%    |
| **E2E Tests**                   | Playwright               | Flujos críticos: login, ver cámara, crear layout — 5 flujos |

### Flujos E2E Cubiertos en MVP

1. Login → Ver dashboard → Logout
2. Admin: Agregar cámara → Ver en dashboard → Eliminar cámara
3. Operator: Crear layout 2x2 → Seleccionar en dashboard → Ver streams
4. Admin: Crear Operator → Operator hace login → Ve streams
5. Token expirado → Refresh automático → Continúa navegando

---

## 10. SEGURIDAD DE DEPENDENCIAS

| Herramienta     | Uso                                                     |
| --------------- | ------------------------------------------------------- |
| **npm audit**   | Análisis de vulnerabilidades en dependencias (en CI)    |
| **Dependabot**  | Actualizaciones automáticas de dependencias con PR      |
| **SAST básico** | ESLint con reglas de seguridad (eslint-plugin-security) |

---

## Resumen de Versiones

| Tecnología | Versión                 |
| ---------- | ----------------------- |
| Node.js    | 20 LTS                  |
| TypeScript | 5.x                     |
| Next.js    | 14.x                    |
| Fastify    | 4.x                     |
| PostgreSQL | 16                      |
| Redis      | 7                       |
| MediaMTX   | Latest stable (≥ 1.7.0) |
| Nginx      | 1.25                    |
| Docker     | 24+                     |
| Tailscale  | Latest                  |

---

## Consideraciones de Mantenimiento a Largo Plazo

| Aspecto                         | Estrategia                                                |
| ------------------------------- | --------------------------------------------------------- |
| Actualizaciones de Node.js      | Seguir ciclo LTS. Actualizar en la siguiente versión LTS. |
| Actualizaciones de dependencias | Dependabot automático + revisión manual semanal           |
| Actualizaciones de MediaMTX     | Probar en staging antes de aplicar en producción          |
| Actualizaciones de PostgreSQL   | Major versions: migración planificada en v2               |
| Rotación de secretos            | Cada 3 meses para JWT secrets, cada año para otros        |
| Revisión de seguridad           | Trimestral: `npm audit` + revisión manual de OWASP Top 10 |
