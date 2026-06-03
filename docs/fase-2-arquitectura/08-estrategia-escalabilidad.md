# 2.8 — Estrategia de Escalabilidad

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## Modelo de Crecimiento

El sistema está diseñado para crecer en tres dimensiones:

| Dimensión | MVP | v1 | v2 | Futuro |
|-----------|-----|----|----|--------|
| **Cámaras** | 10 | 25 | 50 | 100+ |
| **Usuarios concurrentes** | 5 | 20 | 50 | 200+ |
| **Ubicaciones remotas** | 1 | 3 | 10 | N |
| **Retención de grabaciones** | No | 7 días | 30 días | Configurable |

---

## Nivel 1: Escalabilidad Vertical (MVP → v1)

**Cuando aplicar:** Primeras señales de degradación de rendimiento.  
**Esfuerzo:** Bajo (cambio de plan en el proveedor de VPS).

```
MVP: VPS 2 vCPU / 4 GB RAM / 40 GB SSD
  ↓
v1:  VPS 4 vCPU / 8 GB RAM / 80 GB SSD
  ↓
v2:  VPS 8 vCPU / 16 GB RAM / 160 GB SSD

Costo de implementación: ~ 0 (solo cambio de plan)
Tiempo de migración: < 30 minutos (snapshot + resize)
```

**Cuándo escalar verticalmente:**
- CPU del VPS > 70% sostenido por más de 5 minutos
- Memoria > 80% utilizada
- Tiempo de respuesta de la API > 500ms en p95

---

## Nivel 2: Separación de Servicios (v1)

Separar los servicios del VPS en instancias independientes:

```
MVP (todo en un VPS):
  VPS-1: Nginx + Frontend + Backend + PostgreSQL + Redis

v1 (servicios separados):
  VPS-APP: Nginx + Frontend + Backend
  VPS-DB:  PostgreSQL (managed o dedicado)
  VPS-CACHE: Redis (managed o dedicado)
```

**Ventajas:**
- PostgreSQL y Redis pueden escalarse independientemente.
- Backups y configuración de DB aislados de la aplicación.
- Actualizaciones de la app no afectan la DB.

---

## Nivel 3: Escalabilidad Horizontal del Backend (v2)

Cuando un solo servidor de backend no es suficiente:

```
Load Balancer (Nginx / HAProxy / Cloudflare)
    │
    ├── Backend Instance 1 (Fastify) ──► PostgreSQL
    ├── Backend Instance 2 (Fastify) ──► PostgreSQL  
    └── Backend Instance 3 (Fastify) ──► PostgreSQL
                  │
              Redis Cluster (session store compartido)
```

**Requisito ya satisfecho desde el MVP:**
- El backend es **stateless** (no mantiene estado de sesión en memoria).
- Los JWT son auto-contenidos.
- La blacklist de tokens usa Redis (compartido entre instancias).
- Las conexiones DB usan pool de conexiones (pg-pool).

---

## Escalabilidad del Servidor Edge (MediaMTX)

### MVP: Single MediaMTX Instance
Suficiente para 10 cámaras con recursos limitados.

### v1-v2: Múltiples Ubicaciones Remotas

```
Modelo Multi-Edge:
  Ubicación A (10 cámaras) → MediaMTX-A (100.a.a.a)
  Ubicación B (10 cámaras) → MediaMTX-B (100.b.b.b)
  Ubicación C (10 cámaras) → MediaMTX-C (100.c.c.c)
                                    │
                               Backend API (VPS)
                               • Enruta streams por ubicación
                               • Un "edge server" por cada ubicación
```

**Cambio en el modelo de datos:**
La tabla `cameras` ya tiene referencia a `edge_servers`. Agregar un nuevo servidor edge es una operación de configuración, no de rediseño.

### v2+: MediaMTX con Grabación

Si se activa la grabación en MediaMTX, el almacenamiento local del servidor remoto se convierte en un cuello de botella. Estrategias:

```
Opción 1: NAS local en la ubicación remota
  MediaMTX → monta NAS → escribe segmentos MP4

Opción 2: Object Storage en la nube
  MediaMTX → webhook → Backend → S3/MinIO
  (MediaMTX escribe localmente, backend sube a S3 periódicamente)

Opción 3: MinIO en VPS
  MediaMTX → S3 compatible (MinIO en VPS) via Tailscale
```

---

## Estrategia de Base de Datos

### MVP: PostgreSQL Single Instance
Suficiente para el volumen de datos del MVP (sin grabaciones).

### v1: Read Replicas
Si el número de lecturas (dashboards de muchos usuarios) supera la capacidad:
```
Primary PostgreSQL (escrituras)
    └── Read Replica 1 (lecturas: cámaras, layouts, usuarios)
```

### v2+: Particionamiento de Datos de Auditoría
La tabla `audit_logs` crecerá continuamente. Estrategia:
- Particionamiento por rango de fecha (mensual).
- Retención: 90 días en DB activa, archivado en S3.

---

## Estrategia de Caché

```
Nivel 1: Caché en memoria del proceso (TTL corto)
  • Estado de streams: en memoria del backend, 30s TTL
  • Configuración del sistema: en memoria, 5min TTL

Nivel 2: Redis (TTL medio)
  • Lista de cámaras con metadatos: 60s TTL
  • Token blacklist: hasta expiración del token
  • Rate limiting counters: 15min TTL

Nivel 3: CDN (para assets estáticos del frontend)
  • Next.js static files: caché larga en CDN
  • Solo aplica si se usa CDN en v1+
```

---

## KPIs de Escalabilidad

| Métrica | MVP Objetivo | Alerta | Acción |
|---------|-------------|--------|--------|
| CPU VPS promedio | < 40% | > 70% | Escalar vertical |
| Memoria VPS | < 60% | > 80% | Escalar vertical |
| Latencia API p95 | < 200ms | > 500ms | Investigar + optimizar |
| Latencia video e2e | < 2s | > 3s | Revisar MediaMTX config |
| Conexiones DB activas | < 20 | > 80 | Revisar pool + queries |
| Streams WebRTC activos | < 50 | > 80 | Escalar servidor edge |
| Redis memoria | < 100MB | > 500MB | Revisar TTLs |
