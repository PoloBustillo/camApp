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

  const host = process.env.GO2RTC_PUBLIC_HOST ?? "camapp.modest-benz.50-21-179-210.plesk.page";
  const params = streamNames.map((s) => `src=${encodeURIComponent(s)}`).join("&");
  const streamUrl = `https://${host}/go2rtc/stream.html?${params}&mode=webrtc,mse,hls,mjpeg`;

  redirect(streamUrl);
}
