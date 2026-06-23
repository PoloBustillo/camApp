import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { Errors } from "@/lib/errors";

const VALID_PRESETS = new Set([
  "normal", "night", "ultra-night", "night-vision",
  "high-contrast", "grayscale", "vivid", "warm", "cool", "invert",
]);

/**
 * GET /api/user/camera-filters
 *
 * Returns camera filter settings for the current user.
 * - With ?cameraId=xxx: returns a single filter { data: PersistedFilters | null }
 * - Without params: returns all filters { data: Record<string, PersistedFilters> }
 */
export async function GET(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const cameraId = req.nextUrl.searchParams.get("cameraId");

  if (cameraId) {
    const row = await prisma.userCameraFilter.findUnique({
      where: { userId_cameraId: { userId: user.id, cameraId } },
      select: { brightness: true, contrast: true, saturation: true, preset: true },
    });
    return NextResponse.json({ data: row });
  }

  const rows = await prisma.userCameraFilter.findMany({
    where: { userId: user.id },
    select: { cameraId: true, brightness: true, contrast: true, saturation: true, preset: true },
  });

  const map: Record<string, { brightness: number; contrast: number; saturation: number; preset: string }> = {};
  for (const r of rows) {
    map[r.cameraId] = {
      brightness: r.brightness,
      contrast: r.contrast,
      saturation: r.saturation,
      preset: r.preset,
    };
  }

  return NextResponse.json({ data: map });
}

/**
 * PUT /api/user/camera-filters
 *
 * Upserts filter settings for a specific camera.
 * Body: { cameraId: string, brightness?: number, contrast?: number, saturation?: number, preset?: string }
 */
export async function PUT(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => null);
  const cameraId = body?.cameraId;

  if (typeof cameraId !== "string") {
    return Errors.validation({ cameraId: "Required string" });
  }

  const data: Record<string, unknown> = {};
  if (body.brightness !== undefined) {
    const v = Number(body.brightness);
    if (!Number.isFinite(v) || v < 0 || v > 200) return Errors.validation({ brightness: "0-200" });
    data.brightness = Math.round(v);
  }
  if (body.contrast !== undefined) {
    const v = Number(body.contrast);
    if (!Number.isFinite(v) || v < 0 || v > 200) return Errors.validation({ contrast: "0-200" });
    data.contrast = Math.round(v);
  }
  if (body.saturation !== undefined) {
    const v = Number(body.saturation);
    if (!Number.isFinite(v) || v < 0 || v > 200) return Errors.validation({ saturation: "0-200" });
    data.saturation = Math.round(v);
  }
  if (body.preset !== undefined) {
    if (typeof body.preset !== "string" || !VALID_PRESETS.has(body.preset)) {
      return Errors.validation({ preset: `Must be one of: ${[...VALID_PRESETS].join(", ")}` });
    }
    data.preset = body.preset;
  }

  if (Object.keys(data).length === 0) {
    return Errors.validation({ detail: "At least one filter field required" });
  }

  const row = await prisma.userCameraFilter.upsert({
    where: { userId_cameraId: { userId: user.id, cameraId } },
    create: { userId: user.id, cameraId, ...data },
    update: data,
    select: { brightness: true, contrast: true, saturation: true, preset: true },
  });

  return NextResponse.json({ data: row });
}

/**
 * DELETE /api/user/camera-filters?cameraId=xxx
 *
 * Deletes the filter for a specific camera.
 */
export async function DELETE(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const cameraId = req.nextUrl.searchParams.get("cameraId");
  if (!cameraId) {
    return Errors.validation({ cameraId: "Query parameter required" });
  }

  await prisma.userCameraFilter.deleteMany({
    where: { userId: user.id, cameraId },
  });

  return new NextResponse(null, { status: 204 });
}
