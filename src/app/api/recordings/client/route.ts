import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { Errors } from "@/lib/errors";

/**
 * POST /api/recordings/client
 *
 * Saves metadata for a client-side recording (browser MediaRecorder).
 * The actual video file is downloaded to the user's machine; only metadata is stored.
 *
 * Body: {
 *   cameraId: string,
 *   fileName: string,
 *   fileSize: number,
 *   duration: number,
 *   fileHash: string,
 *   mimeType: string,
 *   startTime: string,
 *   endTime: string,
 * }
 */
export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => null);
  if (!body) return Errors.validation({ body: "Required" });

  const { cameraId, fileName, fileSize, duration, fileHash, mimeType, startTime, endTime } = body;

  // Validate required fields
  if (typeof cameraId !== "string") return Errors.validation({ cameraId: "Required string" });
  if (typeof fileName !== "string") return Errors.validation({ fileName: "Required string" });
  if (typeof fileHash !== "string") return Errors.validation({ fileHash: "Required string" });

  // Verify camera exists
  const camera = await prisma.camera.findUnique({ where: { id: cameraId } });
  if (!camera) return Errors.notFound("Camera");

  // Parse timestamps
  const start = new Date(startTime);
  const end = new Date(endTime);
  const date = new Date(start.toISOString().slice(0, 10));

  // Detect codec from mimeType
  let codec: string | null = null;
  if (mimeType.includes("vp9")) codec = "vp9";
  else if (mimeType.includes("vp8")) codec = "vp8";
  else if (mimeType.includes("h264") || mimeType.includes("avc")) codec = "h264";
  else if (mimeType.includes("mp4")) codec = "mp4";

  // Get capture device info
  const captureDevice = req.headers.get("user-agent") || "Unknown";

  // Server-side trusted timestamp
  const serverTimestamp = new Date();

  // Build chain of custody log
  const custodyLog = [
    {
      action: "created",
      by: user.email,
      at: serverTimestamp.toISOString(),
      source: "client_recording",
      device: captureDevice,
      hash: fileHash,
    },
  ];

  const recording = await prisma.recording.create({
    data: {
      cameraId,
      date,
      fileName,
      startTime: start,
      endTime: end,
      duration: Math.round(duration),
      fileSize: Math.round(fileSize),
      fileHash,
      codec,
      sourceType: "client",
      capturedBy: user.email,
      captureDevice,
      serverTimestamp,
      custodyLog,
    },
    select: { id: true },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "stream_access",
      resourceType: "recording",
      resourceId: recording.id,
      metadata: {
        action: "client_recording_created",
        cameraId,
        fileName,
        fileHash,
        duration,
      },
    },
  });

  return NextResponse.json({ data: { id: recording.id } }, { status: 201 });
}
