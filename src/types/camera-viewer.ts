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

export interface WebRtcStreamInfo {
  /** Full WHEP URL built server-side (never exposes internal IPs) */
  whepUrl: string;
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
