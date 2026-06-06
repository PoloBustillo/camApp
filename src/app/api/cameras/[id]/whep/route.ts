import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStreamToken } from "@/lib/stream";

type RouteParams = { params: Promise<{ id: string }> };

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

async function resolveWhepTarget(cameraId: string, streamType: "main" | "sub" = "main"): Promise<string | null> {
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

/** Authenticate via Bearer token in Authorization header */
async function authenticate(req: NextRequest, cameraId: string): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  try {
    const payload = await verifyStreamToken(token);
    return payload.cameraId === cameraId;
  } catch {
    return false;
  }
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
  const { id } = await params;

  const authorized = await authenticate(req, id);
  if (!authorized) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Token inválido o expirado" } },
      { status: 401 },
    );
  }

  const streamType = (req.nextUrl.searchParams.get("type") ?? "main") as "main" | "sub";
  const target = await resolveWhepTarget(id, streamType);
  if (!target) {
    return NextResponse.json(
      { error: { code: "NO_WEBRTC_URL", message: "URL WebRTC no configurada" } },
      { status: 422 },
    );
  }

  const sdpOffer = await req.text();

  const upstream = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
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
  const { id } = await params;

  const authorized = await authenticate(req, id);
  if (!authorized) return NextResponse.json(
    { error: { code: "UNAUTHORIZED", message: "Token inválido o expirado" } },
    { status: 401 },
  );

  const target = await resolveWhepTarget(id);
  if (!target) return new NextResponse(null, { status: 204 });

  // Forward DELETE to teardown the WHEP session on MediaMTX
  try {
    await fetch(target, { method: "DELETE" });
  } catch {
    // Best-effort teardown — ignore errors
  }

  return new NextResponse(null, { status: 200 });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const authorized = await authenticate(req, id);
  if (!authorized) return NextResponse.json(
    { error: { code: "UNAUTHORIZED", message: "Token inválido o expirado" } },
    { status: 401 },
  );

  const target = await resolveWhepTarget(id);
  if (!target) return new NextResponse(null, { status: 422 });

  const body = await req.text();
  const upstream = await fetch(target, {
    method: "PATCH",
    headers: { "Content-Type": req.headers.get("Content-Type") ?? "application/trickle-ice-sdpfrag" },
    body,
  });

  return new NextResponse(await upstream.text(), { status: upstream.status });
}
