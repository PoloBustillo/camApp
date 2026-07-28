import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { KioskGrid } from "@/components/camera-viewer/kiosk-grid";
import type { CameraViewerItem, PersistedFilters } from "@/types/camera-viewer";

export const metadata = { title: "CamWatch TV" };

export default async function TvPage() {
  const session = await requireSession();

  const [rows, cameraFiltersRows, cameraOrderRows] = await Promise.all([
    prisma.camera.findMany({
      where: { enabled: true, online: true, deletedAt: null },
      orderBy: [{ name: "asc" }],
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
    }),
    prisma.userCameraFilter.findMany({
      where: { userId: session.user.id },
      select: {
        cameraId: true,
        brightness: true,
        contrast: true,
        saturation: true,
        preset: true,
      },
    }),
    prisma.userCameraOrder.findMany({
      where: { userId: session.user.id },
      orderBy: { position: "asc" },
      select: { cameraId: true },
    }),
  ]);

  const cameraOrderIds = cameraOrderRows.map((r) => r.cameraId);

  let cameras: CameraViewerItem[] = rows.map((c) => ({
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

  // Respect dashboard custom order if set
  if (cameraOrderIds.length > 0) {
    const orderMap = new Map(cameraOrderIds.map((id, i) => [id, i]));
    cameras.sort((a, b) => {
      const ai = orderMap.get(a.id);
      const bi = orderMap.get(b.id);
      if (ai !== undefined && bi !== undefined) return ai - bi;
      if (ai !== undefined) return -1;
      if (bi !== undefined) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  const cameraFiltersMap: Record<string, PersistedFilters> = {};
  for (const f of cameraFiltersRows) {
    cameraFiltersMap[f.cameraId] = {
      brightness: f.brightness,
      contrast: f.contrast,
      saturation: f.saturation,
      preset: f.preset,
    };
  }

  return <KioskGrid cameras={cameras} cameraFilters={cameraFiltersMap} />;
}
