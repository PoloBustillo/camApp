"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { createSiteSchema, updateSiteSchema } from "@/lib/validations/site";

type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

export async function createSiteAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  const user = session.user;
  if (user.role === "viewer") return { success: false, error: "Sin permisos" };

  const parsed = createSiteSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    timezone: formData.get("timezone") || "UTC",
    active: formData.get("active") !== "false",
  });

  if (!parsed.success) {
    return {
      success: false,
      error: Object.values(parsed.error.flatten().fieldErrors)
        .flat()
        .join(", "),
    };
  }

  const existing = await prisma.site.findFirst({
    where: {
      name: { equals: parsed.data.name, mode: "insensitive" },
      deletedAt: null,
    },
  });
  if (existing)
    return {
      success: false,
      error: `El sitio "${parsed.data.name}" ya existe`,
    };

  const site = await prisma.site.create({ data: parsed.data });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "site_created",
      resourceType: "site",
      resourceId: site.id,
      metadata: { name: site.name },
    },
  });

  revalidatePath("/sites");
  return { success: true, id: site.id };
}

export async function updateSiteAction(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  const user = session.user;
  if (user.role === "viewer") return { success: false, error: "Sin permisos" };

  const parsed = updateSiteSchema.safeParse({
    name: formData.get("name") || undefined,
    description: formData.get("description") || undefined,
    timezone: formData.get("timezone") || undefined,
    active: formData.has("active")
      ? formData.get("active") !== "false"
      : undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: Object.values(parsed.error.flatten().fieldErrors)
        .flat()
        .join(", "),
    };
  }

  const existing = await prisma.site.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) return { success: false, error: "Sitio no encontrado" };

  if (parsed.data.name && parsed.data.name !== existing.name) {
    const duplicate = await prisma.site.findFirst({
      where: {
        name: { equals: parsed.data.name, mode: "insensitive" },
        deletedAt: null,
        id: { not: id },
      },
    });
    if (duplicate)
      return {
        success: false,
        error: `El sitio "${parsed.data.name}" ya existe`,
      };
  }

  const site = await prisma.site.update({ where: { id }, data: parsed.data });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "site_updated",
      resourceType: "site",
      resourceId: site.id,
      metadata: { changes: parsed.data },
    },
  });

  revalidatePath("/sites");
  return { success: true };
}

export async function deleteSiteAction(id: string): Promise<ActionResult> {
  const session = await requireSession();
  const user = session.user;
  if (user.role !== "admin")
    return { success: false, error: "Solo admins pueden eliminar sitios" };

  const existing = await prisma.site.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) return { success: false, error: "Sitio no encontrado" };

  await prisma.site.update({ where: { id }, data: { deletedAt: new Date() } });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "site_deleted",
      resourceType: "site",
      resourceId: id,
      metadata: { name: existing.name },
    },
  });

  revalidatePath("/sites");
  return { success: true };
}
