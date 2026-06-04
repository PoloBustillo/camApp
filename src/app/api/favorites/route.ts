import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";

// GET — returns list of camera IDs favorited by current user
export async function GET() {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const favorites = await prisma.userFavorite.findMany({
    where: { userId: user.id },
    select: { cameraId: true },
  });

  return NextResponse.json({ data: favorites.map((f) => f.cameraId) });
}

// POST — toggles favorite for cameraId in body
export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => ({}));
  const { cameraId } = body as { cameraId?: string };

  if (!cameraId || typeof cameraId !== "string") {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "cameraId is required" } },
      { status: 400 },
    );
  }

  const existing = await prisma.userFavorite.findUnique({
    where: { userId_cameraId: { userId: user.id, cameraId } },
  });

  if (existing) {
    await prisma.userFavorite.delete({
      where: { userId_cameraId: { userId: user.id, cameraId } },
    });
    return NextResponse.json({ favorited: false, cameraId });
  }

  await prisma.userFavorite.create({
    data: { userId: user.id, cameraId },
  });
  return NextResponse.json({ favorited: true, cameraId });
}
