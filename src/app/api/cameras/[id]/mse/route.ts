import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/cameras/[id]/mse?type=sub|main
 *
 * MSE proxy: fetches MP4 fragments from go2rtc's /api/stream?src=...&mse=1
 * and pipes them to the browser for lightweight playback via MediaSource.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const streamType = (req.nextUrl.searchParams.get("type") ?? "sub") as "main" | "sub";

  const camera = await prisma.camera.findUnique({
    where: { id },
    include: { edgeServer: true },
  });

  if (!camera) {
    return NextResponse.json({ error: { message: "Cámara no encontrada" } }, { status: 404 });
  }
  if (!camera.online) {
    return NextResponse.json({ error: { message: "Cámara offline" } }, { status: 503 });
  }

  const streamPath =
    streamType === "sub"
      ? (camera.substreamPath ?? camera.mediaMtxPath)
      : camera.mediaMtxPath;

  if (!streamPath) {
    return NextResponse.json({ error: { message: "Sin ruta de stream" } }, { status: 422 });
  }

  // Resolve go2rtc host
  const internalHost = process.env.GO2RTC_INTERNAL_HOST ?? camera.edgeServer?.publicHost ?? "50.21.179.210";
  const apiPort = camera.edgeServer?.go2rtcApiPort ?? 9997;
  const mseUrl = `http://${internalHost}:${apiPort}/api/stream?src=${encodeURIComponent(streamPath)}&mse=1`;

  try {
    const upstream = await fetch(mseUrl, {
      signal: AbortSignal.timeout(15000),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: { message: `Upstream error ${upstream.status}` } },
        { status: upstream.status },
      );
    }

    if (!upstream.body) {
      return NextResponse.json({ error: { message: "No stream body" } }, { status: 500 });
    }

    // Stream the MP4 chunks directly to the browser
    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "video/mp4",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al conectar con go2rtc";
    return NextResponse.json({ error: { message: msg } }, { status: 502 });
  }
}
