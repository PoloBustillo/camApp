import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { Errors } from "@/lib/errors";
import { createStreamClient } from "@/lib/stream-client";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
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

  const streams = await client.listStreams();

  const paths = streams.map((s) => ({
    name: s.name,
    ready: s.ready,
    readyTime: s.readyTime ?? null,
  }));

  return NextResponse.json({
    data: {
      paths,
      total: paths.length,
      serverName: server.name,
    },
  });
}
