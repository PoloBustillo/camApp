import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { Errors } from "@/lib/errors";
import { createLayoutSchema } from "@/lib/validations/layout";

export async function GET(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));

  const where =
    user.role === "admin"
      ? { deletedAt: null }
      : { deletedAt: null, OR: [{ ownerId: user.id }, { isShared: true }] };

  const [layouts, total] = await Promise.all([
    prisma.layout.findMany({
      where,
      select: {
        id: true,
        name: true,
        configuration: true,
        isDefault: true,
        isShared: true,
        ownerId: true,
        owner: { select: { name: true, email: true } },
        createdAt: true,
        updatedAt: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.layout.count({ where }),
  ]);

  return NextResponse.json({
    data: layouts,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => null);
  const parsed = createLayoutSchema.safeParse(body);
  if (!parsed.success) return Errors.validation(parsed.error.flatten());

  const { isDefault, ...data } = parsed.data;

  if (isDefault) {
    await prisma.layout.updateMany({
      where: { ownerId: user.id, isDefault: true, deletedAt: null },
      data: { isDefault: false },
    });
  }

  const layout = await prisma.layout.create({
    data: {
      name: data.name,
      configuration: data.configuration,
      isDefault: isDefault ?? false,
      isShared: data.isShared ?? false,
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
      action: "layout_created",
      resourceType: "layout",
      resourceId: layout.id,
    },
  });

  return NextResponse.json({ data: layout }, { status: 201 });
}
