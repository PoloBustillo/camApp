import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MediaMtxClient } from "@/lib/mediamtx/client";
import type { MediaMtxPathListResponse, MediaMtxPath } from "@/lib/mediamtx/types";

// ─── Fixtures ─────────────────────────────────────────────────

function makePath(overrides: Partial<MediaMtxPath> = {}): MediaMtxPath {
  return {
    name: "camera-uuid-123",
    confName: "camera-uuid-123",
    source: null,
    ready: true,
    readyTime: "2026-01-01T00:00:00Z",
    tracks: ["H264", "MPEG4Audio"],
    bytesReceived: 1024,
    bytesSent: 2048,
    readers: [],
    ...overrides,
  };
}

function makeListResponse(items: MediaMtxPath[]): MediaMtxPathListResponse {
  return { itemCount: items.length, pageCount: 1, items };
}

// ─── Mock helpers ─────────────────────────────────────────────

function mockFetchOk(body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function mockFetchError(status: number, statusText = "Error") {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ error: statusText }), {
      status,
      statusText,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function mockFetchNetworkError(message = "ECONNREFUSED") {
  return vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error(message));
}

// ─── Tests ────────────────────────────────────────────────────

describe("MediaMtxClient", () => {
  const client = new MediaMtxClient({ tailscaleIp: "100.64.0.1", apiPort: 9997 });

  afterEach(() => vi.restoreAllMocks());

  // ─── constructor / fromEdgeServer ──────────────────────────

  describe("constructor", () => {
    it("builds correct baseUrl", () => {
      expect(client.baseUrl).toBe("http://100.64.0.1:9997");
    });

    it("fromEdgeServer creates client from server record", () => {
      const c = MediaMtxClient.fromEdgeServer({
        tailscaleIp: "100.64.0.2",
        mediamtxApiPort: 9998,
      });
      expect(c.baseUrl).toBe("http://100.64.0.2:9998");
    });

    it("uses default port 9997 when not specified", () => {
      const c = new MediaMtxClient({ tailscaleIp: "100.64.0.3" });
      expect(c.baseUrl).toBe("http://100.64.0.3:9997");
    });
  });

  // ─── healthCheck ──────────────────────────────────────────

  describe("healthCheck()", () => {
    it("returns healthy=true with stream count on success", async () => {
      const paths = [makePath(), makePath({ name: "cam2" })];
      mockFetchOk(makeListResponse(paths));

      const result = await client.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.streamCount).toBe(2);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it("returns healthy=false on network error", async () => {
      mockFetchNetworkError("ECONNREFUSED");

      const result = await client.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.streamCount).toBe(0);
      expect(result.error).toContain("ECONNREFUSED");
    });

    it("returns healthy=false on HTTP 5xx", async () => {
      mockFetchError(503, "Service Unavailable");

      const result = await client.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toContain("503");
    });

    it("returns healthy=true with streamCount=0 for empty list", async () => {
      mockFetchOk(makeListResponse([]));

      const result = await client.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.streamCount).toBe(0);
    });
  });

  // ─── validateConnection ───────────────────────────────────

  describe("validateConnection()", () => {
    it("returns reachable=true when config endpoint responds", async () => {
      mockFetchOk({ logLevel: "info", logDestinations: ["stdout"] });

      const result = await client.validateConnection();

      expect(result.reachable).toBe(true);
      expect(result.apiVersion).toBe("v3");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("falls back to paths list and returns reachable=true", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new Error("HTTP 404 Not Found"))
        .mockResolvedValueOnce(
          new Response(JSON.stringify(makeListResponse([])), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );

      const result = await client.validateConnection();

      expect(result.reachable).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("returns reachable=false when both endpoints fail", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("ECONNREFUSED"),
      );

      const result = await client.validateConnection();

      expect(result.reachable).toBe(false);
      expect(result.error).toContain("ECONNREFUSED");
    });
  });

  // ─── listStreams ──────────────────────────────────────────

  describe("listStreams()", () => {
    it("returns mapped StreamStatus array", async () => {
      const paths = [
        makePath({ name: "cam1", ready: true, tracks: ["H264"] }),
        makePath({ name: "cam2", ready: false, readyTime: null }),
      ];
      mockFetchOk(makeListResponse(paths));

      const streams = await client.listStreams();

      expect(streams).toHaveLength(2);
      expect(streams[0]).toMatchObject({
        name: "cam1",
        ready: true,
        tracks: ["H264"],
      });
      expect(streams[1].ready).toBe(false);
      expect(streams[1].readyTime).toBeNull();
    });

    it("returns empty array when no streams", async () => {
      mockFetchOk(makeListResponse([]));

      const streams = await client.listStreams();

      expect(streams).toEqual([]);
    });

    it("maps bytesReceived and bytesSent correctly", async () => {
      mockFetchOk(
        makeListResponse([
          makePath({ bytesReceived: 5000, bytesSent: 3000 }),
        ]),
      );

      const [stream] = await client.listStreams();

      expect(stream.bytesReceived).toBe(5000);
      expect(stream.bytesSent).toBe(3000);
    });

    it("throws on network error", async () => {
      mockFetchNetworkError("Connection timed out");

      await expect(client.listStreams()).rejects.toThrow("Connection timed out");
    });
  });

  // ─── getStream ────────────────────────────────────────────

  describe("getStream()", () => {
    it("returns StreamStatus for existing stream", async () => {
      const path = makePath({ name: "cam-abc", ready: true });
      mockFetchOk(path);

      const stream = await client.getStream("cam-abc");

      expect(stream).not.toBeNull();
      expect(stream!.name).toBe("cam-abc");
      expect(stream!.ready).toBe(true);
    });

    it("returns null for 404 (stream not found)", async () => {
      mockFetchError(404, "Not Found");

      const stream = await client.getStream("nonexistent");

      expect(stream).toBeNull();
    });

    it("throws for non-404 errors", async () => {
      mockFetchError(500, "Internal Server Error");

      await expect(client.getStream("cam-abc")).rejects.toThrow("HTTP 500");
    });

    it("URL-encodes special characters in stream name", async () => {
      const fetchSpy = mockFetchOk(makePath({ name: "site/cam 1" }));

      await client.getStream("site/cam 1");

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("site%2Fcam%201"),
        expect.any(Object),
      );
    });
  });
});
