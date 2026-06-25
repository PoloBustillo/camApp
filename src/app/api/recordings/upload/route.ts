import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
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

  // Verificar integridad: recomputar SHA-256 del archivo recibido
  const arrayBuffer = await file.arrayBuffer();
  const serverHash = createHash("sha256").update(Buffer.from(arrayBuffer)).digest("hex");
  if (serverHash !== fileHash) {
    return NextResponse.json(
      { error: { code: "HASH_MISMATCH", message: "Integrity check failed — file hash mismatch" } },
      { status: 422 },
    );
  }

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
      console.log(`[upload] Starting B2 upload for recording ${recording.id}`);
      const camName = recording.camera.name.toLowerCase().replace(/\s+/g, "-");
      const dateStr = date.toISOString().slice(0, 10);
      const cloudKey = `recordings/${camName}/${dateStr}/${file.name}`;
      const metaKey = cloudKey.replace(/\.[^.]+$/, ".meta.json");

      // S3 object metadata (x-amz-meta-* headers)
      const s3Metadata: Record<string, string> = {
        "camera-id": cameraId,
        "camera-name": recording.camera.name,
        "file-hash": fileHash,
        "codec": codec || "unknown",
        "source-type": "client",
        "captured-by": user.email,
        "start-time": start.toISOString(),
        "end-time": end.toISOString(),
        "duration": String(Math.round(Number(duration) || 0)),
        "server-timestamp": serverTimestamp.toISOString(),
      };

      // Sidecar JSON with full forensic metadata
      const metaJson = {
        version: "1.0",
        recording: {
          id: recording.id,
          fileName: file.name,
          fileSize: file.size,
          fileHash,
          mimeType: file.type || "video/webm",
          codec,
          duration: Math.round(Number(duration) || 0),
        },
        camera: {
          id: cameraId,
          name: recording.camera.name,
        },
        timestamps: {
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          serverTimestamp: serverTimestamp.toISOString(),
        },
        source: {
          type: "client",
          capturedBy: user.email,
          captureDevice,
        },
        custodyLog,
      };

      await Promise.all([
        uploadToCloud(cloudKey, Buffer.from(arrayBuffer), file.type || "video/webm", s3Metadata),
        uploadToCloud(metaKey, Buffer.from(JSON.stringify(metaJson, null, 2)), "application/json"),
      ]);

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
      console.error(`[upload] B2 upload failed for recording ${recording.id}:`, err instanceof Error ? err.message : err);
      console.error(`[upload] B2 upload details:`, err instanceof Error ? err.stack : String(err));
      await prisma.recording.update({
        where: { id: recording.id },
        data: { cloudBackupStatus: "failed" },
      }).catch(() => {});
      cloudStatus = "failed";
    }
  } else {
    console.log(`[upload] B2 not configured — skipping cloud upload for recording ${recording.id}`);
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
