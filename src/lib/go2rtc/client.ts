import type {
  Go2RtcStreamsResponse,
  HealthCheckResult,
  ConnectionValidation,
  StreamStatus,
} from "./types";

export interface Go2RtcClientConfig {
  tailscaleIp: string;
  apiPort?: number;
  timeout?: number;
}

/**
 * HTTP client for the go2rtc REST API.
 * Drop-in replacement for MediaMtxClient that talks to go2rtc.
 */
export class Go2RtcClient {
  readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: Go2RtcClientConfig) {
    const port = config.apiPort ?? 1984;
    this.baseUrl = `http://${config.tailscaleIp}:${port}`;
    this.timeout = config.timeout ?? 5000;
  }

  static fromEdgeServer(
    server: { tailscaleIp: string; go2rtcApiPort: number; publicHost?: string },
    _username?: string,
    _password?: string,
  ): Go2RtcClient {
    const internalHost = process.env.GO2RTC_INTERNAL_HOST ?? server.publicHost ?? server.tailscaleIp;
    return new Go2RtcClient({
      tailscaleIp: internalHost,
      apiPort: server.go2rtcApiPort,
    });
  }

  static fromApiUrl(apiUrl: string, timeout = 5000): Go2RtcClient {
    const normalised = apiUrl.replace(/\/$/, "");
    const client = new Go2RtcClient({ tailscaleIp: "placeholder", timeout });
    (client as { baseUrl: string }).baseUrl = normalised;
    return client;
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

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const { data, latencyMs } = await this.fetchWithTimeout("/api/streams");
      const streams = data as Go2RtcStreamsResponse;
      const streamCount = Object.keys(streams).length;
      return { healthy: true, latencyMs, streamCount };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: this.timeout,
        streamCount: 0,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  async validateConnection(): Promise<ConnectionValidation> {
    try {
      const { latencyMs } = await this.fetchWithTimeout("/api/streams");
      return { reachable: true, latencyMs, apiVersion: "go2rtc" };
    } catch (err) {
      return {
        reachable: false,
        latencyMs: this.timeout,
        apiVersion: "unknown",
        error: err instanceof Error ? err.message : "Connection refused",
      };
    }
  }

  async listStreams(): Promise<StreamStatus[]> {
    const { data } = await this.fetchWithTimeout("/api/streams");
    const streams = data as Go2RtcStreamsResponse;
    return Object.entries(streams).map(([name, stream]) =>
      go2rtcStreamToStatus(name, stream),
    );
  }

  async getStream(name: string): Promise<StreamStatus | null> {
    try {
      const { data } = await this.fetchWithTimeout(
        `/api/streams?src=${encodeURIComponent(name)}`,
      );
      const streams = data as Go2RtcStreamsResponse;
      const stream = streams[name];
      if (!stream) return null;
      return go2rtcStreamToStatus(name, stream);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("HTTP 404")) {
        return null;
      }
      throw err;
    }
  }

  async testConnection(): Promise<{
    ok: boolean;
    latencyMs: number;
    streamCount?: number;
    error?: string;
    testedUrl: string;
  }> {
    const testedUrl = `${this.baseUrl}/api/streams`;
    try {
      const { data, latencyMs } = await this.fetchWithTimeout("/api/streams");
      const streams = data as Go2RtcStreamsResponse;
      const streamCount = Object.keys(streams).length;
      return { ok: true, latencyMs, streamCount, testedUrl };
    } catch (err) {
      let error = "Unknown error";
      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        if (
          err.name === "AbortError" ||
          msg.includes("aborted") ||
          msg.includes("timed out")
        ) {
          error = `Timeout after ${this.timeout}ms — check that port 1984 is open`;
        } else if (
          msg.includes("econnrefused") ||
          msg.includes("connection refused")
        ) {
          error = `Connection refused at ${this.baseUrl} — is go2rtc running?`;
        } else if (msg.includes("enotfound") || msg.includes("getaddrinfo")) {
          error = `Host not found: ${this.baseUrl}`;
        } else {
          error = err.message;
        }
      }
      return { ok: false, latencyMs: this.timeout, error, testedUrl };
    }
  }

  async getPaths(): Promise<
    Array<{ name: string; ready: boolean; readyTime: string | null }>
  > {
    const { data } = await this.fetchWithTimeout("/api/streams");
    const streams = data as Go2RtcStreamsResponse;
    return Object.entries(streams).map(([name, stream]) => ({
      name,
      ready: (stream.producers?.length ?? 0) > 0,
      readyTime: null,
    }));
  }
}

// ─── Helpers ───────────────────────────────────────────────────

function go2rtcStreamToStatus(name: string, stream: Go2RtcStreamsResponse[string]): StreamStatus {
  const hasProducers = (stream.producers?.length ?? 0) > 0;
  return {
    name,
    ready: hasProducers,
    readyTime: null,
    tracks: [],
    readerCount: stream.consumers?.length ?? 0,
    bytesReceived: 0,
    bytesSent: 0,
  };
}
