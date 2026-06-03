import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";
import { Errors } from "@/lib/errors";

const createUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "operator", "viewer"]),
});

export async function GET(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin"]);
  if (roleError) return roleError;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get("limit") ?? 20)),
  );

  const where = { deletedAt: null };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: "asc" },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    data: users,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin"]);
  if (roleError) return roleError;

  const body = await req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return Errors.validation(parsed.error.flatten());

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) return Errors.conflict("El email ya está registrado");

  const { password, ...userData } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);
  const newUser = await prisma.user.create({
    data: { ...userData, passwordHash },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "user_created",
      resourceType: "user",
      resourceId: newUser.id,
    },
  });

  return NextResponse.json({ data: newUser }, { status: 201 });
}
