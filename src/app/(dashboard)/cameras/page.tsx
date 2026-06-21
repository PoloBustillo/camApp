import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession, isAdmin, isOperator } from "@/lib/session";
import { redirect } from "next/navigation";
import { CameraPageClient } from "./camera-page-client";

export const metadata: Metadata = { title: "Proveedores — CamWatch" };

export default async function CamerasPage() {
  const session = await requireSession();
  if (!(isAdmin(session.user) || isOperator(session.user))) redirect("/dashboard");

  const [cameras, servers] = await Promise.all([
    prisma.camera.findMany({
      orderBy: { name: "asc" },
      include: {
        mediaMtxServer: { select: { id: true, name: true } },
      },
    }),
    prisma.mediaMtxServer.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { cameras: true } } },
    }),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Proveedores</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecta servidores MediaMTX o go2rtc y agrega cámaras
        </p>
      </div>
      <CameraPageClient cameras={cameras} servers={servers} />
    </div>
  );
}
