import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { Errors } from "@/lib/errors";
import { updateLayoutSchema } from "@/lib/validations/layout";

type RouteParams = { params: Promise<{ id: string }> };

const LAYOUT_SELECT = {
  id: true,
  name: true,
  configuration: true,
  isDefault: true,
  isShared: true,
  ownerId: true,
  owner: { select: { name: true, email: true } },
  createdAt: true,
  updatedAt: true,
} as const;

async function getLayoutOrFail(id: string, userId: string, role: string) {
  const layout = await prisma.layout.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(role !== "admin" && {
        OR: [{ ownerId: userId }, { isShared: true }],
      }),
    },
    select: { ...LAYOUT_SELECT, ownerId: true },
  });
  if (!layout) return null;
  return layout;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const layout = await getLayoutOrFail(id, user.id, user.role);
  if (!layout) return Errors.notFound("Layout");

  return NextResponse.json({ data: layout });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;

  const existing = await prisma.layout.findFirst({
    where: { id, deletedAt: null },
    select: { ownerId: true },
  });
  if (!existing) return Errors.notFound("Layout");
  if (user.role !== "admin" && existing.ownerId !== user.id) {
    return Errors.forbidden("No tienes permiso para editar este layout");
  }

  const body = await req.json().catch(() => null);
  const parsed = updateLayoutSchema.safeParse(body);
  if (!parsed.success) return Errors.validation(parsed.error.flatten());

  const { isDefault, ...rest } = parsed.data;

  if (isDefault) {
    await prisma.layout.updateMany({
      where: {
        ownerId: existing.ownerId,
        isDefault: true,
        deletedAt: null,
        id: { not: id },
      },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.layout.update({
    where: { id },
    data: { ...rest, ...(isDefault !== undefined && { isDefault }) },
    select: LAYOUT_SELECT,
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "layout_updated",
      resourceType: "layout",
      resourceId: id,
    },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;

  const existing = await prisma.layout.findFirst({
    where: { id, deletedAt: null },
    select: { ownerId: true },
  });
  if (!existing) return Errors.notFound("Layout");
  if (user.role !== "admin" && existing.ownerId !== user.id) {
    return Errors.forbidden("No tienes permiso para eliminar este layout");
  }

  await prisma.layout.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "layout_deleted",
      resourceType: "layout",
      resourceId: id,
    },
  });

  return new NextResponse(null, { status: 204 });
}
