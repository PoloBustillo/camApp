import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { Errors } from "@/lib/errors";
import { createStreamClient } from "@/lib/stream-client";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
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

  const start = Date.now();
  let result: { ok: boolean; latencyMs: number; streamCount?: number; error?: string };
  try {
    const health = await client.healthCheck();
    const streams = await client.listStreams();
    result = {
      ok: health.healthy,
      latencyMs: Date.now() - start,
      streamCount: streams.length,
    };
    if (!health.healthy) result.error = health.error ?? "Server unhealthy";
  } catch (err) {
    result = {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }

  const port = server.serverType === "go2rtc" ? server.go2rtcApiPort : server.mediamtxApiPort;
  const hint = result.ok
    ? undefined
    : `Ensure ${server.serverType === "go2rtc" ? "go2rtc" : "MediaMTX"} is running and reachable at ${server.tailscaleIp}:${port}`;

  return NextResponse.json({ data: { ...result, ...(hint && { hint }) } });
}
