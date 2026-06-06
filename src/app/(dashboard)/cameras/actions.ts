"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { encryptPath } from "@/lib/crypto";
import { createCameraSchema, updateCameraSchema } from "@/lib/validations/camera";

type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

export async function createCameraAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const user = session.user;
  if (user.role === "viewer") return { success: false, error: "Sin permisos" };

  const siteId = formData.get("siteId");
  const parsed = createCameraSchema.safeParse({
    siteId: siteId && String(siteId) !== "" ? siteId : undefined,
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    path: formData.get("path"),
    protocol: formData.get("protocol") || "rtsp",
    enabled: formData.get("enabled") !== "false",
  });

  if (!parsed.success) {
    return { success: false, error: Object.values(parsed.error.flatten().fieldErrors).flat().join(", ") };
  }

  const { path, siteId: optionalSiteId, ...rest } = parsed.data;
  const camera = await prisma.camera.create({
    data: {
      ...rest,
      ...(optionalSiteId ? { siteId: optionalSiteId } : {}),
      pathEncrypted: encryptPath(path),
    },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "camera_created", resourceType: "camera", resourceId: camera.id, metadata: { name: camera.name } },
  });

  revalidatePath("/cameras");
  return { success: true, id: camera.id };
}

export async function updateCameraAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const user = session.user;
  if (user.role === "viewer") return { success: false, error: "Sin permisos" };

  const existing = await prisma.camera.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Cámara no encontrada" };

  const parsed = updateCameraSchema.safeParse({
    siteId: formData.get("siteId") || undefined,
    name: formData.get("name") || undefined,
    description: formData.get("description") || undefined,
    path: formData.get("path") || undefined,
    protocol: formData.get("protocol") || undefined,
    enabled: formData.has("enabled") ? formData.get("enabled") !== "false" : undefined,
  });

  if (!parsed.success) {
    return { success: false, error: Object.values(parsed.error.flatten().fieldErrors).flat().join(", ") };
  }

  const { path, ...rest } = parsed.data;
  await prisma.camera.update({
    where: { id },
    data: { ...rest, ...(path && { pathEncrypted: encryptPath(path) }) },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "camera_updated", resourceType: "camera", resourceId: id },
  });

  revalidatePath("/cameras");
  return { success: true };
}

export async function deleteCameraAction(id: string): Promise<ActionResult> {
  const session = await requireSession();
  const user = session.user;
  if (user.role === "viewer") return { success: false, error: "Sin permisos" };

  const existing = await prisma.camera.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Cámara no encontrada" };

  await prisma.camera.delete({ where: { id } });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "camera_deleted", resourceType: "camera", resourceId: id, metadata: { name: existing.name } },
  });

  revalidatePath("/cameras");
  return { success: true };
}
