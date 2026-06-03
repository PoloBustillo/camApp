import { NextRequest } from "next/server";
import {
  verifyAccessToken,
  extractBearerToken,
  type AccessTokenPayload,
} from "./auth";
import { Errors } from "./errors";

export interface AuthenticatedRequest {
  user: AccessTokenPayload;
}

/**
 * Verifica el JWT del request y retorna el payload.
 * Lanza una NextResponse de error si no está autenticado.
 */
export async function requireAuth(
  req: NextRequest,
): Promise<AccessTokenPayload | ReturnType<typeof Errors.unauthorized>> {
  const token = extractBearerToken(req.headers.get("authorization"));
  if (!token) return Errors.unauthorized();

  try {
    return await verifyAccessToken(token);
  } catch {
    return Errors.unauthorized("Token inválido o expirado");
  }
}

/**
 * Verifica que el usuario tenga uno de los roles requeridos.
 */
export function requireRole(
  user: AccessTokenPayload,
  roles: string[],
): ReturnType<typeof Errors.forbidden> | null {
  if (!roles.includes(user.role)) {
    return Errors.forbidden(`Se requiere rol: ${roles.join(" o ")}`);
  }
  return null;
}
