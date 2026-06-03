import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { Errors } from "@/lib/errors";
import { MediaMtxClient } from "@/lib/mediamtx/client";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/edge-servers/[id]/streams
 * Lists all active streams from the MediaMTX instance of the given EdgeServer.
 * Returns raw stream data including ready status, tracks, and byte counters.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const server = await prisma.edgeServer.findUnique({ where: { id } });
  if (!server) return Errors.notFound("Servidor Edge");

  const client = MediaMtxClient.fromEdgeServer(server);

  let streams;
  try {
    streams = await client.listStreams();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al conectar con MediaMTX";
    return NextResponse.json(
      { error: "mediamtx_unreachable", message: msg },
      { status: 502 },
    );
  }

  return NextResponse.json({
    data: streams,
    meta: {
      serverId: id,
      serverName: server.name,
      total: streams.length,
      ready: streams.filter((s) => s.ready).length,
    },
  });
}
