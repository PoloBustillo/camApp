import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { SiteList } from "./site-list";

export const metadata: Metadata = { title: "Sitios — CamWatch" };

export default async function SitesPage() {
  await requireSession();

  const sites = await prisma.site.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sitios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administra las ubicaciones de la plataforma
          </p>
        </div>
      </div>
      <SiteList sites={sites} />
    </div>
  );
}
