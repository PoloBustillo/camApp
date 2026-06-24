// Tipos de dominio para CamWatch Platform
// Alineados con el schema Prisma y los DTOs aprobados

export type UserRole = "admin" | "operator" | "viewer";
export type UserStatus = "active" | "inactive" | "locked";
export type GridType = "single" | "quad" | "hexa" | "nine";
export type EdgeStatus = "online" | "offline" | "unknown";
export type CameraStatus = "online" | "offline" | "unknown" | "error";
export type CameraCodec = "h264" | "h265" | "unknown";
export type StreamEventType = "online" | "offline" | "error" | "reconnecting";

// ─── Auth ───────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

// ─── Cameras ────────────────────────────────────────────

export interface Camera {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  resolution: string | null;
  codec: CameraCodec;
  status: CameraStatus;
  lastStatusAt: string | null;
  locationId: string | null;
  edgeServerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCameraRequest {
  name: string;
  slug: string;
  description?: string;
  rtspUrl: string;
  resolution?: string;
  codec?: CameraCodec;
  locationId?: string;
  edgeServerId: string;
}

export interface UpdateCameraRequest {
  name?: string;
  description?: string;
  rtspUrl?: string;
  resolution?: string;
  codec?: CameraCodec;
  locationId?: string | null;
}

export interface StreamTokenResponse {
  streamToken: string;
  whepUrl: string;
  expiresIn: number;
}

// ─── Layouts ────────────────────────────────────────────

export interface LayoutCell {
  id: string;
  position: number;
  label: string | null;
  camera: Camera | null;
}

export interface Layout {
  id: string;
  name: string;
  gridType: GridType;
  isDefault: boolean;
  isShared: boolean;
  cells: LayoutCell[];
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLayoutRequest {
  name: string;
  gridType: GridType;
  isDefault?: boolean;
  isShared?: boolean;
}

export interface UpdateLayoutRequest {
  name?: string;
  gridType?: GridType;
  isDefault?: boolean;
  isShared?: boolean;
  cells?: { position: number; cameraId: string | null; label?: string }[];
}

// ─── Users ──────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
}

// ─── Recordings ─────────────────────────────────────────

export interface Recording {
  id: string;
  cameraId: string;
  date: string;
  fileName: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  fileSize: number | null;
  thumbnail: string | null;
  cameraName?: string;
  cloudStorageKey: string | null;
  cloudBackupAt: string | null;
  cloudBackupStatus: string;
}

// ─── Edge Servers ────────────────────────────────────────

export interface EdgeServer {
  id: string;
  name: string;
  tailscaleIp: string;
  serverType: "mediaMtx" | "go2rtc";
  mediamtxApiPort: number;
  webrtcPort: number;
  go2rtcApiPort: number;
  go2rtcWebRtcPort: number;
  publicHost: string;
  status: EdgeStatus;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── API Responses ───────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
