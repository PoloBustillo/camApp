import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { signStreamToken } from "@/lib/stream";
import { Errors } from "@/lib/errors";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/cameras/:id/webrtc-url?type=main|sub
 *
 * Returns a WHEP URL + short-lived JWT for WebRTC streaming.
 * URL is built server-side using EdgeServer.publicHost (no internal IPs exposed).
 * Falls back to MEDIAMTX_WEBRTC_URL env if no EdgeServer linked.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const streamType = (req.nextUrl.searchParams.get("type") ?? "sub") as "main" | "sub";

  const camera = await prisma.camera.findUnique({
    where: { id },
    include: { edgeServer: true },
  });

  if (!camera) return Errors.notFound("Cámara");
  if (!camera.enabled) {
    return NextResponse.json(
      { error: { code: "CAMERA_DISABLED", message: "Cámara deshabilitada" } },
      { status: 503 },
    );
  }
  if (!camera.online) {
    return NextResponse.json(
      { error: { code: "CAMERA_OFFLINE", message: "Cámara offline" } },
      { status: 503 },
    );
  }

  // Determine stream path
  const streamPath =
    streamType === "sub"
      ? (camera.substreamPath ?? camera.mediaMtxPath)
      : camera.mediaMtxPath;

  if (!streamPath) {
    return NextResponse.json(
      { error: { code: "NO_STREAM_PATH", message: "Sin ruta de stream configurada" } },
      { status: 422 },
    );
  }

  // Build WHEP URL using publicHost (safe to expose) or env fallback
  let whepUrl: string | null = null;
  if (camera.edgeServer) {
    const { publicHost, webrtcPort } = camera.edgeServer;
    whepUrl = `http://${publicHost}:${webrtcPort}/${streamPath}/whep`;
  } else {
    const base = process.env.MEDIAMTX_WEBRTC_URL ?? "";
    whepUrl = base ? `${base.replace(/\/$/, "")}/${streamPath}/whep` : null;
  }

  if (!whepUrl) {
    return NextResponse.json(
      { error: { code: "NO_WEBRTC_URL", message: "URL WebRTC no configurada" } },
      { status: 422 },
    );
  }

  const streamToken = await signStreamToken(camera.id, user.id);

  // Audit log (non-blocking)
  prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "stream_access",
      resourceType: "camera",
      resourceId: camera.id,
      metadata: { streamType, streamPath },
    },
  }).catch(() => {});

  return NextResponse.json({
    whepUrl,
    streamToken,
    streamType,
    expiresIn: 30,
  });
}
