import { z } from "zod";

export const createSiteSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(255),
  description: z.string().max(1000).optional(),
  timezone: z.string().min(1).max(100).default("UTC"),
  active: z.boolean().default(true),
});

export const updateSiteSchema = createSiteSchema.partial();

export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
