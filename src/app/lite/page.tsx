import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { LitePlayer } from "@/components/lite-player";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vista Lite — CamWatch" };

export default async function LitePage() {
  await requireSession();

  const cameras = await prisma.camera.findMany({
    where: { enabled: true, online: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      site: { select: { name: true } },
      substreamPath: true,
      mediaMtxPath: true,
    },
  });

  console.log(`[lite] Found ${cameras.length} online cameras`);

  return (
    <LitePlayer
      cameras={cameras.map((c) => ({
        id: c.id,
        name: c.name,
        siteName: c.site?.name ?? "",
        hasSub: !!c.substreamPath,
      }))}
    />
  );
}
