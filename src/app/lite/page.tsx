import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * /lite → redirect directo a stream.html de go2rtc (puerto 9997).
 *
 * Estrategia simple: el navegador del cliente va a la página pública de go2rtc
 * que ya soporta WebRTC + MSE + HLS + MJPEG con fallback automático.
 * No proxy Next.js, no API routes, no complicaciones.
 *
 * La página stream.html de go2rtc ya funciona en TVs y celulares viejos.
 */
export default async function LitePage() {
  await requireSession();

  const heads = await headers();
  const host = heads.get("host") ?? "50.21.179.210";

  const cameras = await prisma.camera.findMany({
    where: { enabled: true, online: true },
    orderBy: { name: "asc" },
    select: { substreamPath: true, mediaMtxPath: true, name: true },
  });

  // Filtrar sub Streams (o main si no hay sub)
  const streamNames = cameras
    .map((c) => c.substreamPath ?? c.mediaMtxPath)
    .filter((s): s is string => !!s);

  // go2rtc stream.html URL con todos los sub streams
  const go2rtcHost = process.env.GO2RTC_PUBLIC_HOST ?? "50.21.179.210";
  const go2rtcPort = process.env.GO2RTC_WS_PORT ?? "9997";
  const params = streamNames.map((s) => `src=${encodeURIComponent(s)}`).join("&");
  const streamUrl = `http://${go2rtcHost}:${go2rtcPort}/stream.html?${params}&mode=webrtc,mse,hls,mjpeg`;

  console.log(`[lite] Redirecting to go2rtc stream.html with ${streamNames.length} cameras: ${streamNames.join(", ")}`);

  redirect(streamUrl);
}