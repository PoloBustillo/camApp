import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession, isAdmin, isOperator } from "@/lib/session";
import { redirect } from "next/navigation";
import { RecordingsPageClient } from "./recordings-page-client";
import type { Recording } from "@/types";

export const metadata: Metadata = { title: "Grabaciones — CamWatch" };

export default async function RecordingsPage() {
  const session = await requireSession();
  if (!(isAdmin(session.user) || isOperator(session.user))) redirect("/dashboard");

  const [cameras, recentRecordings] = await Promise.all([
    prisma.camera.findMany({
      where: { enabled: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.recording.findMany({
      include: { camera: { select: { name: true } } },
      orderBy: { startTime: "desc" },
      take: 50,
    }),
  ]);

  const recordings: Recording[] = recentRecordings.map((r) => ({
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
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Grabaciones</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Explora y reproduce las grabaciones archivadas
        </p>
      </div>
      <RecordingsPageClient cameras={cameras} initialRecordings={recordings} />
    </div>
  );
}
