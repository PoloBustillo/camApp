import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { CameraGrid } from "@/components/dashboard/camera-grid";
import type { DashboardCamera } from "@/stores/dashboard.store";

export const metadata: Metadata = { title: "Dashboard — CamWatch" };

async function fetchCameras(): Promise<DashboardCamera[]> {
  const rows = await prisma.camera.findMany({
    where: { enabled: true, site: { deletedAt: null } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      protocol: true,
      enabled: true,
      online: true,
      siteId: true,
      site: { select: { name: true } },
    },
  });
  return rows.map((c) => ({ ...c, siteName: c.site.name }));
}

export default async function DashboardPage() {
  await requireSession();
  const cameras = await fetchCameras();

  const onlineCount = cameras.filter((c) => c.online).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Monitoreo en vivo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {onlineCount}/{cameras.length} cámaras online
          </p>
        </div>
      </div>

      {cameras.length === 0 ? (
        <div className="rounded-lg border border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">
            No hay cámaras habilitadas.{" "}
            <a href="/cameras" className="underline hover:text-foreground">
              Agregar cámaras
            </a>
          </p>
        </div>
      ) : (
        <CameraGrid cameras={cameras} pollingInterval={10000} />
      )}
    </div>
  );
}
