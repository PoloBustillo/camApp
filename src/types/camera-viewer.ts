/** Camera item as returned by GET /api/cameras for the viewer */
export interface CameraViewerItem {
  id: string;
  name: string;
  siteName: string;
  edgeServerId: string | null;
  /** Main stream path in MediaMTX (e.g., "cam1", "entrance") */
  streamName: string | null;
  /** Sub-resolution stream path (e.g., "cam1_sub"). Used in grid mosaic. */
  substreamName: string | null;
  enabled: boolean;
  online: boolean;
  protocol: string;
  isFavorite?: boolean;
}

export type StreamType = "main" | "sub";
export type PlayerState = "idle" | "connecting" | "playing" | "error" | "offline" | "reconnecting";

/** Color filter values persisted per camera in the database */
export interface PersistedFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  preset: string;
}

export const DEFAULT_PERSISTED_FILTERS: PersistedFilters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  preset: "normal",
};

export const PRESET_LABELS: Record<string, string> = {
  normal: "Normal",
  night: "Noche",
  "ultra-night": "Ultra noche",
  "night-vision": "Visión nocturna",
  "high-contrast": "Alto contraste",
  grayscale: "B/N",
  vivid: "Vívido",
  warm: "Cálido",
  cool: "Frío",
  invert: "Invertir",
};

export interface WebRtcStreamInfo {
  /** Full WHEP URL built server-side (never exposes internal IPs) */
  whepUrl: string;
  /** WebSocket URL for go2rtc signaling (ws://host:port/api/ws?src=stream) */
  wsUrl: string;
  /** Short-lived JWT for WHEP Authorization header */
  streamToken: string;
  streamType: StreamType;
  expiresIn: number;
  /** Camera was offline when URL was resolved — client should enter polling retry */
  isOffline?: boolean;
}

export interface CameraPageState {
  page: number;
  totalPages: number;
  cameras: CameraViewerItem[];
}
