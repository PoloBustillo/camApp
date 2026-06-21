import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { Errors } from "@/lib/errors";
import { createStreamClient } from "@/lib/stream-client";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/edge-servers/[id]/health
 * Runs a health check against the streaming server API of the given EdgeServer.
 * Also updates EdgeServer.status and lastSeenAt in the DB.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const server = await prisma.edgeServer.findUnique({ where: { id } });
  if (!server) return Errors.notFound("Servidor Edge");

  const client = createStreamClient(
    server as unknown as Parameters<typeof createStreamClient>[0],
    process.env.MEDIAMTX_USER,
    process.env.MEDIAMTX_PASSWORD,
  );
  const result = await client.healthCheck();

  // Persist status back to the EdgeServer record
  await prisma.edgeServer.update({
    where: { id },
    data: {
      status: result.healthy ? "online" : "offline",
      lastSeenAt: result.healthy ? new Date() : undefined,
    },
  });

  return NextResponse.json({
    data: {
      serverId: id,
      serverName: server.name,
      ...result,
    },
  });
}
