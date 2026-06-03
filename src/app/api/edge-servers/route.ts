import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";
import { Errors } from "@/lib/errors";

const createEdgeServerSchema = z.object({
  name: z.string().min(1).max(255),
  tailscaleIp: z.string().regex(/^100\.\d{1,3}\.\d{1,3}\.\d{1,3}$/),
  mediamtxApiPort: z.number().int().min(1).max(65535).optional(),
  webrtcPort: z.number().int().min(1).max(65535).optional(),
  publicHost: z.string().min(1).max(255),
});

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const servers = await prisma.edgeServer.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: servers });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin"]);
  if (roleError) return roleError;

  const body = await req.json().catch(() => null);
  const parsed = createEdgeServerSchema.safeParse(body);
  if (!parsed.success) return Errors.validation(parsed.error.flatten());

  const existing = await prisma.edgeServer.findUnique({
    where: { tailscaleIp: parsed.data.tailscaleIp },
  });
  if (existing)
    return Errors.conflict("Ya existe un servidor con esa IP de Tailscale");

  const server = await prisma.edgeServer.create({ data: parsed.data });
  return NextResponse.json({ data: server }, { status: 201 });
}
