# 3.6 — DTOs (Data Transfer Objects)

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

> Los DTOs definen los contratos de datos entre las capas del sistema. Se especifican en TypeScript-like notation para claridad.

---

## DTOs de Autenticación

### LoginRequestDTO
```typescript
{
  email: string;       // email válido, max 255 chars
  password: string;    // min 8 chars, max 128 chars
}
```

### LoginResponseDTO
```typescript
{
  accessToken: string;   // JWT HS256
  user: {
    id: string;          // UUID
    name: string;
    email: string;
    role: 'admin' | 'operator' | 'viewer';
  };
}
```

### RefreshResponseDTO
```typescript
{
  accessToken: string;   // JWT HS256 nuevo
}
```

### MeResponseDTO
```typescript
{
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  status: 'active' | 'inactive' | 'locked';
  lastLoginAt: string | null;  // ISO 8601
}
```

---

## DTOs de Cámaras

### CameraCreateDTO (request)
```typescript
{
  name: string;           // min 1, max 255 chars
  slug: string;           // min 2, max 100 chars, only [a-z0-9-_]
  description?: string;   // max 1000 chars
  rtspUrl: string;        // debe ser URL válida con protocolo rtsp:// o rtsps://
  resolution?: string;    // formato "WxH", ej: "1920x1080"
  codec?: 'h264' | 'h265' | 'unknown';  // default: 'unknown'
  locationId?: string;    // UUID
  edgeServerId: string;   // UUID, requerido
}
```

### CameraUpdateDTO (request PATCH)
```typescript
{
  name?: string;
  description?: string;
  rtspUrl?: string;       // Si cambia, reinicia el stream en MediaMTX
  resolution?: string;
  codec?: 'h264' | 'h265' | 'unknown';
  locationId?: string | null;  // null = sin ubicación
}
```

### CameraResponseDTO
```typescript
{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'online' | 'offline' | 'unknown' | 'error';
  codec: 'h264' | 'h265' | 'unknown';
  resolution: string | null;
  lastStatusAt: string | null;
  location: {
    id: string;
    name: string;
  } | null;
  edgeServer: {
    id: string;
    name: string;
    publicHost: string;
  };
  createdAt: string;
  updatedAt: string;
  // NUNCA incluir: rtspUrlEncrypted, credenciales
}
```

### StreamTokenResponseDTO
```typescript
{
  streamToken: string;   // JWT temporal, exp: 30s
  whepUrl: string;       // URL completa para negociación WHEP
  expiresIn: number;     // segundos hasta expiración (30)
}
```

### CameraListResponseDTO
```typescript
{
  data: CameraResponseDTO[];
  pagination: PaginationDTO;
}
```

---

## DTOs de Layouts

### LayoutCellDTO (shared)
```typescript
{
  position: number;       // 0-based, 0-8 según grid_type
  cameraId: string | null;  // UUID de cámara o null (celda vacía)
  cameraName: string | null;  // solo en responses
  label: string | null;      // etiqueta personalizada
}
```

### LayoutCreateDTO (request)
```typescript
{
  name: string;           // min 1, max 255 chars
  gridType: 'single' | 'quad' | 'hexa' | 'nine';
  isDefault?: boolean;    // default: false
  isShared?: boolean;     // default: false
  cells: Array<{
    position: number;
    cameraId?: string | null;
    label?: string | null;
  }>;
}
```

### LayoutUpdateDTO (request PATCH)
```typescript
{
  name?: string;
  isDefault?: boolean;
  isShared?: boolean;
  cells?: Array<{
    position: number;
    cameraId?: string | null;
    label?: string | null;
  }>;
}
```

### LayoutResponseDTO
```typescript
{
  id: string;
  name: string;
  gridType: 'single' | 'quad' | 'hexa' | 'nine';
  isDefault: boolean;
  isShared: boolean;
  owner: {
    id: string;
    name: string;
  };
  cells: LayoutCellDTO[];
  createdAt: string;
  updatedAt: string;
}
```

---

## DTOs de Ubicaciones

### LocationCreateDTO (request)
```typescript
{
  name: string;             // min 1, max 255 chars
  description?: string;     // max 1000 chars
  edgeServerId: string;     // UUID, requerido
}
```

### LocationResponseDTO
```typescript
{
  id: string;
  name: string;
  description: string | null;
  edgeServer: {
    id: string;
    name: string;
  };
  cameraCount: number;
  createdAt: string;
  updatedAt: string;
}
```

---

## DTOs de Usuarios

### UserCreateDTO (request)
```typescript
{
  name: string;             // min 2, max 255 chars
  email: string;            // email válido
  password: string;         // min 8 chars, debe incluir mayúsc, minúsc, número
  role: 'admin' | 'operator' | 'viewer';
}
```

### UserUpdateDTO (request PATCH)
```typescript
{
  name?: string;
  role?: 'admin' | 'operator' | 'viewer';  // solo Admin puede cambiar rol
  status?: 'active' | 'inactive';           // solo Admin puede cambiar status
  password?: string;                         // propio usuario o Admin
}
```

### UserResponseDTO
```typescript
{
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  status: 'active' | 'inactive' | 'locked';
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  // NUNCA incluir: passwordHash
}
```

---

## DTOs Compartidos

### PaginationDTO
```typescript
{
  page: number;       // página actual (1-based)
  limit: number;      // elementos por página
  total: number;      // total de elementos
  totalPages: number;
}
```

### ErrorResponseDTO
```typescript
{
  error: {
    code: string;       // ej: "CAMERA_NOT_FOUND", "VALIDATION_ERROR"
    message: string;    // mensaje legible para el desarrollador
    details?: Array<{   // solo en errores de validación
      field: string;    // campo con error
      message: string;
    }>;
    requestId: string;  // para correlación en logs
  }
}
```

### SystemStatsDTO
```typescript
{
  cameras: {
    total: number;
    online: number;
    offline: number;
    unknown: number;
    error: number;
  };
  users: {
    total: number;
    active: number;
  };
  activeSessions: number;
  mediamtx: {
    connected: boolean;
    activeStreams: number;
    webrtcSessions: number;
  };
}
```

---

## Reglas de Validación Globales

| Campo | Regla |
|-------|-------|
| UUID | Formato RFC4122 válido |
| Email | RFC5321, max 255 chars, lowercase |
| Password (request) | Min 8 chars, max 128, al menos 1 mayúsc + 1 minúsc + 1 número |
| Slug | Solo `[a-z0-9_-]`, min 2, max 100 |
| Página | Integer ≥ 1 |
| Limit | Integer 1-100 |
| RTSP URL | `^rtsp[s]?://` |
| Fechas | ISO 8601 en UTC |
