import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { CameraViewerGrid } from "@/components/camera-viewer/camera-grid";
import { HealthWidget } from "@/components/camera-viewer/health-widget";
import type { CameraViewerItem } from "@/types/camera-viewer";

export const metadata: Metadata = { title: "Inicio — CamWatch" };

async function fetchCamerasForViewer(): Promise<CameraViewerItem[]> {
  const rows = await prisma.camera.findMany({
    where: { enabled: true },
    orderBy: [{ online: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      protocol: true,
      enabled: true,
      online: true,
      mediaMtxPath: true,
      substreamPath: true,
      edgeServerId: true,
      site: { select: { name: true } },
    },
  });

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    siteName: c.site?.name ?? "",
    edgeServerId: c.edgeServerId ?? null,
    streamName: c.mediaMtxPath ?? null,
    substreamName: c.substreamPath ?? null,
    enabled: c.enabled,
    online: c.online,
    protocol: c.protocol,
  }));
}

export default async function DashboardPage() {
  const session = await requireSession();
  const cameras = await fetchCamerasForViewer();

  const favorites = await prisma.userFavorite.findMany({
    where: { userId: session.user.id },
    select: { cameraId: true },
  });
  const favoriteIds = favorites.map((f) => f.cameraId);

  const onlineCount = cameras.filter((c) => c.online).length;
  const offlineCount = cameras.length - onlineCount;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Mis cámaras</h1>
        </div>
        <div className="pt-1 min-w-0">
          <HealthWidget
            initial={{
              total: cameras.length,
              online: onlineCount,
              offline: offlineCount,
              lastUpdated: new Date(),
            }}
          />
        </div>
      </div>
      <CameraViewerGrid
        cameras={cameras}
        title="Vista en vivo"
        favoriteIds={favoriteIds}
        showGridControls
      />
    </div>
  );
}

