import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { signStreamToken } from "@/lib/stream";
import { Errors } from "@/lib/errors";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/cameras/:id/stream
 *
 * Genera un token temporal (90s) para auditoría de acceso al stream.
 * Devuelve:
 *   - streamToken: JWT interno (no se envía a MediaMTX)
 *   - whepUrl: URL del proxy WHEP (same-origin)
 *   - cameraId
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;

  const camera = await prisma.camera.findUnique({ where: { id } });

  if (!camera) return Errors.notFound("Cámara no encontrada");

  if (!camera.enabled) {
    return NextResponse.json(
      {
        error: {
          code: "CAMERA_DISABLED",
          message: "La cámara está deshabilitada",
        },
      },
      { status: 503 },
    );
  }

  if (!camera.online) {
    return NextResponse.json(
      { error: { code: "CAMERA_OFFLINE", message: "La cámara está offline" } },
      { status: 503 },
    );
  }

  const streamToken = await signStreamToken(camera.id, user.id);

  // Return proxy URL — browser calls our API (same origin, no CORS).
  // The server resolves the actual MediaMTX target internally in /whep.
  const hasWebrtcConfig = !!(process.env.MEDIAMTX_WEBRTC_URL);
  const whepUrl = hasWebrtcConfig ? `/api/cameras/${camera.id}/whep` : null;

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "stream_access",
      resourceType: "camera",
      resourceId: camera.id,
    },
  });

  return NextResponse.json({
    streamToken,
    cameraId: camera.id,
    whepUrl,
    expiresIn: 90,
  });
}
