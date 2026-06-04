import { z } from "zod";

export const createMediaMtxServerSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  baseUrl: z.string().url().max(500),
  apiUrl: z.string().url().max(500),
  description: z.string().max(1000).optional(),
  enabled: z.boolean().default(true),
});

export const updateMediaMtxServerSchema = createMediaMtxServerSchema.partial();

export const importCamerasSchema = z.object({
  serverId: z.string().uuid(),
  siteId: z.string().uuid().optional(),
  paths: z
    .array(
      z.object({
        name: z.string().min(1),
        cameraName: z.string().min(1).max(255).optional(),
      }),
    )
    .min(1)
    .max(50),
});

export type CreateMediaMtxServerInput = z.infer<typeof createMediaMtxServerSchema>;
export type UpdateMediaMtxServerInput = z.infer<typeof updateMediaMtxServerSchema>;
export type ImportCamerasInput = z.infer<typeof importCamerasSchema>;
