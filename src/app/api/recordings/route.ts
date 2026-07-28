import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";
import { Errors } from "@/lib/errors";

const RECORDER_PC_URL = process.env.RECORDER_PC_URL || "";

export async function GET(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(req.url);
  const cameraId = searchParams.get("cameraId");
  const date = searchParams.get("date");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 50)));

  const where: Record<string, unknown> = { deletedAt: null };
  if (cameraId) where.cameraId = cameraId;
  if (date) {
    const d = new Date(date);
    where.date = d;
  }

  const [recordings, total] = await Promise.all([
    prisma.recording.findMany({
      where,
      include: { camera: { select: { name: true } } },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
    }),
    prisma.recording.count({ where }),
  ]);

  return NextResponse.json({
    data: recordings.map((r) => ({
      id: r.id,
      cameraId: r.cameraId,
      date: r.date.toISOString(),
      fileName: r.fileName,
      startTime: r.startTime.toISOString(),
      endTime: r.endTime?.toISOString() ?? null,
      duration: r.duration,
      fileSize: r.fileSize,
      thumbnail: r.thumbnail,
      cameraName: r.camera.name,
      cloudStorageKey: r.cloudStorageKey,
      cloudBackupAt: r.cloudBackupAt?.toISOString() ?? null,
      cloudBackupStatus: r.cloudBackupStatus,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin"]);
  if (roleError) return roleError;

  if (!RECORDER_PC_URL) {
    return Errors.internal("RECORDER_PC_URL no configurada");
  }

  try {
    // Fetch the recorder PC's root directory listing via Nginx autoindex
    const listRes = await fetch(`${RECORDER_PC_URL}/recordings/`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!listRes.ok) {
      return Errors.internal("No se pudo conectar con la PC de grabación");
    }
    const html = await listRes.text();

    // Parse Nginx autoindex HTML to extract camera directory names
    const cameraNames = extractDirNames(html);

    let synced = 0;

    for (const camName of cameraNames) {
      const camera = await prisma.camera.findFirst({
        where: { name: { contains: camName, mode: "insensitive" }, deletedAt: null },
      });
      if (!camera) continue;

      // Fetch date directories for this camera
      const dateRes = await fetch(
        `${RECORDER_PC_URL}/recordings/${camName}/`,
        { signal: AbortSignal.timeout(10000) },
      );
      if (!dateRes.ok) continue;
      const dateHtml = await dateRes.text();
      const dateDirs = extractDirNames(dateHtml).filter((d) =>
        /^\d{4}-\d{2}-\d{2}$/.test(d),
      );

      for (const dateStr of dateDirs) {
        // Fetch MP4 files for this date
        const fileRes = await fetch(
          `${RECORDER_PC_URL}/recordings/${camName}/${dateStr}/`,
          { signal: AbortSignal.timeout(10000) },
        );
        if (!fileRes.ok) continue;
        const fileHtml = await fileRes.text();
        const mp4Files = extractFileNames(fileHtml).filter((f) =>
          f.endsWith(".mp4"),
        );

        const recordDate = new Date(dateStr);

        for (const fileName of mp4Files) {
          const existing = await prisma.recording.findUnique({
            where: {
              cameraId_date_fileName: {
                cameraId: camera.id,
                date: recordDate,
                fileName,
              },
            },
          });
          if (existing) continue;

          // Parse start time from file name: HH-MM-SS.mp4
          const timeMatch = fileName.match(/^(\d{2})-(\d{2})-(\d{2})/);
          let startTime = new Date(`${dateStr}T${timeMatch?.[1] ?? "00"}:${timeMatch?.[2] ?? "00"}:${timeMatch?.[3] ?? "00"}Z`);

          await prisma.recording.create({
            data: {
              cameraId: camera.id,
              date: recordDate,
              fileName,
              startTime,
              duration: 600, // default 10 min segments
            },
          });
          synced++;
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "system_event",
        resourceType: "recording",
        metadata: { action: "sync", synced },
      },
    });

    return NextResponse.json({ data: { synced, cameras: cameraNames.length } });
  } catch (err) {
    return Errors.internal(
      err instanceof Error ? err.message : "Error al sincronizar",
    );
  }
}

function extractDirNames(html: string): string[] {
  const names: string[] = [];
  const regex = /<a[^>]*href="([^"]+)\/"[^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const name = match[1].trim();
    if (name && !name.startsWith(".")) names.push(name);
  }
  return names;
}

function extractFileNames(html: string): string[] {
  const names: string[] = [];
  const regex = /<a[^>]*href="([^"]+)"[^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const name = match[1].trim();
    if (name && !name.startsWith(".") && !name.endsWith("/")) names.push(name);
  }
  return names;
}
