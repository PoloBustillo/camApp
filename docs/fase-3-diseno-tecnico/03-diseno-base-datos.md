# 3.3 — Diseño de Base de Datos

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## Decisiones de Diseño

| Decisión | Razón |
|----------|-------|
| PostgreSQL 16 | ACID, JSONB, particionamiento, row-level security, excelente ecosistema |
| UUIDs como PKs | Evita inferencia de orden/cantidad, seguro para IDs expuestos en URLs |
| Soft delete (deleted_at) | Preserva integridad referencial y permite auditoría; no elimina datos físicamente |
| JSONB para metadata de auditoría | Flexibilidad para almacenar datos heterogéneos sin esquema rígido |
| Particionamiento de audit_logs | La tabla crecerá indefinidamente; particionar por mes permite purgar particiones viejas |
| Cifrado a nivel de aplicación (no DB) | Las credenciales RTSP se cifran en el backend antes de escribir; más control sobre qué se cifra |

---

## DDL Completo

```sql
-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- índices para búsqueda de texto

-- ─────────────────────────────────────────────────────────────
-- TIPOS ENUMERADOS
-- ─────────────────────────────────────────────────────────────

CREATE TYPE user_role     AS ENUM ('admin', 'operator', 'viewer');
CREATE TYPE user_status   AS ENUM ('active', 'inactive', 'locked');
CREATE TYPE grid_type     AS ENUM ('single', 'quad', 'hexa', 'nine');
CREATE TYPE edge_status   AS ENUM ('online', 'offline', 'unknown');
CREATE TYPE camera_status AS ENUM ('online', 'offline', 'unknown', 'error');
CREATE TYPE camera_codec  AS ENUM ('h264', 'h265', 'unknown');
CREATE TYPE stream_event_type AS ENUM ('online', 'offline', 'error', 'reconnecting');
CREATE TYPE audit_action  AS ENUM (
  'user_login', 'user_logout', 'user_created', 'user_updated', 'user_deleted',
  'camera_created', 'camera_updated', 'camera_deleted', 'camera_viewed',
  'layout_created', 'layout_updated', 'layout_deleted',
  'location_created', 'location_updated', 'location_deleted',
  'stream_access', 'auth_failure', 'system_event'
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: users
-- ─────────────────────────────────────────────────────────────

CREATE TABLE users (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  email            VARCHAR(255) NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  role             user_role   NOT NULL DEFAULT 'viewer',
  status           user_status NOT NULL DEFAULT 'active',
  failed_attempts  SMALLINT    NOT NULL DEFAULT 0,
  locked_until     TIMESTAMPTZ NULL,
  last_login_at    TIMESTAMPTZ NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ NULL,

  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_email_unique UNIQUE (email)
    WHERE (deleted_at IS NULL)  -- unique solo en registros activos
);

CREATE INDEX idx_users_email ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users (role) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- TABLA: edge_servers
-- ─────────────────────────────────────────────────────────────

CREATE TABLE edge_servers (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  tailscale_ip     VARCHAR(50)  NOT NULL,
  mediamtx_api_port SMALLINT   NOT NULL DEFAULT 9997,
  webrtc_port      SMALLINT    NOT NULL DEFAULT 8889,
  public_host      VARCHAR(255) NOT NULL,  -- hostname para URLs WebRTC
  status           edge_status NOT NULL DEFAULT 'unknown',
  last_seen_at     TIMESTAMPTZ NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT edge_servers_pkey PRIMARY KEY (id),
  CONSTRAINT edge_servers_tailscale_ip_unique UNIQUE (tailscale_ip)
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: locations
-- ─────────────────────────────────────────────────────────────

CREATE TABLE locations (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  edge_server_id   UUID        NOT NULL,
  name             VARCHAR(255) NOT NULL,
  description      TEXT        NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ NULL,

  CONSTRAINT locations_pkey PRIMARY KEY (id),
  CONSTRAINT locations_edge_server_fkey
    FOREIGN KEY (edge_server_id) REFERENCES edge_servers(id)
);

CREATE INDEX idx_locations_edge_server ON locations (edge_server_id);

-- ─────────────────────────────────────────────────────────────
-- TABLA: cameras
-- ─────────────────────────────────────────────────────────────

CREATE TABLE cameras (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  edge_server_id   UUID        NOT NULL,
  location_id      UUID        NULL,
  name             VARCHAR(255) NOT NULL,
  slug             VARCHAR(100) NOT NULL,  -- nombre del path en MediaMTX
  description      TEXT        NULL,
  -- rtsp_url almacena la URL completa incluyendo credenciales, cifrada AES-256-GCM
  -- Formato almacenado: base64(iv):base64(ciphertext):base64(authTag)
  rtsp_url_encrypted  TEXT    NOT NULL,
  resolution       VARCHAR(20) NULL,   -- ej: "1920x1080"
  codec            camera_codec NOT NULL DEFAULT 'unknown',
  status           camera_status NOT NULL DEFAULT 'unknown',
  last_status_at   TIMESTAMPTZ NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ NULL,

  CONSTRAINT cameras_pkey PRIMARY KEY (id),
  CONSTRAINT cameras_slug_unique UNIQUE (slug) WHERE deleted_at IS NULL,
  CONSTRAINT cameras_edge_server_fkey
    FOREIGN KEY (edge_server_id) REFERENCES edge_servers(id),
  CONSTRAINT cameras_location_fkey
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
);

CREATE INDEX idx_cameras_edge_server ON cameras (edge_server_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cameras_location ON cameras (location_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cameras_status ON cameras (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_cameras_slug ON cameras (slug) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- TABLA: layouts
-- ─────────────────────────────────────────────────────────────

CREATE TABLE layouts (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  owner_id         UUID        NOT NULL,
  name             VARCHAR(255) NOT NULL,
  grid_type        grid_type   NOT NULL DEFAULT 'quad',
  is_default       BOOLEAN     NOT NULL DEFAULT false,
  is_shared        BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ NULL,

  CONSTRAINT layouts_pkey PRIMARY KEY (id),
  CONSTRAINT layouts_owner_fkey
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Solo un layout default por usuario
CREATE UNIQUE INDEX idx_layouts_one_default_per_user
  ON layouts (owner_id)
  WHERE is_default = true AND deleted_at IS NULL;

CREATE INDEX idx_layouts_owner ON layouts (owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_layouts_shared ON layouts (is_shared) WHERE deleted_at IS NULL AND is_shared = true;

-- ─────────────────────────────────────────────────────────────
-- TABLA: layout_cells
-- ─────────────────────────────────────────────────────────────

CREATE TABLE layout_cells (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  layout_id        UUID        NOT NULL,
  camera_id        UUID        NULL,
  position         SMALLINT    NOT NULL,  -- 0-based
  label            VARCHAR(100) NULL,

  CONSTRAINT layout_cells_pkey PRIMARY KEY (id),
  CONSTRAINT layout_cells_layout_fkey
    FOREIGN KEY (layout_id) REFERENCES layouts(id) ON DELETE CASCADE,
  CONSTRAINT layout_cells_camera_fkey
    FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE SET NULL,
  CONSTRAINT layout_cells_position_unique UNIQUE (layout_id, position)
);

CREATE INDEX idx_layout_cells_layout ON layout_cells (layout_id);
CREATE INDEX idx_layout_cells_camera ON layout_cells (camera_id) WHERE camera_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- TABLA: refresh_tokens
-- ─────────────────────────────────────────────────────────────

CREATE TABLE refresh_tokens (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL,
  jti              UUID        NOT NULL,  -- JWT ID (claim "jti")
  expires_at       TIMESTAMPTZ NOT NULL,
  revoked_at       TIMESTAMPTZ NULL,
  user_agent       TEXT        NULL,
  ip_address       VARCHAR(50) NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT refresh_tokens_jti_unique UNIQUE (jti),
  CONSTRAINT refresh_tokens_user_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_jti ON refresh_tokens (jti);
-- Limpiar tokens expirados periódicamente
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens (expires_at);

-- ─────────────────────────────────────────────────────────────
-- TABLA: stream_events
-- ─────────────────────────────────────────────────────────────

CREATE TABLE stream_events (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  camera_id        UUID        NOT NULL,
  event_type       stream_event_type NOT NULL,
  message          TEXT        NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT stream_events_pkey PRIMARY KEY (id),
  CONSTRAINT stream_events_camera_fkey
    FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE CASCADE
);

CREATE INDEX idx_stream_events_camera ON stream_events (camera_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- TABLA: audit_logs (particionada por rango mensual)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE audit_logs (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  user_id          UUID        NULL,
  action           audit_action NOT NULL,
  resource_type    VARCHAR(50)  NULL,
  resource_id      UUID        NULL,
  metadata         JSONB       NULL,
  ip_address       VARCHAR(50)  NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Crear particiones iniciales (se crean mensualmente via cron)
CREATE TABLE audit_logs_2026_06 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE audit_logs_2026_07 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE INDEX idx_audit_logs_user ON audit_logs (user_id, created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs (action, created_at);
CREATE INDEX idx_audit_logs_resource ON audit_logs (resource_type, resource_id);
```

