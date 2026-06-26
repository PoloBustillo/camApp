import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * /lite → redirect directo a stream.html de go2rtc (puerto 9997).
 * stream.html soporta WebRTC+MSE+HLS+MJPEG con fallback automático.
 */
export default async function LitePage() {
  await requireSession();

  const cameras = await prisma.camera.findMany({
    where: { enabled: true, online: true },
    orderBy: { name: "asc" },
    select: { substreamPath: true, mediaMtxPath: true, name: true },
  });

  const streamNames = cameras
    .map((c) => c.substreamPath ?? c.mediaMtxPath)
    .filter((s): s is string => !!s);

  const go2rtcHost = process.env.GO2RTC_PUBLIC_HOST ?? "50.21.179.210";
  const go2rtcPort = process.env.GO2RTC_WS_PORT ?? "9997";
  const params = streamNames.map((s) => `src=${encodeURIComponent(s)}`).join("&");
  const streamUrl = `http://${go2rtcHost}:${go2rtcPort}/stream.html?${params}&mode=webrtc,mse,hls,mjpeg`;

  redirect(streamUrl);
}