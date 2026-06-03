import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { decryptRtspUrl } from "@/lib/crypto";
import { signStreamToken } from "@/lib/stream";
import { Errors } from "@/lib/errors";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/cameras/:id/stream
 * Genera un token temporal (30s) para acceder al stream WebRTC de la cámara vía MediaMTX.
 * El backend verifica credenciales y retorna la URL WHEP + token firmado.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;

  const camera = await prisma.camera.findFirst({
    where: { id, deletedAt: null },
    include: { edgeServer: true },
  });

  if (!camera) return Errors.notFound("Cámara");

  if (camera.status === "offline" || camera.status === "error") {
    return NextResponse.json(
      {
        error: {
          code: "STREAM_UNAVAILABLE",
          message: "El stream no está disponible",
        },
      },
      { status: 503 },
    );
  }

  const streamToken = await signStreamToken(camera.id, user.id);

  const whepUrl = `http://${camera.edgeServer.publicHost}:${camera.edgeServer.webrtcPort}/${camera.slug}/whep`;

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
    whepUrl,
    expiresIn: 30,
  });
}
