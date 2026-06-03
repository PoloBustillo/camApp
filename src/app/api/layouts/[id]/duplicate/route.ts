import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { Errors } from "@/lib/errors";
import { duplicateLayoutSchema } from "@/lib/validations/layout";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/layouts/[id]/duplicate
 * Duplicates a layout with a new name.
 * Body: { name: string }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;

  const source = await prisma.layout.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(user.role !== "admin" && {
        OR: [{ ownerId: user.id }, { isShared: true }],
      }),
    },
    select: { id: true, name: true, configuration: true, isShared: true },
  });

  if (!source) return Errors.notFound("Layout");

  const body = await req.json().catch(() => null);
  const parsed = duplicateLayoutSchema.safeParse(body);
  if (!parsed.success) return Errors.validation(parsed.error.flatten());

  const copy = await prisma.layout.create({
    data: {
      name: parsed.data.name,
      configuration: source.configuration ?? undefined,
      isDefault: false,
      isShared: false,
      ownerId: user.id,
    },
    select: {
      id: true,
      name: true,
      configuration: true,
      isDefault: true,
      isShared: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "layout_duplicated",
      resourceType: "layout",
      resourceId: copy.id,
      metadata: { sourceId: source.id, sourceName: source.name },
    },
  });

  return NextResponse.json({ data: copy }, { status: 201 });
}
