import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { CameraViewerGrid } from "@/components/camera-viewer/camera-grid";
import type { CameraViewerItem } from "@/types/camera-viewer";

export const metadata: Metadata = { title: "Favoritas — CamWatch" };

export default async function FavoritesPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const favorites = await prisma.userFavorite.findMany({
    where: { userId },
    include: {
      camera: {
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
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const cameras: CameraViewerItem[] = favorites.map(({ camera: c }) => ({
    id: c.id,
    name: c.name,
    siteName: c.site?.name ?? "",
    edgeServerId: c.edgeServerId ?? null,
    streamName: c.mediaMtxPath ?? null,
    substreamName: c.substreamPath ?? null,
    enabled: c.enabled,
    online: c.online,
    protocol: c.protocol,
    isFavorite: true,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cámaras favoritas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {cameras.length}{" "}
          {cameras.length === 1 ? "cámara" : "cámaras"} favorita
          {cameras.length !== 1 ? "s" : ""}
        </p>
      </div>
      {cameras.length === 0 ? (
        <div className="rounded-xl border border-border p-12 text-center bg-muted/20">
          <span className="text-4xl block mb-3">⭐</span>
          <p className="text-muted-foreground text-sm font-medium">
            Sin cámaras favoritas
          </p>
          <p className="text-muted-foreground/60 text-xs mt-1">
            Haz clic en ⭐ sobre cualquier cámara para añadirla aquí
          </p>
        </div>
      ) : (
        <CameraViewerGrid cameras={cameras} title="Favoritas" favoriteIds={cameras.map((c) => c.id)} />
      )}
    </div>
  );
}
