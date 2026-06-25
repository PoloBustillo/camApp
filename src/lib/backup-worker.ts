import { prisma } from "./prisma";
import { uploadToCloud, isCloudConfigured } from "./cloud/r2-client";
import { createHash } from "crypto";

const RECORDER_PC_URL = process.env.RECORDER_PC_URL || "";
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_AGE_MS = 60 * 60 * 1000; // 1 hour

let _interval: ReturnType<typeof setInterval> | null = null;
let _running = false;

function buildRecordingUrl(recording: {
  id: string;
  camera: { name: string };
  date: Date;
  fileName: string;
}): string {
  const camName = recording.camera.name.toLowerCase().replace(/\s+/g, "-");
  const dateStr = recording.date.toISOString().slice(0, 10);
  return `${RECORDER_PC_URL}/recordings/${camName}/${dateStr}/${recording.fileName}`;
}

function buildCloudKey(recording: {
  camera: { name: string };
  date: Date;
  fileName: string;
}): string {
  const camName = recording.camera.name.toLowerCase().replace(/\s+/g, "-");
  const dateStr = recording.date.toISOString().slice(0, 10);
  return `recordings/${camName}/${dateStr}/${recording.fileName}`;
}

export async function backupRecording(
  recordingId: string,
): Promise<{ status: "uploaded" | "failed"; error?: string }> {
  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    include: { camera: { select: { name: true } } },
  });
  if (!recording) return { status: "failed", error: "Recording not found" };

  if (recording.deletedAt) {
    return { status: "failed", error: "Recording has been deleted" };
  }

  if (recording.cloudBackupStatus === "uploaded") {
    return { status: "uploaded" };
  }

  if (!RECORDER_PC_URL) {
    return { status: "failed", error: "RECORDER_PC_URL no configurada" };
  }

  try {
    await prisma.recording.update({
      where: { id: recordingId },
      data: { cloudBackupStatus: "pending" },
    });

    const url = buildRecordingUrl(recording);
    const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} al descargar grabación`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());

    // Compute hash of downloaded bytes for integrity verification
    const computedHash = createHash("sha256").update(buffer).digest("hex");
    if (recording.fileHash && computedHash !== recording.fileHash) {
      console.error(`[backup-worker] Hash mismatch for ${recordingId}: expected=${recording.fileHash} got=${computedHash}`);
    }

    const cloudKey = buildCloudKey(recording);
    const metaKey = cloudKey.replace(/\.[^.]+$/, ".meta.json");

    // S3 metadata headers
    const s3Metadata: Record<string, string> = {
      "camera-id": recording.cameraId,
      "camera-name": recording.camera.name,
      "file-hash": recording.fileHash || "unknown",
      "codec": recording.codec || "unknown",
      "source-type": recording.sourceType || "server",
      "start-time": recording.startTime.toISOString(),
      "end-time": recording.endTime?.toISOString() || "",
      "duration": String(recording.duration || 0),
      "server-timestamp": recording.serverTimestamp?.toISOString() || new Date().toISOString(),
    };

    // Append backup entry to chain of custody
    const now = new Date();
    const existingCustody = (recording.custodyLog as any[]) || [];
    const updatedCustodyLog = [
      ...existingCustody,
      {
        action: "uploaded_to_cloud",
        at: now.toISOString(),
        cloudKey,
        bucket: process.env.CLOUD_BUCKET_NAME || "unknown",
        backupHash: computedHash,
        previousHash: recording.fileHash,
      },
    ];

    // Sidecar JSON with updated custody chain
    const metaJson = {
      version: "1.0",
      recording: {
        id: recording.id,
        fileName: recording.fileName,
        fileSize: recording.fileSize,
        fileHash: recording.fileHash,
        mimeType: "video/mp4",
        codec: recording.codec,
        duration: recording.duration,
      },
      camera: {
        id: recording.cameraId,
        name: recording.camera.name,
      },
      timestamps: {
        startTime: recording.startTime.toISOString(),
        endTime: recording.endTime?.toISOString() || null,
        serverTimestamp: recording.serverTimestamp?.toISOString() || new Date().toISOString(),
      },
      source: {
        type: recording.sourceType || "server",
        capturedBy: recording.capturedBy,
        captureDevice: recording.captureDevice,
      },
      custodyLog: updatedCustodyLog,
    };

    await Promise.all([
      uploadToCloud(cloudKey, buffer, "video/mp4", s3Metadata),
      uploadToCloud(metaKey, Buffer.from(JSON.stringify(metaJson, null, 2)), "application/json"),
    ]);

    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        cloudStorageKey: cloudKey,
        cloudBackupAt: now,
        cloudBackupStatus: "uploaded",
        fileHash: recording.fileHash || computedHash,
        serverTimestamp: recording.serverTimestamp || now,
        custodyLog: updatedCustodyLog,
      },
    });

    return { status: "uploaded" };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    await prisma.recording.update({
      where: { id: recordingId },
      data: { cloudBackupStatus: "failed" },
    }).catch(() => {});
    return { status: "failed", error: errorMsg };
  }
}

async function processPendingBackups(): Promise<void> {
  if (_running) return;
  _running = true;

  try {
    const cutoff = new Date(Date.now() - MIN_AGE_MS);

    const pending = await prisma.recording.findMany({
      where: {
        cloudBackupStatus: "none",
        startTime: { lt: cutoff },
        deletedAt: null,
      },
      include: { camera: { select: { name: true } } },
      take: 5,
      orderBy: { startTime: "asc" },
    });

    for (const rec of pending) {
      await backupRecording(rec.id);
    }
  } catch (err) {
    console.error("[backup-worker] Error:", err);
  } finally {
    _running = false;
  }
}

export function startBackupWorker(): void {
  if (_interval) return;
  if (!isCloudConfigured()) {
    console.log("[backup-worker] Cloud no configurado, worker no iniciado");
    return;
  }

  console.log("[backup-worker] Iniciado (intervalo: 5min)");
  _interval = setInterval(processPendingBackups, POLL_INTERVAL_MS);

  // Run once after 30 seconds on startup
  setTimeout(processPendingBackups, 30_000);
}

export function stopBackupWorker(): void {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
    console.log("[backup-worker] Detenido");
  }
}
