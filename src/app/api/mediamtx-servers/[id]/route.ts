import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";
import { Errors } from "@/lib/errors";
import { updateMediaMtxServerSchema } from "@/lib/validations/mediamtx-server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const server = await prisma.mediaMtxServer.findUnique({
    where: { id },
    include: { _count: { select: { cameras: { where: { deletedAt: null } } } } },
  });

  if (!server) return Errors.notFound("Servidor MediaMTX");

  return NextResponse.json({ data: server });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin"]);
  if (roleError) return roleError;

  const { id } = await params;
  const existing = await prisma.mediaMtxServer.findUnique({ where: { id } });
  if (!existing) return Errors.notFound("Servidor MediaMTX");

  const body = await req.json().catch(() => null);
  const parsed = updateMediaMtxServerSchema.safeParse(body);
  if (!parsed.success) return Errors.validation(parsed.error.flatten());

  const server = await prisma.mediaMtxServer.update({
    where: { id },
    data: parsed.data,
    include: { _count: { select: { cameras: { where: { deletedAt: null } } } } },
  });

  return NextResponse.json({ data: server });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin"]);
  if (roleError) return roleError;

  const { id } = await params;
  const server = await prisma.mediaMtxServer.findUnique({
    where: { id },
    include: { _count: { select: { cameras: { where: { deletedAt: null } } } } },
  });

  if (!server) return Errors.notFound("Servidor MediaMTX");

  if (server._count.cameras > 0) {
    return Errors.conflict(
      `El servidor tiene ${server._count.cameras} cámara(s) asociada(s). Desasígnalas antes de eliminar.`,
    );
  }

  await prisma.mediaMtxServer.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
