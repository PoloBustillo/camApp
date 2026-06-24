import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";
import { encryptPath, decryptPath } from "@/lib/crypto";
import { Errors } from "@/lib/errors";
import { updateCameraSchema } from "@/lib/validations/camera";

type Params = { params: Promise<{ id: string }> };

const cameraSelect = {
  id: true,
  siteId: true,
  name: true,
  description: true,
  protocol: true,
  enabled: true,
  online: true,
  createdAt: true,
  updatedAt: true,
  site: { select: { id: true, name: true } },
};

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const camera = await prisma.camera.findUnique({
    where: { id },
    select: cameraSelect,
  });

  if (!camera) return Errors.notFound("Cámara no encontrada");

  prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "camera_viewed",
      resourceType: "camera",
      resourceId: id,
    },
  }).catch(() => {});

  return NextResponse.json({ data: camera });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin", "operator"]);
  if (roleError) return roleError;

  const { id } = await params;
  const existing = await prisma.camera.findUnique({ where: { id } });
  if (!existing) return Errors.notFound("Cámara no encontrada");

  const body = await req.json().catch(() => null);
  const parsed = updateCameraSchema.safeParse(body);
  if (!parsed.success) return Errors.validation(parsed.error.flatten());

  const { path, ...rest } = parsed.data;

  if (rest.siteId) {
    const site = await prisma.site.findFirst({
      where: { id: rest.siteId, deletedAt: null },
    });
    if (!site) return Errors.notFound("Sitio no encontrado");
  }

  const camera = await prisma.camera.update({
    where: { id },
    data: {
      ...rest,
      ...(path && { pathEncrypted: encryptPath(path) }),
    },
    select: cameraSelect,
  });

  prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "camera_updated",
      resourceType: "camera",
      resourceId: id,
      metadata: { changes: { ...rest, pathChanged: !!path } },
    },
  }).catch(() => {});

  return NextResponse.json({ data: camera });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin"]);
  if (roleError) return roleError;

  const { id } = await params;
  const existing = await prisma.camera.findUnique({ where: { id } });
  if (!existing) return Errors.notFound("Cámara no encontrada");

  await prisma.camera.delete({ where: { id } });

  prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "camera_deleted",
      resourceType: "camera",
      resourceId: id,
      metadata: { name: existing.name },
    },
  }).catch(() => {});

  return new NextResponse(null, { status: 204 });
}
