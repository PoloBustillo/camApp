import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";
import { Errors } from "@/lib/errors";
import { encryptPath } from "@/lib/crypto";
import { importCamerasSchema } from "@/lib/validations/mediamtx-server";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin", "operator"]);
  if (roleError) return roleError;

  const { id } = await params;
  const server = await prisma.mediaMtxServer.findUnique({ where: { id } });
  if (!server) return Errors.notFound("Servidor MediaMTX");

  const body = await req.json().catch(() => null);
  const parsed = importCamerasSchema.safeParse({ serverId: id, ...body });
  if (!parsed.success) return Errors.validation(parsed.error.flatten());

  const { siteId, paths } = parsed.data;

  // Validate site if provided
  if (siteId) {
    const site = await prisma.site.findFirst({
      where: { id: siteId, deletedAt: null },
    });
    if (!site) return Errors.notFound("Sitio");
  }

  // Check existing cameras for this server to avoid duplicates
  const existingPaths = await prisma.camera.findMany({
    where: {
      mediaMtxServerId: id,
      mediaMtxPath: { in: paths.map((p) => p.name) },
    },
    select: { mediaMtxPath: true },
  });
  const existingSet = new Set(existingPaths.map((c) => c.mediaMtxPath));

  const toImport = paths.filter((p) => !existingSet.has(p.name));
  const skipped = paths.length - toImport.length;

  const cameras = await Promise.all(
    toImport.map((p) =>
      prisma.camera.create({
        data: {
          name: p.cameraName ?? p.name,
          mediaMtxServerId: id,
          mediaMtxPath: p.name,
          siteId: siteId ?? null,
          pathEncrypted: encryptPath(p.name),
          protocol: "rtsp",
          enabled: true,
          online: false,
        },
        select: {
          id: true,
          name: true,
          mediaMtxServerId: true,
          mediaMtxPath: true,
          siteId: true,
          protocol: true,
          enabled: true,
          online: true,
          createdAt: true,
        },
      }),
    ),
  );

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "camera_created",
      resourceType: "mediamtx_server",
      resourceId: id,
      metadata: { imported: cameras.length, skipped, serverId: id },
    },
  });

  return NextResponse.json(
    { data: { imported: cameras.length, skipped, cameras } },
    { status: 201 },
  );
}
