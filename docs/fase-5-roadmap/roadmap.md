# 5.1 — Roadmap por Sprints

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026  
**Duración de Sprint:** 2 semanas

---

## Vista General del Roadmap

```
Semana:   1-2         3-4         5-6         7-8         9-10
          ────────────────────────────────────────────────────
          Sprint 0    Sprint 1    Sprint 2    Sprint 3    Sprint 4
          ────────────────────────────────────────────────────
          Fundaciones  Auth +      Streaming   Layouts     MVP
          + Setup      Infra       + Cámaras   + Usuarios  Completo

Meta:     Entorno     Login        Ver video   Dashboard   Sistema
          listo       funcionando  de cámaras  operativo   en prod.
```

---

# SPRINT 0 — Fundaciones y Validaciones
**Duración:** 2 semanas  
**Objetivo:** "Todo está en su lugar para empezar a construir"

## Objetivo del Sprint
Validar supuestos técnicos críticos, preparar el entorno de desarrollo y establecer las bases del proyecto antes de escribir código de producto.

---

## Tareas del Sprint 0

### 0.1 — Validación de Infraestructura y Supuestos
- [ ] Instalar Tailscale en el servidor Ubuntu remoto.
- [ ] Instalar Tailscale en el VPS.
- [ ] Verificar conectividad entre VPS y servidor remoto (`tailscale ping`).
- [ ] Configurar ACLs de Tailscale (solo VPS → servidor remoto en puerto 9997).
- [ ] Instalar MediaMTX en el servidor Ubuntu.
- [ ] Configurar al menos 1 cámara RTSP en MediaMTX.
- [ ] **Prueba clave:** Transmitir el stream de la cámara como WebRTC desde un browser externo (confirma que el stack funciona).
- [ ] Medir latencia end-to-end y documentar resultado.
- [ ] Medir CPU/RAM del servidor Ubuntu con 3-5 streams activos.
- [ ] Verificar que la API de MediaMTX es accesible desde el VPS vía Tailscale.

### 0.2 — Setup del Proyecto
- [ ] Inicializar repositorio Git con estructura de monorepo (o repos separados).
- [ ] Crear `docker-compose.yml` base (Nginx, backend, frontend, PostgreSQL, Redis).
- [ ] Configurar variables de entorno de ejemplo (`.env.example`).
- [ ] Configurar linting (ESLint, Prettier) y pre-commit hooks.
- [ ] Configurar TypeScript en backend (Fastify) y frontend (Next.js).
- [ ] Crear pipeline básico de CI/CD (GitHub Actions: lint + tests).
- [ ] Configurar base de datos PostgreSQL con migraciones (Knex o similar).
- [ ] Crear migration inicial con todos los ENUMs y tablas.
- [ ] Ejecutar migration y verificar esquema.
- [ ] Configurar Redis y verificar conexión desde el backend.

### 0.3 — Documentación de Decisiones
- [ ] Responder todas las Preguntas Abiertas críticas (PA-001 a PA-007) de la Fase 1.
- [ ] Actualizar supuestos validados/refutados en el documento de Supuestos.
- [ ] Documentar resultados de la prueba de latencia y recursos de MediaMTX.
- [ ] Crear el archivo `CONTRIBUTING.md` con proceso de desarrollo.

### 0.4 — Configurar Dominio e Infraestructura VPS
- [ ] Apuntar dominio `camwatch.ejemplo.com` al VPS.
- [ ] Configurar Nginx con certificado Let's Encrypt (SSL).
- [ ] Verificar HTTPS funcionando en el dominio.
- [ ] Configurar firewall (UFW) en el VPS.

---

**Definición de DONE del Sprint 0:**
- Un stream de cámara real es visible en un browser a través del stack (aunque sea sin autenticación).
- La base de datos tiene el esquema creado y migrado.
- El CI/CD pipeline está verde.
- Todas las preguntas abiertas críticas tienen respuesta.

**Riesgos del Sprint 0:**
- La latencia WebRTC podría superar el objetivo → requerirá ajuste de configuración.
- MediaMTX podría necesitar más CPU de la disponible → requeriría reducir cámaras o ajustar calidad.

