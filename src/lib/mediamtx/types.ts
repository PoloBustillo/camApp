/**
 * MediaMTX v3 REST API — TypeScript types
 * Docs: https://github.com/bluenviron/mediamtx#api
 */

// ─── Paths API ────────────────────────────────────────────────

export interface MediaMtxPathReader {
  type: string;
  id: number;
  remoteAddr: string;
  query: string;
  bytesReceived: number;
  bytesSent: number;
  tracks: string[];
}

export interface MediaMtxPathSource {
  type: string;
  id: number;
  remoteAddr: string;
  query: string;
  bytesReceived: number;
  bytesSent: number;
  tracks: string[];
}

export interface MediaMtxPath {
  name: string;
  confName: string;
  source: MediaMtxPathSource | null;
  ready: boolean;
  readyTime: string | null;
  tracks: string[];
  bytesReceived: number;
  bytesSent: number;
  readers: MediaMtxPathReader[];
}

export interface MediaMtxPathListResponse {
  itemCount: number;
  pageCount: number;
  items: MediaMtxPath[];
}

// ─── Client result types ──────────────────────────────────────

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  streamCount: number;
  error?: string;
}

export interface ConnectionValidation {
  reachable: boolean;
  latencyMs: number;
  apiVersion: string;
  error?: string;
}

export interface StreamStatus {
  name: string;
  ready: boolean;
  readyTime: string | null;
  tracks: string[];
  readerCount: number;
  bytesReceived: number;
  bytesSent: number;
}

// ─── Sync result ──────────────────────────────────────────────

export interface SyncResult {
  synced: number;
  online: number;
  offline: number;
  errors: string[];
  latencyMs: number;
}
