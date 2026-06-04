import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";

// DELETE — remove specific favorite
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ cameraId: string }> },
) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { cameraId } = await params;

  await prisma.userFavorite.deleteMany({
    where: { userId: user.id, cameraId },
  });

  return NextResponse.json({ favorited: false, cameraId });
}
