import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";
import { Errors } from "@/lib/errors";
import { MediaMtxClient } from "@/lib/mediamtx/client";
import { decryptPath } from "@/lib/crypto";
import type { SyncResult } from "@/lib/mediamtx/types";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/edge-servers/[id]/sync
 *
 * Syncs the online status of all cameras against the MediaMTX streams list.
 *
 * Matching convention:
 *   Each camera is expected to have a MediaMTX path named after its UUID.
 *   If MediaMTX reports that path as `ready: true`, the camera is marked online.
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

  const client = MediaMtxClient.fromEdgeServer(
    server,
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
    // Mark ALL cameras as offline since server is unreachable
    await prisma.camera.updateMany({
      where: { site: { deletedAt: null } },
      data: { online: false },
    });

    return NextResponse.json(
      {
        data: {
          synced: 0,
          online: 0,
          offline: 0,
          errors: [health.error ?? "MediaMTX unreachable"],
          latencyMs: Date.now() - start,
        } satisfies SyncResult,
      },
      { status: 502 },
    );
  }

  // ─── 2. List streams from MediaMTX ──────────────────────────
  let streams;
  try {
    streams = await client.listStreams();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to list streams";
    return NextResponse.json(
      { error: "mediamtx_error", message: msg },
      { status: 502 },
    );
  }

  // Build a Set of ready stream names for O(1) lookup
  const readyStreams = new Set(
    streams.filter((s) => s.ready).map((s) => s.name),
  );

  // ─── 3. Load all active cameras ─────────────────────────────
  const cameras = await prisma.camera.findMany({
    where: { enabled: true, site: { deletedAt: null } },
    select: { id: true, name: true, online: true },
  });

  // ─── 4. Update each camera's online status ──────────────────
  let onlineCount = 0;
  let offlineCount = 0;

  await Promise.all(
    cameras.map(async (cam) => {
      try {
        // Convention: MediaMTX path = camera UUID
        const isOnline = readyStreams.has(cam.id);

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
                ? `Camera came online via MediaMTX sync`
                : `Camera went offline via MediaMTX sync`,
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
