import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { Errors } from "@/lib/errors";
import { MediaMtxClient } from "@/lib/mediamtx/client";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const server = await prisma.mediaMtxServer.findUnique({ where: { id } });
  if (!server) return Errors.notFound("Servidor MediaMTX");

  const client = MediaMtxClient.fromApiUrl(server.apiUrl);
  const paths = await client.getPaths();

  return NextResponse.json({
    data: {
      paths,
      total: paths.length,
      serverName: server.name,
    },
  });
}
