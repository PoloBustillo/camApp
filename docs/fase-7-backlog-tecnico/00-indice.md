# Fase 7 — Backlog Técnico: Índice de Documentos

**Proyecto:** CamWatch Platform  
**Fase:** 7 — Backlog Técnico para Implementación  
**Fecha de generación:** 2025  
**Estado:** Listo para desarrollo

---

## Propósito de esta Fase

Esta fase contiene todos los documentos técnicos necesarios para que el equipo de desarrollo (o un agente de codificación autónomo) pueda implementar el sistema CamWatch Platform de principio a fin, sin ambigüedades.

Los documentos cubren: qué construir, en qué orden, con qué archivos, qué pruebas escribir, qué riesgos gestionar y cuándo considerar el MVP como "hecho".

---

## Documentos

| Archivo | Título | Descripción | Público objetivo |
|---------|--------|-------------|-----------------|
| `00-indice.md` | **Índice** | Este documento. Mapa de navegación de la fase. | Todos |
| `01-product-backlog.md` | **Product Backlog Completo** | Todas las historias de usuario (US-001 a US-028+) con formato detallado: objetivo, dependencias, riesgos, archivos, APIs, cambios de BD, DoD y casos de prueba. | Developers, QA, PO |
| `02-sprint-backlog.md` | **Sprint Backlog Detallado** | Desglose sprint por sprint (Sprint 0–4) con tareas concretas de implementación, estimaciones en horas, responsable (backend/frontend), riesgos del sprint y DoD. | Developers, Scrum Master |
| `03-orden-implementacion.md` | **Orden de Implementación** | Secuencia recomendada día a día para implementar las tareas dentro de cada sprint. Incluye razonamiento de dependencias técnicas. Diseñado para ser seguido por un agente de codificación. | Coding Agent, Tech Lead |
| `04-mapa-dependencias.md` | **Mapa de Dependencias** | Grafos ASCII de dependencias entre historias, entre capas técnicas, entre sprints y dependencias externas (MediaMTX, Redis, Tailscale). | Tech Lead, Architects |
| `05-riesgos-por-sprint.md` | **Registro de Riesgos** | Registro completo de riesgos técnicos y de proceso, clasificados por sprint. Incluye probabilidad, impacto, mitigación y plan de contingencia. | Scrum Master, PM, Tech Lead |
| `06-mvp-minimo-funcional.md` | **Definición del MVP** | Definición precisa del mínimo producto viable: qué historias son estrictamente necesarias, el "walking skeleton" arquitectónico, criterios de aceptación para go-live y checklist de producción. | PO, Tech Lead, QA |

---

## Cómo usar estos documentos

### Para un desarrollador humano
1. Leer `04-mapa-dependencias.md` para entender el grafo de dependencias
2. Seguir `03-orden-implementacion.md` para saber qué implementar primero
3. Consultar `01-product-backlog.md` para los detalles exactos de cada historia
4. Usar `02-sprint-backlog.md` como checklist de tareas diarias
5. Consultar `05-riesgos-por-sprint.md` cuando algo sale mal

### Para un agente de codificación autónomo
1. **Comenzar con** `03-orden-implementacion.md` — es la secuencia de implementación
2. **Para cada tarea**, consultar `01-product-backlog.md` por los archivos exactos y tests requeridos
3. **Si hay ambigüedad de orden**, consultar `04-mapa-dependencias.md`
4. **Al finalizar cada sprint**, verificar el DoD en `02-sprint-backlog.md`

---

## Stack Tecnológico de Referencia Rápida

```
Frontend:   Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
            Zustand (state) + TanStack Query (server state) + @dnd-kit/core (drag&drop)

Backend:    Fastify 4 + Node.js 20 LTS + TypeScript + Knex.js

Database:   PostgreSQL 16 + Redis 7

Media:      MediaMTX (WebRTC/WHEP desde cámaras RTSP)

Infra:      Tailscale (VPN) + Nginx 1.25 (reverse proxy)

Tests:      Vitest + Testing Library + Playwright

CI/CD:      GitHub Actions

Monitor:    Prometheus + Grafana
```

## Estructura del Monorepo

```
/
├── apps/
│   ├── api/                    # Fastify backend
│   │   └── src/
│   │       ├── modules/        # Feature modules (auth, cameras, etc.)
│   │       ├── database/
│   │       │   └── migrations/ # Knex migrations
│   │       ├── plugins/        # Fastify plugins
│   │       └── shared/         # Shared backend utilities
│   └── web/                    # Next.js frontend
│       └── src/
│           ├── app/            # App Router pages
│           ├── components/     # UI components
│           ├── hooks/          # Custom hooks
│           ├── stores/         # Zustand stores
│           └── lib/            # Utilities
├── packages/
│   └── shared/                 # Shared TS types + Zod schemas
│       └── src/
│           ├── types/
│           └── schemas/
├── docker-compose.yml
├── package.json                # Workspace root
└── turbo.json                  # Turborepo config
```

---

## Resumen de Sprints

| Sprint | Duración | Historias | Story Points | Objetivo Principal |
|--------|----------|-----------|--------------|-------------------|
| Sprint 0 | 2 semanas | — | — | Infraestructura, proyecto base, CI/CD, migraciones DB |
| Sprint 1 | 2 semanas | US-001–006 | 23 SP | Auth + Edge Servers + Locations |
| Sprint 2 | 2 semanas | US-007–011, US-013 | 37 SP | Camera CRUD + WebRTC streaming |
| Sprint 3 | 2 semanas | US-012, US-014–020, US-028 | 34 SP | Layouts + User Management |
| Sprint 4 | 2 semanas | Técnico + US-021 | ~10 SP | Hardening + Observabilidad + Deploy a producción |

**Total MVP:** ~104 SP en 10 semanas

---

*Documento generado como parte de la planificación técnica de CamWatch Platform.*
