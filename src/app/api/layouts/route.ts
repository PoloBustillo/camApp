import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { Errors } from "@/lib/errors";

const GRID_SIZES: Record<string, number> = {
  single: 1,
  quad: 4,
  hexa: 6,
  nine: 9,
};

const createLayoutSchema = z.object({
  name: z.string().min(1).max(255),
  gridType: z.enum(["single", "quad", "hexa", "nine"]),
  isDefault: z.boolean().optional(),
  isShared: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get("limit") ?? 20)),
  );

  // Admin ve todos; operator/viewer solo los propios + los compartidos
  const where =
    user.role === "admin"
      ? { deletedAt: null }
      : {
          deletedAt: null,
          OR: [{ ownerId: user.id }, { isShared: true }],
        };

  const [layouts, total] = await Promise.all([
    prisma.layout.findMany({
      where,
      include: {
        cells: {
          include: {
            camera: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
              },
            },
          },
          orderBy: { position: "asc" },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: "desc" },
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

  const { gridType, isDefault, ...rest } = parsed.data;
  const cellCount = GRID_SIZES[gridType];

  // Si se marca como default, quitar el default anterior
  if (isDefault) {
    await prisma.layout.updateMany({
      where: { ownerId: user.id, isDefault: true, deletedAt: null },
      data: { isDefault: false },
    });
  }

  const layout = await prisma.layout.create({
    data: {
      ...rest,
      gridType,
      isDefault: isDefault ?? false,
      ownerId: user.id,
      cells: {
        createMany: {
          data: Array.from({ length: cellCount }, (_, i) => ({ position: i })),
        },
      },
    },
    include: {
      cells: { orderBy: { position: "asc" } },
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
