import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { Errors } from "@/lib/errors";
import { MediaMtxClient } from "@/lib/mediamtx/client";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const server = await prisma.mediaMtxServer.findUnique({ where: { id } });
  if (!server) return Errors.notFound("Servidor MediaMTX");

  const client = MediaMtxClient.fromApiUrl(
    server.apiUrl,
    5000,
    process.env.MEDIAMTX_USER,
    process.env.MEDIAMTX_PASSWORD,
  );
  const result = await client.testConnection();

  return NextResponse.json({ data: result });
}
