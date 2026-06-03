import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";
import { Errors } from "@/lib/errors";
import { updateSiteSchema } from "@/lib/validations/site";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;

  const site = await prisma.site.findFirst({ where: { id, deletedAt: null } });
  if (!site) return Errors.notFound("Sitio no encontrado");

  return NextResponse.json({ data: site });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin", "operator"]);
  if (roleError) return roleError;

  const { id } = await params;

  const existing = await prisma.site.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) return Errors.notFound("Sitio no encontrado");

  const body = await req.json().catch(() => null);
  const parsed = updateSiteSchema.safeParse(body);
  if (!parsed.success) return Errors.validation(parsed.error.flatten());

  if (parsed.data.name && parsed.data.name !== existing.name) {
    const duplicate = await prisma.site.findFirst({
      where: {
        name: { equals: parsed.data.name, mode: "insensitive" },
        deletedAt: null,
        id: { not: id },
      },
    });
    if (duplicate)
      return Errors.conflict(`El sitio "${parsed.data.name}" ya existe`);
  }

  const site = await prisma.site.update({
    where: { id },
    data: parsed.data,
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "site_updated",
      resourceType: "site",
      resourceId: site.id,
      metadata: { changes: parsed.data },
    },
  });

  return NextResponse.json({ data: site });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin"]);
  if (roleError) return roleError;

  const { id } = await params;

  const existing = await prisma.site.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) return Errors.notFound("Sitio no encontrado");

  await prisma.site.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "site_deleted",
      resourceType: "site",
      resourceId: id,
      metadata: { name: existing.name },
    },
  });

  return new NextResponse(null, { status: 204 });
}
