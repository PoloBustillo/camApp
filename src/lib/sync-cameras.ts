import { prisma } from "@/lib/prisma";
import { createStreamClient } from "@/lib/stream-client";

/**
 * Syncs camera online status from all active edge servers.
 * Best-effort: errors are logged but never thrown.
 * Safe to call on every page load — no-ops if no servers configured.
 */
export async function syncCameraStatus(): Promise<void> {
  const servers = await prisma.edgeServer.findMany({
    where: { status: { not: "disabled" } },
  });

  if (servers.length === 0) return;

  await Promise.allSettled(
    servers.map(async (server) => {
      try {
        const client = createStreamClient(
          server as unknown as Parameters<typeof createStreamClient>[0],
        );

        const health = await client.healthCheck();

        await prisma.edgeServer.update({
          where: { id: server.id },
          data: {
            status: health.healthy ? "online" : "offline",
            lastSeenAt: health.healthy ? new Date() : undefined,
          },
        });

        if (!health.healthy) {
          await prisma.camera.updateMany({
            where: { edgeServerId: server.id, enabled: true },
            data: { online: false },
          });
          return;
        }

        const streams = await client.listStreams();
        const readyStreams = new Set(
          streams.filter((s) => s.ready).map((s) => s.name),
        );

        const cameras = await prisma.camera.findMany({
          where: { edgeServerId: server.id, enabled: true },
          select: { id: true, mediaMtxPath: true, online: true },
        });

        await Promise.all(
          cameras.map(async (cam) => {
            const streamKey = cam.mediaMtxPath ?? cam.id;
            const isOnline = readyStreams.has(streamKey);
            if (cam.online !== isOnline) {
              await prisma.camera.update({
                where: { id: cam.id },
                data: { online: isOnline },
              });
            }
          }),
        );
      } catch {
        // Best-effort: ignore
      }
    }),
  );
}
