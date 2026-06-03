# 3.2 — Modelo Entidad-Relación

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## Diagrama ER Completo

```
┌───────────────────────────────────────────────────────────────────────────┐
│  users                                                                     │
├───────────────────────────────────────────────────────────────────────────┤
│  PK  id              UUID         NOT NULL  DEFAULT gen_random_uuid()      │
│      name            VARCHAR(255) NOT NULL                                 │
│      email           VARCHAR(255) NOT NULL  UNIQUE                         │
│      password_hash   VARCHAR(255) NOT NULL                                 │
│      role            user_role    NOT NULL  DEFAULT 'viewer'               │
│      status          user_status  NOT NULL  DEFAULT 'active'               │
│      failed_attempts SMALLINT    NOT NULL  DEFAULT 0                       │
│      locked_until    TIMESTAMPTZ NULL                                      │
│      last_login_at   TIMESTAMPTZ NULL                                      │
│      created_at      TIMESTAMPTZ NOT NULL  DEFAULT NOW()                   │
│      updated_at      TIMESTAMPTZ NOT NULL  DEFAULT NOW()                   │
│      deleted_at      TIMESTAMPTZ NULL      (soft delete)                   │
└───────────────────────────────────────────────────────────────────────────┘
            │ 1
            │ N
            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  layouts                                                                   │
├───────────────────────────────────────────────────────────────────────────┤
│  PK  id              UUID         NOT NULL  DEFAULT gen_random_uuid()      │
│  FK  owner_id        UUID         NOT NULL  → users(id)                    │
│      name            VARCHAR(255) NOT NULL                                 │
│      grid_type       grid_type    NOT NULL  DEFAULT 'quad'                 │
│      is_default      BOOLEAN     NOT NULL  DEFAULT false                   │
│      is_shared       BOOLEAN     NOT NULL  DEFAULT false                   │
│      created_at      TIMESTAMPTZ NOT NULL  DEFAULT NOW()                   │
│      updated_at      TIMESTAMPTZ NOT NULL  DEFAULT NOW()                   │
│      deleted_at      TIMESTAMPTZ NULL                                      │
└───────────────────────────────────────────────────────────────────────────┘
            │ 1
            │ N
            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  layout_cells                                                              │
├───────────────────────────────────────────────────────────────────────────┤
│  PK  id              UUID         NOT NULL  DEFAULT gen_random_uuid()      │
│  FK  layout_id       UUID         NOT NULL  → layouts(id)  ON DELETE CASCADE│
│  FK  camera_id       UUID         NULL      → cameras(id) ON DELETE SET NULL│
│      position        SMALLINT    NOT NULL  (0-based)                       │
│      label           VARCHAR(100) NULL                                     │
│  UNIQUE (layout_id, position)                                              │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│  edge_servers                                                              │
├───────────────────────────────────────────────────────────────────────────┤
│  PK  id              UUID         NOT NULL  DEFAULT gen_random_uuid()      │
│      name            VARCHAR(255) NOT NULL                                 │
│      tailscale_ip    VARCHAR(50)  NOT NULL  UNIQUE                         │
│      mediamtx_port   SMALLINT    NOT NULL  DEFAULT 9997                    │
│      webrtc_port     SMALLINT    NOT NULL  DEFAULT 8889                    │
│      public_host     VARCHAR(255) NOT NULL  (para URLs WebRTC del browser) │
│      status          edge_status  NOT NULL  DEFAULT 'unknown'              │
│      last_seen_at    TIMESTAMPTZ NULL                                      │
│      created_at      TIMESTAMPTZ NOT NULL  DEFAULT NOW()                   │
│      updated_at      TIMESTAMPTZ NOT NULL  DEFAULT NOW()                   │
└───────────────────────────────────────────────────────────────────────────┘
            │ 1              │ 1
            │ N              │ N
            ▼                ▼
┌────────────────────────┐  ┌──────────────────────────────────────────────┐
│  locations             │  │  cameras                                     │
├────────────────────────┤  ├──────────────────────────────────────────────┤
│  PK id   UUID  NOT NULL│  │  PK  id             UUID        NOT NULL     │
│  FK edge_server_id UUID│  │  FK  edge_server_id UUID        NOT NULL     │
│     → edge_servers(id) │  │       → edge_servers(id)                    │
│     name VARCHAR(255)  │  │  FK  location_id    UUID        NULL         │
│     description TEXT   │  │       → locations(id)                       │
│     created_at TSTZ    │  │       name          VARCHAR(255) NOT NULL    │
│     updated_at TSTZ    │  │       slug          VARCHAR(100) NOT NULL UNIQUE│
│     deleted_at TSTZ    │  │       description   TEXT        NULL         │
└────────────────────────┘  │       rtsp_url      TEXT        NOT NULL     │
                             │        (cifrado AES-256-GCM)                │
                             │       resolution    VARCHAR(20) NULL         │
                             │       codec         camera_codec NOT NULL   │
                             │        DEFAULT 'unknown'                     │
                             │       status        camera_status NOT NULL  │
                             │        DEFAULT 'unknown'                     │
                             │       last_status_at TIMESTAMPTZ NULL       │
                             │       created_at    TIMESTAMPTZ NOT NULL    │
                             │       updated_at    TIMESTAMPTZ NOT NULL    │
                             │       deleted_at    TIMESTAMPTZ NULL        │
                             └──────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│  refresh_tokens                                                            │
├───────────────────────────────────────────────────────────────────────────┤
│  PK  id              UUID         NOT NULL  DEFAULT gen_random_uuid()      │
│  FK  user_id         UUID         NOT NULL  → users(id) ON DELETE CASCADE  │
│      jti             UUID         NOT NULL  UNIQUE (JWT ID)                │
│      expires_at      TIMESTAMPTZ NOT NULL                                  │
│      revoked_at      TIMESTAMPTZ NULL       (null = activo)                │
│      user_agent      TEXT         NULL                                     │
│      ip_address      VARCHAR(50)  NULL                                     │
│      created_at      TIMESTAMPTZ NOT NULL  DEFAULT NOW()                   │
│  INDEX (user_id, jti)                                                      │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│  audit_logs                             (particionada por mes)             │
├───────────────────────────────────────────────────────────────────────────┤
│  PK  id              UUID         NOT NULL  DEFAULT gen_random_uuid()      │
│  FK  user_id         UUID         NULL      → users(id) (null=sistema)     │
│      action          audit_action NOT NULL                                 │
│      resource_type   VARCHAR(50)  NULL                                     │
│      resource_id     UUID         NULL                                     │
│      metadata        JSONB        NULL      (datos adicionales del evento) │
│      ip_address      VARCHAR(50)  NULL                                     │
│      created_at      TIMESTAMPTZ NOT NULL  DEFAULT NOW()                   │
│  INDEX (user_id, created_at)                                               │
│  INDEX (action, created_at)                                                │
│  INDEX (resource_type, resource_id)                                        │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│  stream_events                                                             │
├───────────────────────────────────────────────────────────────────────────┤
│  PK  id              UUID         NOT NULL  DEFAULT gen_random_uuid()      │
│  FK  camera_id       UUID         NOT NULL  → cameras(id)                  │
│      event_type      stream_event NOT NULL  (online/offline/error)         │
│      message         TEXT         NULL                                     │
│      created_at      TIMESTAMPTZ NOT NULL  DEFAULT NOW()                   │
│  INDEX (camera_id, created_at DESC)                                        │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Tipos Enumerados (ENUM)

```sql
CREATE TYPE user_role   AS ENUM ('admin', 'operator', 'viewer');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'locked');
CREATE TYPE grid_type   AS ENUM ('single', 'quad', 'hexa', 'nine');
CREATE TYPE edge_status AS ENUM ('online', 'offline', 'unknown');
CREATE TYPE camera_status AS ENUM ('online', 'offline', 'unknown', 'error');
CREATE TYPE camera_codec AS ENUM ('h264', 'h265', 'unknown');
CREATE TYPE stream_event AS ENUM ('online', 'offline', 'error', 'reconnecting');
CREATE TYPE audit_action AS ENUM (
  'user_login', 'user_logout', 'user_created', 'user_updated', 'user_deleted',
  'camera_created', 'camera_updated', 'camera_deleted', 'camera_viewed',
  'layout_created', 'layout_updated', 'layout_deleted',
  'location_created', 'location_updated', 'location_deleted',
  'stream_access', 'auth_failure', 'system_event'
);
```

---

## Cardinalidades

| Relación | Cardinalidad |
|----------|-------------|
| User → Layouts | 1:N (un usuario puede tener muchos layouts) |
| Layout → LayoutCells | 1:N (un layout tiene N celdas según grid_type) |
| LayoutCell → Camera | N:1 opcional (muchas celdas pueden apuntar a la misma cámara) |
| EdgeServer → Locations | 1:N (un servidor edge puede tener muchas ubicaciones) |
| EdgeServer → Cameras | 1:N (un servidor edge gestiona muchas cámaras) |
| Location → Cameras | 1:N (una ubicación contiene muchas cámaras) |
| User → RefreshTokens | 1:N (un usuario puede tener múltiples sesiones) |
| Camera → StreamEvents | 1:N (historial de eventos de un stream) |
| User → AuditLogs | 1:N (historial de acciones de un usuario) |
