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

  // Include a setup hint when the connection fails
  const hint = result.ok
    ? undefined
    : "Ensure the apiUrl is set to http://<host>:9997 and port 9997 is reachable from this server. If MediaMTX is on the same machine, use http://localhost:9997.";

  return NextResponse.json({ data: { ...result, ...(hint && { hint }) } });
}
