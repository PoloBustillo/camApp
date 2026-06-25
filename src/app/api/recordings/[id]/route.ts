import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";
import { Errors } from "@/lib/errors";

const RECORDER_PC_URL = process.env.RECORDER_PC_URL || "";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;

  const recording = await prisma.recording.findUnique({
    where: { id },
    include: { camera: { select: { name: true } } },
  });
  if (!recording) return Errors.notFound("Recording");

  if (!RECORDER_PC_URL) {
    return Errors.internal("RECORDER_PC_URL no configurada");
  }

  // Build URL to the actual MP4 file on the recorder PC
  const camName = recording.camera.name.toLowerCase().replace(/\s+/g, "-");
  const dateStr = recording.date.toISOString().slice(0, 10);
  const recordUrl = `${RECORDER_PC_URL}/recordings/${camName}/${dateStr}/${recording.fileName}`;

  // Proxy with byte-range support for seeking
  try {
    const pcRes = await fetch(recordUrl, {
      headers: {
        ...(_req.headers.get("range") ? { range: _req.headers.get("range")! } : {}),
      },
      signal: AbortSignal.timeout(30000),
    });

    const headers = new Headers();
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Type", pcRes.headers.get("content-type") || "video/mp4");

    if (pcRes.headers.get("content-length")) {
      headers.set("Content-Length", pcRes.headers.get("content-length")!);
    }
    if (pcRes.headers.get("content-range")) {
      headers.set("Content-Range", pcRes.headers.get("content-range")!);
    }
    headers.set("Cache-Control", "public, max-age=3600");

    const status = pcRes.status === 206 ? 206 : (pcRes.ok ? 200 : pcRes.status);
    const body = pcRes.body ? await pcRes.arrayBuffer() : null;

    return new NextResponse(body, { status, headers });
  } catch (err) {
    return Errors.internal(
      err instanceof Error ? err.message : "Error al obtener grabación",
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin"]);
  if (roleError) return roleError;

  const { id } = await params;

  const recording = await prisma.recording.findUnique({ where: { id } });
  if (!recording) return Errors.notFound("Recording");

  // Block deletion if under legal hold
  if (recording.legalHold) {
    return NextResponse.json(
      { error: { code: "LEGAL_HOLD", message: "Grabación bajo custodia legal — no se puede eliminar" } },
      { status: 409 },
    );
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "recording_deleted",
      resourceType: "recording",
      resourceId: id,
      metadata: {
        cameraId: recording.cameraId,
        fileName: recording.fileName,
        date: recording.date.toISOString(),
        fileHash: recording.fileHash,
        cloudStorageKey: recording.cloudStorageKey,
        fileSize: recording.fileSize,
        duration: recording.duration,
        startTime: recording.startTime.toISOString(),
        endTime: recording.endTime?.toISOString(),
      },
    },
  });

  // Soft-delete: marca deletedAt en vez de borrar
  await prisma.recording.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return new NextResponse(null, { status: 204 });
}
