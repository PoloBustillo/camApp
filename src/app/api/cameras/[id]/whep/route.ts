import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { MediaMtxClient } from "@/lib/mediamtx/client";

type RouteParams = { params: Promise<{ id: string }> };

const UPSTREAM_TIMEOUT_MS = 8_000;
const MAX_UPSTREAM_RETRIES = 1;

/** Basic Auth header for upstream MediaMTX (server-side credentials). */
function mediaMtxAuthHeader(): string | null {
  return MediaMtxClient.buildAuthHeader(
    process.env.MEDIAMTX_USER,
    process.env.MEDIAMTX_PASSWORD,
  );
}

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("socket hang up") ||
    msg.includes("network") ||
    err.name === "AbortError"
  );
}

async function fetchUpstreamWithRetry(
  url: string,
  options: RequestInit,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_UPSTREAM_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);
        return res;
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      lastError = err;
      if (attempt < MAX_UPSTREAM_RETRIES && isRetryableError(err)) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

type EdgeServerRecord = {
  serverType: string;
  publicHost: string;
  go2rtcApiPort: number;
  webrtcPort: number;
  go2rtcWebRtcPort: number;
};

/**
 * /api/cameras/:id/whep — Server-side WHEP proxy
 *
 * Solves the CORS problem: the browser sends the SDP offer to this endpoint
 * (same origin as the app), and we forward it server-side to MediaMTX.
 *
 * Supports the full WHEP protocol:
 *   POST   — SDP offer → MediaMTX → SDP answer back to browser
 *   DELETE — teardown the WebRTC session
 *   PATCH  — ICE trickle updates
 *   OPTIONS — preflight (not needed for same-origin, included for safety)
 */

async function resolveWhepTarget(
  cameraId: string,
  streamType: "main" | "sub" = "main",
): Promise<{ url: string; serverType: string } | null> {
  const camera = await prisma.camera.findUnique({
    where: { id: cameraId },
    include: { edgeServer: true },
  });

  if (!camera) return null;

  // Respect streamType: sub uses substreamPath when available
  const streamPath =
    streamType === "sub"
      ? (camera.substreamPath ?? camera.mediaMtxPath ?? camera.id)
      : (camera.mediaMtxPath ?? camera.id);

  if (camera.edgeServer) {
    const server = camera.edgeServer as unknown as EdgeServerRecord;

    if (server.serverType === "go2rtc") {
      const internalHost = process.env.GO2RTC_INTERNAL_HOST ?? server.publicHost;
      return {
        url: `http://${internalHost}:${server.go2rtcApiPort}/api/webrtc?src=${streamPath}`,
        serverType: "go2rtc",
      };
    }

    // Default: MediaMTX
    return {
      url: `http://${server.publicHost}:${server.webrtcPort}/${streamPath}/whep`,
      serverType: "mediaMtx",
    };
  }

  const base = process.env.MEDIAMTX_WEBRTC_URL ?? "";
  return base
    ? { url: `${base.replace(/\/$/, "")}/${streamPath}/whep`, serverType: "mediaMtx" }
    : null;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;

  const streamType = (req.nextUrl.searchParams.get("type") ?? "main") as
    | "main"
    | "sub";
  const target = await resolveWhepTarget(id, streamType);
  if (!target) {
    return NextResponse.json(
      {
        error: { code: "NO_WEBRTC_URL", message: "URL WebRTC no configurada" },
      },
      { status: 422 },
    );
  }

  const sdpOffer = await req.text();

  const upstreamHeaders: HeadersInit = { "Content-Type": "application/sdp" };
  const mtxAuth = mediaMtxAuthHeader();
  if (mtxAuth) upstreamHeaders["Authorization"] = mtxAuth;

  try {
    const upstream = await fetchUpstreamWithRetry(target.url, {
      method: "POST",
      headers: upstreamHeaders,
      body: sdpOffer,
    });

    const sdpAnswer = await upstream.text();

    const resHeaders = new Headers({
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/sdp",
    });

    const location = upstream.headers.get("Location");
    if (location) {
      resHeaders.set("Location", `/api/cameras/${id}/whep?type=${streamType}`);
      resHeaders.set("X-Upstream-Location", location);
    }

    return new NextResponse(sdpAnswer, {
      status: upstream.status,
      headers: resHeaders,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upstream unreachable";
    const code =
      msg.includes("ECONNREFUSED") || msg.includes("connection refused")
        ? "CAMERA_OFFLINE"
        : msg.includes("AbortError") || msg.includes("aborted")
          ? "STREAM_TIMEOUT"
          : "STREAM_ERROR";
    return NextResponse.json(
      { error: { code, message: msg } },
      { status: 502 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;

  const target = await resolveWhepTarget(id);
  if (!target) return new NextResponse(null, { status: 204 });

  const deleteHeaders: HeadersInit = {};
  const mtxAuth = mediaMtxAuthHeader();
  if (mtxAuth) deleteHeaders["Authorization"] = mtxAuth;

  // Forward DELETE to teardown the WHEP session
  try {
    await fetchUpstreamWithRetry(target.url, { method: "DELETE", headers: deleteHeaders });
  } catch {
    // Best-effort teardown — ignore errors
  }

  return new NextResponse(null, { status: 200 });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;

  const target = await resolveWhepTarget(id);
  if (!target) return new NextResponse(null, { status: 422 });

  const body = await req.text();
  const patchHeaders: HeadersInit = {
    "Content-Type":
      req.headers.get("Content-Type") ?? "application/trickle-ice-sdpfrag",
  };
  const mtxAuth = mediaMtxAuthHeader();
  if (mtxAuth) patchHeaders["Authorization"] = mtxAuth;

  const upstream = await fetchUpstreamWithRetry(target.url, {
    method: "PATCH",
    headers: patchHeaders,
    body,
  });

  return new NextResponse(await upstream.text(), { status: upstream.status });
}
