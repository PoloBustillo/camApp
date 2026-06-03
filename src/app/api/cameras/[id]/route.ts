import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";
import { encryptRtspUrl } from "@/lib/crypto";
import { Errors } from "@/lib/errors";

const updateCameraSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  rtspUrl: z.string().url().startsWith("rtsp://").optional(),
  resolution: z.string().optional(),
  codec: z.enum(["h264", "h265", "unknown"]).optional(),
  locationId: z.string().uuid().nullable().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const camera = await prisma.camera.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      resolution: true,
      codec: true,
      status: true,
      lastStatusAt: true,
      locationId: true,
      edgeServerId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!camera) return Errors.notFound("Cámara");

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "camera_viewed",
      resourceType: "camera",
      resourceId: camera.id,
    },
  });

  return NextResponse.json({ data: camera });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin"]);
  if (roleError) return roleError;

  const { id } = await params;
  const existing = await prisma.camera.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) return Errors.notFound("Cámara");

  const body = await req.json().catch(() => null);
  const parsed = updateCameraSchema.safeParse(body);
  if (!parsed.success) return Errors.validation(parsed.error.flatten());

  const { rtspUrl, ...rest } = parsed.data;

  const camera = await prisma.camera.update({
    where: { id },
    data: {
      ...rest,
      ...(rtspUrl && { rtspUrlEncrypted: encryptRtspUrl(rtspUrl) }),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      resolution: true,
      codec: true,
      status: true,
      lastStatusAt: true,
      locationId: true,
      edgeServerId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "camera_updated",
      resourceType: "camera",
      resourceId: camera.id,
    },
  });

  return NextResponse.json({ data: camera });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin"]);
  if (roleError) return roleError;

  const { id } = await params;
  const existing = await prisma.camera.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) return Errors.notFound("Cámara");

  // Soft delete
  await prisma.camera.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "camera_deleted",
      resourceType: "camera",
      resourceId: id,
    },
  });

  return new NextResponse(null, { status: 204 });
}
