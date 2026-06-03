import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";
import { Errors } from "@/lib/errors";

const updateEdgeServerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  tailscaleIp: z
    .string()
    .regex(/^100\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)
    .optional(),
  mediamtxApiPort: z.number().int().min(1).max(65535).optional(),
  webrtcPort: z.number().int().min(1).max(65535).optional(),
  publicHost: z.string().min(1).max(255).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const server = await prisma.edgeServer.findUnique({ where: { id } });
  if (!server) return Errors.notFound("Servidor Edge");

  return NextResponse.json({ data: server });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin"]);
  if (roleError) return roleError;

  const { id } = await params;
  const existing = await prisma.edgeServer.findUnique({ where: { id } });
  if (!existing) return Errors.notFound("Servidor Edge");

  const body = await req.json().catch(() => null);
  const parsed = updateEdgeServerSchema.safeParse(body);
  if (!parsed.success) return Errors.validation(parsed.error.flatten());

  const server = await prisma.edgeServer.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json({ data: server });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin"]);
  if (roleError) return roleError;

  const { id } = await params;
  const existing = await prisma.edgeServer.findUnique({ where: { id } });
  if (!existing) return Errors.notFound("Servidor Edge");

  // Verificar que no tenga cámaras activas
  const cameraCount = await prisma.camera.count({
    where: { edgeServerId: id, deletedAt: null },
  });
  if (cameraCount > 0) {
    return Errors.conflict("No se puede eliminar: tiene cámaras asociadas");
  }

  await prisma.edgeServer.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
