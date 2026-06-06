import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { MediaMtxClient } from "@/lib/mediamtx/client";

type RouteParams = { params: Promise<{ id: string }> };

/** Basic Auth header for upstream MediaMTX (server-side credentials). */
function mediaMtxAuthHeader(): string | null {
  return MediaMtxClient.buildAuthHeader(
    process.env.MEDIAMTX_USER,
    process.env.MEDIAMTX_PASSWORD,
  );
}

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
): Promise<string | null> {
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
    const { publicHost, webrtcPort } = camera.edgeServer;
    return `http://${publicHost}:${webrtcPort}/${streamPath}/whep`;
  }

  const base = process.env.MEDIAMTX_WEBRTC_URL ?? "";
  return base ? `${base.replace(/\/$/, "")}/${streamPath}/whep` : null;
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

  const upstream = await fetch(target, {
    method: "POST",
    headers: upstreamHeaders,
    body: sdpOffer,
  });

  const sdpAnswer = await upstream.text();

  const resHeaders = new Headers({
    "Content-Type": upstream.headers.get("Content-Type") ?? "application/sdp",
  });

  // Forward Location header for WHEP session teardown (DELETE)
  const location = upstream.headers.get("Location");
  if (location) {
    // Rewrite MediaMTX's location to our proxy so teardown also goes through us
    resHeaders.set("Location", `/api/cameras/${id}/whep?type=${streamType}`);
    resHeaders.set("X-Upstream-Location", location);
  }

  return new NextResponse(sdpAnswer, {
    status: upstream.status,
    headers: resHeaders,
  });
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

  // Forward DELETE to teardown the WHEP session on MediaMTX
  try {
    await fetch(target, { method: "DELETE", headers: deleteHeaders });
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

  const upstream = await fetch(target, {
    method: "PATCH",
    headers: patchHeaders,
    body,
  });

  return new NextResponse(await upstream.text(), { status: upstream.status });
}
