import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { Errors } from "@/lib/errors";

/**
 * GET /api/user/camera-order
 *
 * Returns the camera viewing order for the current user.
 * Response: { data: string[] } — array of camera IDs in display order.
 */
export async function GET() {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const rows = await prisma.userCameraOrder.findMany({
    where: { userId: user.id },
    orderBy: { position: "asc" },
    select: { cameraId: true },
  });

  return NextResponse.json({ data: rows.map((r) => r.cameraId) });
}

/**
 * PUT /api/user/camera-order
 *
 * Replaces the full camera order for the current user.
 * Body: { order: string[] } — array of camera IDs in desired display order.
 * Cameras not included are implicitly ordered after the included ones.
 */
export async function PUT(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => null);
  const order = body?.order;

  if (!Array.isArray(order) || !order.every((id): id is string => typeof id === "string")) {
    return Errors.validation({ order: "Must be an array of camera ID strings" });
  }

  // Replace the user's camera order atomically
  await prisma.$transaction([
    prisma.userCameraOrder.deleteMany({ where: { userId: user.id } }),
    prisma.userCameraOrder.createMany({
      data: order.map((cameraId, index) => ({
        userId: user.id,
        cameraId,
        position: index,
      })),
    }),
  ]);

  return NextResponse.json({ data: order });
}

/**
 * DELETE /api/user/camera-order
 *
 * Clears the user's camera order (returns to default server ordering).
 */
export async function DELETE() {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  await prisma.userCameraOrder.deleteMany({ where: { userId: user.id } });

  return new NextResponse(null, { status: 204 });
}
