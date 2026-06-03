import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";
import { Errors } from "@/lib/errors";

const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "operator", "viewer"]).optional(),
  status: z.enum(["active", "inactive", "locked"]).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const authUser = await requireAuth(req);
  if (authUser instanceof NextResponse) return authUser;

  const { id } = await params;

  // Viewer/Operator solo puede ver su propio perfil
  if (authUser.role !== "admin" && authUser.sub !== id) {
    return Errors.forbidden();
  }

  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
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

  if (!user) return Errors.notFound("Usuario");
  return NextResponse.json({ data: user });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const authUser = await requireAuth(req);
  if (authUser instanceof NextResponse) return authUser;

  const roleError = requireRole(authUser, ["admin"]);
  if (roleError) return roleError;

  const { id } = await params;
  const existing = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) return Errors.notFound("Usuario");

  const body = await req.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) return Errors.validation(parsed.error.flatten());

  const user = await prisma.user.update({
    where: { id },
    data: parsed.data,
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
      userId: authUser.sub,
      action: "user_updated",
      resourceType: "user",
      resourceId: user.id,
    },
  });

  return NextResponse.json({ data: user });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const authUser = await requireAuth(req);
  if (authUser instanceof NextResponse) return authUser;

  const roleError = requireRole(authUser, ["admin"]);
  if (roleError) return roleError;

  const { id } = await params;

  // No puede eliminarse a sí mismo
  if (authUser.sub === id) {
    return Errors.forbidden("No puedes eliminar tu propia cuenta");
  }

  const existing = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) return Errors.notFound("Usuario");

  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), status: "inactive" },
  });

  await prisma.auditLog.create({
    data: {
      userId: authUser.sub,
      action: "user_deleted",
      resourceType: "user",
      resourceId: id,
    },
  });

  return new NextResponse(null, { status: 204 });
}
