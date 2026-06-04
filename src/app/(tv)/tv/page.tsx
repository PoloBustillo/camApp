import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { KioskGrid } from "@/components/camera-viewer/kiosk-grid";
import type { CameraViewerItem } from "@/types/camera-viewer";

export const metadata = { title: "CamWatch TV" };

export default async function TvPage() {
  await requireSession();

  const rows = await prisma.camera.findMany({
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
  });

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

  return <KioskGrid cameras={cameras} />;
}
