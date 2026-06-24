import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { Errors } from "@/lib/errors";
import { uploadToCloud, isCloudConfigured } from "@/lib/cloud/r2-client";

/**
 * POST /api/recordings/upload
 *
 * Accepts multipart form data: video blob + metadata.
 * Saves recording to DB and uploads file to cloud (Backblaze B2).
 */
export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const cameraId = formData.get("cameraId") as string | null;
  const startTime = formData.get("startTime") as string | null;
  const endTime = formData.get("endTime") as string | null;
  const duration = formData.get("duration") as string | null;
  const fileHash = formData.get("fileHash") as string | null;
  const mimeType = formData.get("mimeType") as string | null;

  if (!file) return Errors.validation({ file: "Required" });
  if (!cameraId) return Errors.validation({ cameraId: "Required" });
  if (!startTime) return Errors.validation({ startTime: "Required" });
  if (!endTime) return Errors.validation({ endTime: "Required" });
  if (!fileHash) return Errors.validation({ fileHash: "Required" });

  const camera = await prisma.camera.findUnique({ where: { id: cameraId } });
  if (!camera) return Errors.notFound("Camera");

  const start = new Date(startTime);
  const end = new Date(endTime);
  const date = new Date(start.toISOString().slice(0, 10));

  let codec: string | null = null;
  if (mimeType?.includes("vp9")) codec = "vp9";
  else if (mimeType?.includes("vp8")) codec = "vp8";
  else if (mimeType?.includes("h264") || mimeType?.includes("avc")) codec = "h264";
  else if (mimeType?.includes("mp4")) codec = "mp4";

  const captureDevice = req.headers.get("user-agent") || "Unknown";
  const serverTimestamp = new Date();

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
      fileName: file.name,
      startTime: start,
      endTime: end,
      duration: duration ? Math.round(Number(duration)) : null,
      fileSize: file.size,
      fileHash,
      codec,
      sourceType: "client",
      capturedBy: user.email,
      captureDevice,
      serverTimestamp,
      custodyLog,
    },
    select: { id: true, camera: { select: { name: true } } },
  });

  // Upload to cloud if configured
  let cloudStatus = "none";
  if (isCloudConfigured()) {
    try {
      const camName = recording.camera.name.toLowerCase().replace(/\s+/g, "-");
      const dateStr = date.toISOString().slice(0, 10);
      const cloudKey = `recordings/${camName}/${dateStr}/${file.name}`;

      const arrayBuffer = await file.arrayBuffer();
      await uploadToCloud(cloudKey, Buffer.from(arrayBuffer), file.type || "video/webm");

      await prisma.recording.update({
        where: { id: recording.id },
        data: {
          cloudStorageKey: cloudKey,
          cloudBackupAt: serverTimestamp,
          cloudBackupStatus: "uploaded",
        },
      });
      cloudStatus = "uploaded";
    } catch (err) {
      console.error("[upload] Cloud upload failed:", err);
      await prisma.recording.update({
        where: { id: recording.id },
        data: { cloudBackupStatus: "failed" },
      }).catch(() => {});
      cloudStatus = "failed";
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "stream_access",
      resourceType: "recording",
      resourceId: recording.id,
      metadata: {
        action: "client_recording_created",
        cameraId,
        fileName: file.name,
        fileHash,
        cloudStatus,
      },
    },
  });

  return NextResponse.json({
    data: { id: recording.id, cloudStatus },
  }, { status: 201 });
}
