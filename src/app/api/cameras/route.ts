import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";
import { encryptPath } from "@/lib/crypto";
import { Errors } from "@/lib/errors";
import { createCameraSchema } from "@/lib/validations/camera";

export async function GET(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get("limit") ?? 20)),
  );
  const siteId = searchParams.get("siteId");
  const protocol = searchParams.get("protocol");
  const enabled = searchParams.get("enabled");
  const online = searchParams.get("online");
  const search = searchParams.get("search")?.trim();

  const where = {
    ...(siteId && { siteId }),
    ...(protocol && {
      protocol: protocol as "rtsp" | "rtmp" | "webrtc" | "hls",
    }),
    ...(enabled !== null &&
      enabled !== undefined && { enabled: enabled === "true" }),
    ...(online !== null &&
      online !== undefined && { online: online === "true" }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [cameras, total] = await Promise.all([
    prisma.camera.findMany({
      where,
      select: {
        id: true,
        siteId: true,
        name: true,
        description: true,
        protocol: true,
        enabled: true,
        online: true,
        createdAt: true,
        updatedAt: true,
        mediaMtxPath: true,
        substreamPath: true,
        edgeServerId: true,
        site: { select: { id: true, name: true } },
        // pathEncrypted nunca se expone al cliente
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: "asc" },
    }),
    prisma.camera.count({ where }),
  ]);

  return NextResponse.json({
    data: cameras.map((c) => ({
      ...c,
      streamName: c.mediaMtxPath ?? null,
      substreamName: c.substreamPath ?? null,
      siteName: c.site?.name ?? "",
      edgeServerId: c.edgeServerId ?? null,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin", "operator"]);
  if (roleError) return roleError;

  const body = await req.json().catch(() => null);
  const parsed = createCameraSchema.safeParse(body);
  if (!parsed.success) return Errors.validation(parsed.error.flatten());

  const { path, ...rest } = parsed.data;

  // Verificar que el sitio existe
  const site = await prisma.site.findFirst({
    where: { id: rest.siteId, deletedAt: null },
  });
  if (!site) return Errors.notFound("Sitio no encontrado");

  const camera = await prisma.camera.create({
    data: {
      ...rest,
      pathEncrypted: encryptPath(path),
    },
    select: {
      id: true,
      siteId: true,
      name: true,
      description: true,
      protocol: true,
      enabled: true,
      online: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "camera_created",
      resourceType: "camera",
      resourceId: camera.id,
      metadata: { name: camera.name, siteId: camera.siteId },
    },
  });

  return NextResponse.json({ data: camera }, { status: 201 });
}