---

# SPRINT 1 — Autenticación e Infraestructura Base
**Duración:** 2 semanas  
**Objetivo:** "Un usuario puede ingresar al sistema y ver la lista de cámaras (sin video)"

## User Stories incluidas
| Story | Descripción | SP |
|-------|-------------|-----|
| US-001 | Login con email y contraseña | 5 |
| US-002 | Renovación automática de token | 3 |
| US-003 | Cerrar sesión | 2 |
| US-004 | Protección de rutas por rol | 3 |
| US-005 | Registrar servidor edge (MediaMTX) | 5 |
| US-006 | Crear y gestionar ubicaciones | 5 |
| **Total** | | **23 SP** |

## Entregables del Sprint 1
- [ ] Página de login funcional con validación.
- [ ] JWT + refresh token funcionando con cookie HttpOnly.
- [ ] Middleware de autenticación y RBAC en el backend.
- [ ] Página de gestión de servidores edge (Admin).
- [ ] Página de gestión de ubicaciones (Admin).
- [ ] Seed de datos: 1 usuario Admin, 1 Operator, 1 Viewer, 1 EdgeServer, 2 Locations.
- [ ] Tests unitarios: AuthService, JWT validation.
- [ ] Tests de integración: POST /auth/login, POST /auth/refresh.

## Criterio de DONE del Sprint 1
- El Admin puede iniciar sesión, ver el dashboard (vacío), y crear una ubicación.
- Los roles están aplicados correctamente (un Viewer no puede acceder a /cameras/new).
- Rate limiting de login funciona (5 intentos → bloqueo).

---

# SPRINT 2 — Gestión de Cámaras y Streaming
**Duración:** 2 semanas  
**Objetivo:** "El Admin puede agregar cámaras y el Operador puede verlas en tiempo real"

## User Stories incluidas
| Story | Descripción | SP |
|-------|-------------|-----|
| US-007 | Agregar nueva cámara | 8 |
| US-008 | Ver lista de cámaras | 3 |
| US-009 | Editar cámara | 5 |
| US-010 | Eliminar cámara | 3 |
| US-011 | Ver streams en tiempo real (player WebRTC básico) | 13 |
| US-013 | Reconexión automática de streams | 5 |
| **Total** | | **37 SP** |

## Entregables del Sprint 2
- [ ] Formulario de agregar cámara con integración a MediaMTX API.
- [ ] Cifrado AES-256-GCM para credenciales RTSP.
- [ ] Health check de streams (job periódico cada 60s).
- [ ] Componente WebRTCPlayer con WHEP handshake.
- [ ] Lógica de reconexión con backoff exponencial.
- [ ] Dashboard básico con celdas de video (una por cámara, layout fijo 2x2).
- [ ] Indicador "Sin señal" para cámaras offline.
- [ ] Tests de integración: CRUD de cámaras, MediaMTX mock.

## Criterio de DONE del Sprint 2
- El Admin agrega una cámara y el Operator la ve en tiempo real en el dashboard.
- La cámara muestra "Sin señal" cuando se desconecta y reconecta automáticamente.
- Las credenciales RTSP están cifradas en la DB (verificado).

---

# SPRINT 3 — Layouts Personalizados y Gestión de Usuarios
**Duración:** 2 semanas  
**Objetivo:** "El Operador puede personalizar su vista y el Admin gestiona el equipo"

## User Stories incluidas
| Story | Descripción | SP |
|-------|-------------|-----|
| US-014 | Crear layout personalizado | 8 |
| US-015 | Cambiar entre layouts | 3 |
| US-016 | Editar y eliminar layouts | 3 |
| US-017 | Compartir layout | 2 |
| US-012 | Ver cámara en pantalla completa | 3 |
| US-018 | Crear usuario | 5 |
| US-019 | Gestionar usuarios | 5 |
| US-020 | Cambiar contraseña propia | 3 |
| US-028 | Filtrar cámaras por ubicación | 2 |
| **Total** | | **34 SP** |

