import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { Errors } from "@/lib/errors";

const updateLayoutSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  gridType: z.enum(["single", "quad", "hexa", "nine"]).optional(),
  isDefault: z.boolean().optional(),
  isShared: z.boolean().optional(),
  cells: z
    .array(
      z.object({
        position: z.number().int().min(0),
        cameraId: z.string().uuid().nullable(),
        label: z.string().max(100).optional(),
      }),
    )
    .optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

async function getLayoutOrFail(id: string, userId: string, role: string) {
  const layout = await prisma.layout.findFirst({
    where: { id, deletedAt: null },
    include: {
      cells: {
        include: {
          camera: {
            select: { id: true, name: true, slug: true, status: true },
          },
        },
        orderBy: { position: "asc" },
      },
    },
  });
  if (!layout) return null;

  // Solo el dueño o admin puede modificar
  if (role !== "admin" && layout.ownerId !== userId) return null;

  return layout;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;

  const layout = await prisma.layout.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(user.role !== "admin" && {
        OR: [{ ownerId: user.id }, { isShared: true }],
      }),
    },
    include: {
      cells: {
        include: {
          camera: {
            select: { id: true, name: true, slug: true, status: true },
          },
        },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!layout) return Errors.notFound("Layout");
  return NextResponse.json({ data: layout });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const layout = await getLayoutOrFail(id, user.id, user.role);
  if (!layout) return Errors.notFound("Layout");

  const body = await req.json().catch(() => null);
  const parsed = updateLayoutSchema.safeParse(body);
  if (!parsed.success) return Errors.validation(parsed.error.flatten());

  const { cells, isDefault, ...rest } = parsed.data;

  if (isDefault) {
    await prisma.layout.updateMany({
      where: {
        ownerId: layout.ownerId,
        isDefault: true,
        deletedAt: null,
        id: { not: id },
      },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedLayout = await tx.layout.update({
      where: { id },
      data: { ...rest, ...(isDefault !== undefined && { isDefault }) },
    });

    if (cells?.length) {
      for (const cell of cells) {
        await tx.layoutCell.updateMany({
          where: { layoutId: id, position: cell.position },
          data: { cameraId: cell.cameraId, label: cell.label ?? null },
        });
      }
    }

    return tx.layout.findUnique({
      where: { id },
      include: {
        cells: {
          include: {
            camera: {
              select: { id: true, name: true, slug: true, status: true },
            },
          },
          orderBy: { position: "asc" },
        },
      },
    });
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
  const layout = await getLayoutOrFail(id, user.id, user.role);
  if (!layout) return Errors.notFound("Layout");

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
