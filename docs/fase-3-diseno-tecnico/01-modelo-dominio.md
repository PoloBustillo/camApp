# 3.1 — Modelo de Dominio

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## Diagrama del Modelo de Dominio

```
                    ┌───────────────────────────────────────────┐
                    │              DOMINIO: Identidad            │
                    │                                           │
                    │  ┌─────────────────────────────────────┐  │
                    │  │           User (Agregado)           │  │
                    │  │                                     │  │
                    │  │  - id: UUID                         │  │
                    │  │  - name: string                     │  │
                    │  │  - email: string (único)            │  │
                    │  │  - passwordHash: string             │  │
                    │  │  - role: UserRole                   │  │
                    │  │  - status: UserStatus               │  │
                    │  │  - createdAt: DateTime              │  │
                    │  │  - lastLoginAt: DateTime?           │  │
                    │  └─────────────────────────────────────┘  │
                    │                                           │
                    │  UserRole: ADMIN | OPERATOR | VIEWER      │
                    │  UserStatus: ACTIVE | INACTIVE | LOCKED   │
                    └───────────────────────────────────────────┘

┌──────────────────────────────┐     ┌──────────────────────────────────────┐
│   DOMINIO: Infraestructura   │     │   DOMINIO: Streams                   │
│                              │     │                                      │
│  ┌────────────────────────┐  │     │  ┌──────────────────────────────┐   │
│  │  EdgeServer (Entidad)  │  │     │  │    Camera (Agregado)         │   │
│  │                        │  │     │  │                              │   │
│  │  - id: UUID            │  │     │  │  - id: UUID                 │   │
│  │  - name: string        │  │     │  │  - name: string             │   │
│  │  - tailscaleIp: string │  │     │  │  - slug: string (único)     │   │
│  │  - mediaMtxPort: int   │  │     │  │  - rtspUrl: EncryptedString │   │
│  │  - status: EdgeStatus  │  │     │  │  - rtspUsername: Encrypted  │   │
│  │  - lastSeenAt: DateTime│  │     │  │  - rtspPassword: Encrypted  │   │
│  └──────────┬─────────────┘  │     │  │  - resolution: string?      │   │
│             │ 1               │     │  │  - codec: Codec             │   │
│             │ N               │     │  │  - status: CameraStatus     │   │
│  ┌──────────▼─────────────┐  │     │  │  - edgeServerId: UUID (FK)  │   │
│  │   Location (Entidad)   │◄─┼─────┼──│  - locationId: UUID? (FK)  │   │
│  │                        │  │     │  │  - createdAt: DateTime      │   │
│  │  - id: UUID            │  │     │  │  - updatedAt: DateTime      │   │
│  │  - name: string        │  │     │  └────────────────────────────┘   │
│  │  - description: string │  │     │                                      │
│  │  - edgeServerId: UUID  │  │     │  CameraStatus:                      │
│  │  - createdAt: DateTime │  │     │    ONLINE | OFFLINE |                │
│  └────────────────────────┘  │     │    UNKNOWN | ERROR                   │
└──────────────────────────────┘     │                                      │
                                      │  Codec: H264 | H265 | UNKNOWN        │
                                      └──────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                        DOMINIO: Visualización                              │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                     Layout (Agregado)                                │ │
│  │                                                                      │ │
│  │  - id: UUID                                                          │ │
│  │  - name: string                                                      │ │
│  │  - gridType: GridType       (1x1, 2x2, 2x3, 3x3)                    │ │
│  │  - isDefault: boolean                                                │ │
│  │  - isShared: boolean                                                 │ │
│  │  - ownerId: UUID (FK → User)                                         │ │
│  │  - cells: LayoutCell[]     (value object embebido)                   │ │
│  │  - createdAt: DateTime                                               │ │
│  │  - updatedAt: DateTime                                               │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  LayoutCell (Value Object):                                                │
│  - position: int          (0-based, orden en la grilla)                   │
│  - cameraId: UUID? (FK → Camera)   (null = celda vacía)                   │
│  - label: string?         (etiqueta personalizada)                        │
│                                                                            │
│  GridType: SINGLE | QUAD | HEXA | NINE                                     │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                        DOMINIO: Auditoría                                  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                    AuditLog (Entidad de solo escritura)              │ │
│  │                                                                      │ │
│  │  - id: UUID                                                          │ │
│  │  - userId: UUID? (null si es acción del sistema)                     │ │
│  │  - action: AuditAction                                               │ │
│  │  - resourceType: string   ("camera", "user", "layout", etc.)         │ │
│  │  - resourceId: UUID?                                                 │ │
│  │  - metadata: JSON         (datos relevantes del evento)              │ │
│  │  - ipAddress: string?                                                │ │
│  │  - createdAt: DateTime    (partición por mes)                        │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  AuditAction:                                                              │
│    USER_LOGIN | USER_LOGOUT | USER_CREATED | USER_UPDATED | USER_DELETED  │
│    CAMERA_CREATED | CAMERA_UPDATED | CAMERA_DELETED | CAMERA_VIEWED       │
│    LAYOUT_CREATED | LAYOUT_UPDATED | LAYOUT_DELETED                       │
│    LOCATION_CREATED | LOCATION_UPDATED | LOCATION_DELETED                 │
│    STREAM_ACCESS | AUTH_FAILURE | SYSTEM_EVENT                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Reglas de Negocio del Dominio

### Reglas de Camera
1. Una cámara debe estar asociada a un EdgeServer (servidor MediaMTX).
2. El `slug` de la cámara debe ser único globalmente (se usa como nombre del path en MediaMTX).
3. Las credenciales RTSP (`rtspUsername`, `rtspPassword`) deben estar cifradas en reposo.
4. Una cámara no puede eliminarse si está referenciada en un layout activo (soft delete).
5. El estado de la cámara refleja el último estado conocido de MediaMTX, no el estado en tiempo real.

### Reglas de Layout
1. Un layout pertenece a un usuario (owner).
2. Los layouts `isShared=true` pueden ser vistos por todos los usuarios.
3. Solo el owner o un Admin puede modificar o eliminar un layout.
4. Un layout `isDefault` se muestra automáticamente al ingresar al dashboard.
5. Solo puede haber un layout `isDefault` por usuario.
6. Un `GridType` define el número máximo de celdas: SINGLE=1, QUAD=4, HEXA=6, NINE=9.
7. Las celdas vacías (cameraId=null) son válidas.

### Reglas de User
1. No puede existir más de un usuario con el mismo email.
2. Siempre debe existir al menos un usuario con rol ADMIN.
3. Un usuario INACTIVE no puede autenticarse.
4. Un usuario LOCKED no puede autenticarse (desbloqueo manual por Admin).

### Reglas de EdgeServer
1. La URL de la API de MediaMTX (`tailscaleIp:mediaMtxPort`) debe ser alcanzable desde el backend.
2. Un EdgeServer puede tener múltiples Locations y Cameras.

---

## Invariantes del Dominio

| Invariante | Descripción |
|-----------|-------------|
| INV-001 | Todo acceso a un stream requiere un User autenticado con rol válido |
| INV-002 | Las credenciales de cámara nunca se devuelven en respuestas API |
| INV-003 | Cada operación de escritura genera un registro en AuditLog |
| INV-004 | Un Layout no puede tener más celdas que las definidas por su GridType |
| INV-005 | No puede eliminarse el último Admin del sistema |
