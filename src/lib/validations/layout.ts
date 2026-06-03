import { z } from "zod";

// ─── Configuration shape ────────────────────────────────────────────
// Matches the Zustand dashboard store state (DashboardStore)

export const gridLayoutSchema = z.enum(["1x1", "2x2", "3x3", "4x4", "custom"]);

export const layoutConfigurationSchema = z.object({
  gridLayout: gridLayoutSchema,
  cellCameraIds: z.array(z.string().uuid().nullable()),
  customCols: z.number().int().min(1).max(6).optional().default(2),
  customRows: z.number().int().min(1).max(6).optional().default(2),
});

export type LayoutConfiguration = z.infer<typeof layoutConfigurationSchema>;

// ─── CRUD schemas ──────────────────────────────────────────────────

export const createLayoutSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100).trim(),
  configuration: layoutConfigurationSchema.optional(),
  isDefault: z.boolean().optional().default(false),
  isShared: z.boolean().optional().default(false),
});

export const updateLayoutSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  configuration: layoutConfigurationSchema.optional(),
  isDefault: z.boolean().optional(),
  isShared: z.boolean().optional(),
});

export const duplicateLayoutSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100).trim(),
});

export type CreateLayoutInput = z.infer<typeof createLayoutSchema>;
export type UpdateLayoutInput = z.infer<typeof updateLayoutSchema>;
export type DuplicateLayoutInput = z.infer<typeof duplicateLayoutSchema>;
