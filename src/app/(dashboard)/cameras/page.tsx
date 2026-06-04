import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { CameraPageClient } from "./camera-page-client";

export const metadata: Metadata = { title: "Cámaras — CamWatch" };

export default async function CamerasPage() {
  await requireSession();

  const [cameras, sites, servers] = await Promise.all([
    prisma.camera.findMany({
      orderBy: { name: "asc" },
      include: { site: { select: { id: true, name: true } } },
    }),
    prisma.site.findMany({
      where: { deletedAt: null, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.mediaMtxServer.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { cameras: true } } },
    }),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Cámaras</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona las cámaras administradas por MediaMTX
        </p>
      </div>
      <CameraPageClient cameras={cameras} sites={sites} servers={servers} />
    </div>
  );
}
