import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { CameraViewerGrid } from "@/components/camera-viewer/camera-grid";
import { syncCameraStatus } from "@/lib/sync-cameras";
import type { CameraViewerItem } from "@/types/camera-viewer";
import type { PersistedFilters } from "@/types/camera-viewer";

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

  // Sync camera online status from streaming servers (best-effort, non-blocking)
  await syncCameraStatus();

  const cameras = await fetchCamerasForViewer();

  const favorites = await prisma.userFavorite.findMany({
    where: { userId: session.user.id },
    select: { cameraId: true },
  });
  const favoriteIds = favorites.map((f) => f.cameraId);

  const cameraOrder = await prisma.userCameraOrder.findMany({
    where: { userId: session.user.id },
    orderBy: { position: "asc" },
    select: { cameraId: true },
  });
  const cameraOrderIds = cameraOrder.map((r) => r.cameraId);

  const cameraFiltersRows = await prisma.userCameraFilter.findMany({
    where: { userId: session.user.id },
    select: {
      cameraId: true,
      brightness: true,
      contrast: true,
      saturation: true,
      preset: true,
    },
  });
  const cameraFiltersMap: Record<string, PersistedFilters> = {};
  for (const f of cameraFiltersRows) {
    cameraFiltersMap[f.cameraId] = {
      brightness: f.brightness,
      contrast: f.contrast,
      saturation: f.saturation,
      preset: f.preset,
    };
  }

  return (
    <div className="space-y-4">
      <CameraViewerGrid
        cameras={cameras}
        title="Mis cámaras"
        favoriteIds={favoriteIds}
        cameraOrderIds={cameraOrderIds}
        cameraFilters={cameraFiltersMap}
        showGridControls
      />
    </div>
  );
}

