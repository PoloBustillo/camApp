import { z } from "zod";

const PROTOCOLS = ["rtsp", "rtmp", "webrtc", "hls"] as const;

export const createCameraSchema = z.object({
  siteId: z.string().uuid("siteId debe ser un UUID válido"),
  name: z.string().min(1, "Nombre requerido").max(255),
  description: z.string().max(1000).optional(),
  // path: ruta o URL completa. Puede contener credenciales → se cifra antes de almacenar
  path: z.string().min(1, "Path requerido"),
  protocol: z.enum(PROTOCOLS).default("rtsp"),
  enabled: z.boolean().default(true),
});

export const updateCameraSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  path: z.string().min(1).optional(),
  protocol: z.enum(PROTOCOLS).optional(),
  enabled: z.boolean().optional(),
  online: z.boolean().optional(),
  siteId: z.string().uuid().optional(),
});

export type CreateCameraInput = z.infer<typeof createCameraSchema>;
export type UpdateCameraInput = z.infer<typeof updateCameraSchema>;
