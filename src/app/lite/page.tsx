import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

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

  if (streamNames.length === 0) {
    redirect("/dashboard?msg=no-streams");
  }

  const host = process.env.GO2RTC_PUBLIC_HOST ?? "50.21.179.210";
  const port = process.env.GO2RTC_WS_PORT ?? "9997";
  const params = streamNames.map((s) => `src=${encodeURIComponent(s)}`).join("&");
  const streamUrl = `http://${host}:${port}/stream.html?${params}&mode=webrtc,mse,hls,mjpeg`;

  redirect(streamUrl);
}