## Entregables del Sprint 3
- [ ] Constructor de layouts con drag & drop (o clicks para asignar cámaras).
- [ ] Selector de grilla (1x1, 2x2, 2x3, 3x3).
- [ ] Selector de layouts en el dashboard.
- [ ] Modo pantalla completa en el player.
- [ ] Página de gestión de usuarios (CRUD completo).
- [ ] Cambio de contraseña propia.
- [ ] Panel lateral de cámaras con filtro por ubicación.
- [ ] Tests de integración: Layouts, Users.

## Criterio de DONE del Sprint 3
- El Operador puede crear un layout 2x2 con 3 cámaras y cambiarlo en el dashboard.
- El Admin puede crear un Operator, que luego puede iniciar sesión.
- Un Viewer solo ve layouts compartidos, no puede crear propios.

---

# SPRINT 4 — Pulido, Hardening y Despliegue a Producción
**Duración:** 2 semanas  
**Objetivo:** "El MVP está listo para uso real en producción"

## User Stories incluidas
| Story | Descripción | SP |
|-------|-------------|-----|
| US-021 | Panel de estado del sistema | 3 |
| Hardening de seguridad | Rate limiting, headers, CORS | — |
| Observabilidad | /metrics, /health, alertas básicas | — |
| Pruebas E2E | Flujos críticos del usuario | — |
| Documentación operativa | README de despliegue | — |

## Entregables del Sprint 4
- [ ] Panel de estadísticas del sistema para Admin.
- [ ] Rate limiting en todos los endpoints sensibles.
- [ ] Headers de seguridad HTTP (CSP, HSTS, etc.).
- [ ] Endpoint `/health` con estado de servicios dependientes.
- [ ] Endpoint `/metrics` (Prometheus) con métricas clave.
- [ ] Configuración de UptimeRobot para monitoreo externo.
- [ ] Tests E2E: Login → Ver camera → Crear layout → Logout.
- [ ] Pruebas de carga básica (simular 5 usuarios concurrentes).
- [ ] README de despliegue (`DEPLOYMENT.md`).
- [ ] Proceso de backup de DB configurado y probado.
- [ ] **Despliegue a producción y prueba con usuarios reales.**
- [ ] Retrospectiva y documentación de lecciones aprendidas.

## Criterio de DONE del Sprint 4 (Definition of DONE del MVP)
- El sistema está desplegado en el VPS de producción.
- El Admin puede hacer onboarding de un Operator (crear cuenta, mostrar el dashboard).
- Los 10 streams de cámaras funcionan simultáneamente en un layout 3x3.
- No hay vulnerabilidades conocidas (OWASP Top 10 revisado).
- Los backups automáticos están funcionando.
- La latencia de video es < 2 segundos (medido en el entorno de producción).

---

## Velocidad Estimada

| Sprint | Story Points | Notas |
|--------|-------------|-------|
| Sprint 0 | No aplica | Setup + validación |
| Sprint 1 | 23 SP | Primer sprint de producto |
| Sprint 2 | 37 SP | Sprint más intenso (streaming) |
| Sprint 3 | 34 SP | UI compleja (layouts) |
| Sprint 4 | ~10 SP + tareas técnicas | Hardening y deploy |
| **Total MVP** | **~104 SP** | **~5 semanas de sprint** |

**Velocidad de equipo asumida:** 20-25 SP por sprint (equipo de 2-3 devs).  
**Ajuste:** Si la velocidad real es menor, se puede mover US-020, US-021, US-028 a Sprint 5 sin comprometer el MVP core.

---

## Post-MVP — Sprints 5-8 (v1)

| Sprint | Foco Principal | Stories Clave |
|--------|---------------|---------------|
| Sprint 5 | Grabación de video - Backend | US-022 (parte 1) |
| Sprint 6 | Grabación de video - UI | US-023 |
| Sprint 7 | Notificaciones y alertas | US-024, US-025 |
| Sprint 8 | Mobile responsive + PTZ | US-027 |
