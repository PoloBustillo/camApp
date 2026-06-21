import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";
import { Errors } from "@/lib/errors";
import { createStreamClient } from "@/lib/stream-client";
import type { SyncResult } from "@/lib/mediamtx/types";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/edge-servers/[id]/sync
 *
 * Syncs the online status of all cameras against the streaming server streams list.
 *
 * Matching convention:
 *   Cameras are matched by mediaMtxPath if set, falling back to the camera UUID.
 *   Only cameras assigned to this edge server are evaluated.
 *   If the stream is `ready: true`, the camera is marked online.
 *
 * Requires: admin or operator role.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin", "operator"]);
  if (roleError) return roleError;

  const { id } = await params;
  const server = await prisma.edgeServer.findUnique({ where: { id } });
  if (!server) return Errors.notFound("Servidor Edge");

  const client = createStreamClient(
    server as unknown as Parameters<typeof createStreamClient>[0],
    process.env.MEDIAMTX_USER,
    process.env.MEDIAMTX_PASSWORD,
  );
  const syncErrors: string[] = [];
  const start = Date.now();

  // ─── 1. Health check ────────────────────────────────────────
  const health = await client.healthCheck();

  await prisma.edgeServer.update({
    where: { id },
    data: {
      status: health.healthy ? "online" : "offline",
      lastSeenAt: health.healthy ? new Date() : undefined,
    },
  });

  if (!health.healthy) {
    // Mark only cameras on this edge server as offline
    await prisma.camera.updateMany({
      where: { edgeServerId: id, site: { deletedAt: null } },
      data: { online: false },
    });

    return NextResponse.json(
      {
        data: {
          synced: 0,
          online: 0,
          offline: 0,
          errors: [health.error ?? "Server unreachable"],
          latencyMs: Date.now() - start,
        } satisfies SyncResult,
      },
      { status: 502 },
    );
  }

  // ─── 2. List streams from server ─────────────────────────────
  let streams;
  try {
    streams = await client.listStreams();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to list streams";
    return NextResponse.json(
      { error: "stream_server_error", message: msg },
      { status: 502 },
    );
  }

  // Build a Set of ready stream names for O(1) lookup
  const readyStreams = new Set(
    streams.filter((s) => s.ready).map((s) => s.name),
  );

  // ─── 3. Load all active cameras ─────────────────────────────
  const cameras = await prisma.camera.findMany({
    where: { edgeServerId: id, enabled: true, site: { deletedAt: null } },
    select: { id: true, name: true, mediaMtxPath: true, online: true },
  });

  // ─── 4. Update each camera's online status ──────────────────
  let onlineCount = 0;
  let offlineCount = 0;

  await Promise.all(
    cameras.map(async (cam) => {
      try {
        // Match by mediaMtxPath if set, otherwise fall back to camera UUID
        const streamKey = cam.mediaMtxPath ?? cam.id;
        const isOnline = readyStreams.has(streamKey);

        if (cam.online !== isOnline) {
          await prisma.camera.update({
            where: { id: cam.id },
            data: { online: isOnline },
          });

          // Record stream event
          await prisma.streamEvent.create({
            data: {
              cameraId: cam.id,
              eventType: isOnline ? "online" : "offline",
              message: isOnline
                ? `Camera came online via server sync`
                : `Camera went offline via server sync`,
            },
          });
        }

        if (isOnline) onlineCount++;
        else offlineCount++;
      } catch (err) {
        syncErrors.push(
          `Camera ${cam.name}: ${err instanceof Error ? err.message : "unknown error"}`,
        );
      }
    }),
  );

  const result: SyncResult = {
    synced: cameras.length,
    online: onlineCount,
    offline: offlineCount,
    errors: syncErrors,
    latencyMs: Date.now() - start,
  };

  return NextResponse.json({ data: result });
}
