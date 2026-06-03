import type {
  HealthCheckResult,
  ConnectionValidation,
  MediaMtxPath,
  MediaMtxPathListResponse,
  StreamStatus,
} from "./types";

export interface MediaMtxClientConfig {
  tailscaleIp: string;
  apiPort?: number;
  /** Request timeout in ms (default: 5000) */
  timeout?: number;
}

/**
 * HTTP client for the MediaMTX v3 REST API.
 * Communicates with a MediaMTX instance over Tailscale or local network.
 */
export class MediaMtxClient {
  readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: MediaMtxClientConfig) {
    const port = config.apiPort ?? 9997;
    this.baseUrl = `http://${config.tailscaleIp}:${port}`;
    this.timeout = config.timeout ?? 5000;
  }

  /** Create a client from an EdgeServer record */
  static fromEdgeServer(server: {
    tailscaleIp: string;
    mediamtxApiPort: number;
  }): MediaMtxClient {
    return new MediaMtxClient({
      tailscaleIp: server.tailscaleIp,
      apiPort: server.mediamtxApiPort,
    });
  }

  // ─── Internal fetch helper ──────────────────────────────────

  private async fetchWithTimeout(
    path: string,
  ): Promise<{ data: unknown; latencyMs: number }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    const start = Date.now();

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      return { data, latencyMs };
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Public methods ─────────────────────────────────────────

  /**
   * Quick health probe.
   * Returns healthy=true if MediaMTX responds to the paths list endpoint.
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const { data, latencyMs } = await this.fetchWithTimeout(
        "/v3/paths/list",
      );
      const list = data as MediaMtxPathListResponse;
      return {
        healthy: true,
        latencyMs,
        streamCount: list.itemCount ?? list.items?.length ?? 0,
      };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: this.timeout,
        streamCount: 0,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  /**
   * Validates connectivity and returns API version info.
   * Uses the global config endpoint which requires no stream data.
   */
  async validateConnection(): Promise<ConnectionValidation> {
    try {
      const { data, latencyMs } = await this.fetchWithTimeout(
        "/v3/config/global/get",
      );
      return {
        reachable: true,
        latencyMs,
        apiVersion: "v3",
        // MediaMTX config response doesn't expose a version field,
        // but a successful response confirms v3 API is available.
      };
    } catch (err) {
      // Fall back to paths list as an alternative probe
      try {
        const { latencyMs } = await this.fetchWithTimeout("/v3/paths/list");
        return { reachable: true, latencyMs, apiVersion: "v3" };
      } catch (fallbackErr) {
        return {
          reachable: false,
          latencyMs: this.timeout,
          apiVersion: "unknown",
          error:
            err instanceof Error ? err.message : "Connection refused",
        };
      }
    }
  }

  /**
   * Lists all active streams/paths from MediaMTX.
   * Returns simplified StreamStatus objects (never raw API types).
   */
  async listStreams(): Promise<StreamStatus[]> {
    const { data } = await this.fetchWithTimeout("/v3/paths/list");
    const list = data as MediaMtxPathListResponse;
    return (list.items ?? []).map(pathToStreamStatus);
  }

  /**
   * Gets a single stream by name.
   * Returns null if the stream does not exist on MediaMTX.
   */
  async getStream(name: string): Promise<StreamStatus | null> {
    try {
      const { data } = await this.fetchWithTimeout(
        `/v3/paths/get/${encodeURIComponent(name)}`,
      );
      return pathToStreamStatus(data as MediaMtxPath);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("HTTP 404")) {
        return null;
      }
      throw err;
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────────

function pathToStreamStatus(p: MediaMtxPath): StreamStatus {
  return {
    name: p.name,
    ready: p.ready,
    readyTime: p.readyTime ?? null,
    tracks: p.tracks ?? [],
    readerCount: p.readers?.length ?? 0,
    bytesReceived: p.bytesReceived ?? 0,
    bytesSent: p.bytesSent ?? 0,
  };
}
