/**
 * go2rtc REST API — TypeScript types
 * Docs: https://github.com/AlexxIT/go2rtc
 */

// ─── Streams API ──────────────────────────────────────────────

export interface Go2RtcProducer {
  url: string;
}

export interface Go2RtcStream {
  producers: Go2RtcProducer[] | null;
  consumers: unknown[] | null;
}

export type Go2RtcStreamsResponse = Record<string, Go2RtcStream>;

// ─── Shared result types (compatible with MediaMTX types) ──────

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

export interface SyncResult {
  synced: number;
  online: number;
  offline: number;
  errors: string[];
  latencyMs: number;
}
