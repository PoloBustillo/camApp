import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { KioskGrid } from "@/components/camera-viewer/kiosk-grid";
import type { CameraViewerItem, PersistedFilters } from "@/types/camera-viewer";

export const metadata = { title: "CamWatch TV" };

export default async function TvPage() {
  const session = await requireSession();

  const [rows, cameraFiltersRows] = await Promise.all([
    prisma.camera.findMany({
      where: { enabled: true, online: true },
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
  ]);

  const cameras: CameraViewerItem[] = rows.map((c) => ({
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