---

## Índices y Estrategia de Consultas

| Tabla | Consulta frecuente | Índice |
|-------|-------------------|--------|
| users | Buscar por email (login) | `idx_users_email` |
| cameras | Listar cámaras activas por location | `idx_cameras_location` |
| cameras | Buscar por slug (MediaMTX path) | `idx_cameras_slug` |
| layouts | Layouts del usuario | `idx_layouts_owner` |
| refresh_tokens | Verificar token por JTI | `idx_refresh_tokens_jti` |
| stream_events | Últimos N eventos de una cámara | `idx_stream_events_camera` |
| audit_logs | Logs de un usuario en rango de fechas | `idx_audit_logs_user` |

---

## Estrategia de Mantenimiento

### Limpieza de Tokens Expirados
```sql
-- Ejecutar periódicamente (cron job, cada hora)
DELETE FROM refresh_tokens 
WHERE expires_at < NOW() - INTERVAL '1 day';
```

### Rotación de Particiones de Audit Logs
```sql
-- Ejecutar el primer día de cada mes (cron job)
-- Crear la partición del mes siguiente
-- Opcional: DROP TABLE de particiones > 3 meses
```

### Backups
- Frecuencia: Diaria (pg_dump)
- Retención: 7 copias diarias, 4 semanales
- Almacenamiento: Cifrado con GPG antes de transferir al destino
- Destino: S3 o servidor de backup independiente
- Prueba de restauración: Mensual (verificar que el backup es válido)
