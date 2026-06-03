import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";
import { encryptRtspUrl } from "@/lib/crypto";
import { Errors } from "@/lib/errors";

const createCameraSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  description: z.string().optional(),
  rtspUrl: z.string().url().startsWith("rtsp://"),
  resolution: z.string().optional(),
  codec: z.enum(["h264", "h265", "unknown"]).optional(),
  locationId: z.string().uuid().optional(),
  edgeServerId: z.string().uuid(),
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
  const locationId = searchParams.get("locationId");
  const edgeServerId = searchParams.get("edgeServerId");

  const where = {
    deletedAt: null,
    ...(locationId && { locationId }),
    ...(edgeServerId && { edgeServerId }),
  };

  const [cameras, total] = await Promise.all([
    prisma.camera.findMany({
      where,
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
        // rtspUrlEncrypted nunca se expone al cliente
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: "asc" },
    }),
    prisma.camera.count({ where }),
  ]);

  return NextResponse.json({
    data: cameras,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin"]);
  if (roleError) return roleError;

  const body = await req.json().catch(() => null);
  const parsed = createCameraSchema.safeParse(body);
  if (!parsed.success) return Errors.validation(parsed.error.flatten());

  const { rtspUrl, ...rest } = parsed.data;

  // Verificar que el slug no existe
  const existing = await prisma.camera.findFirst({
    where: { slug: rest.slug, deletedAt: null },
  });
  if (existing) return Errors.conflict(`El slug "${rest.slug}" ya está en uso`);

  const camera = await prisma.camera.create({
    data: {
      ...rest,
      codec: rest.codec ?? "unknown",
      rtspUrlEncrypted: encryptRtspUrl(rtspUrl),
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
      action: "camera_created",
      resourceType: "camera",
      resourceId: camera.id,
    },
  });

  return NextResponse.json({ data: camera }, { status: 201 });
}
