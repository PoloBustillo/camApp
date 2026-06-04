import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";
import { Errors } from "@/lib/errors";
import { MediaMtxClient } from "@/lib/mediamtx/client";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin", "operator"]);
  if (roleError) return roleError;

  const { id } = await params;
  const server = await prisma.mediaMtxServer.findUnique({ where: { id } });
  if (!server) return Errors.notFound("Servidor MediaMTX");

  // Get all cameras for this server
  const cameras = await prisma.camera.findMany({
    where: { mediaMtxServerId: id },
    select: { id: true, mediaMtxPath: true, online: true },
  });

  // Get live paths from MediaMTX
  let livePaths: Map<string, boolean>;
  const errors: string[] = [];
  try {
    const client = MediaMtxClient.fromApiUrl(server.apiUrl);
    const paths = await client.getPaths();
    livePaths = new Map(paths.map((p) => [p.name, p.ready]));
  } catch (err) {
    return Errors.internal(
      err instanceof Error ? err.message : "Error al conectar con MediaMTX",
    );
  }

  let onlineCount = 0;
  let offlineCount = 0;
  let synced = 0;

  for (const camera of cameras) {
    if (!camera.mediaMtxPath) continue;
    const isReady = livePaths.get(camera.mediaMtxPath) ?? false;
    const shouldBeOnline = isReady;

    if (camera.online !== shouldBeOnline) {
      try {
        await prisma.camera.update({
          where: { id: camera.id },
          data: { online: shouldBeOnline },
        });
        synced++;
      } catch (err) {
        errors.push(
          `camera ${camera.id}: ${err instanceof Error ? err.message : "update failed"}`,
        );
      }
    }

    if (shouldBeOnline) onlineCount++;
    else offlineCount++;
  }

  return NextResponse.json({
    data: {
      synced,
      online: onlineCount,
      offline: offlineCount,
      errors,
    },
  });
}
