import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export const Errors = {
  unauthorized: (msg = "No autorizado") => apiError("UNAUTHORIZED", msg, 401),
  forbidden: (msg = "Acceso denegado") => apiError("FORBIDDEN", msg, 403),
  notFound: (resource = "Recurso") =>
    apiError("NOT_FOUND", `${resource} no encontrado`, 404),
  conflict: (msg: string) => apiError("CONFLICT", msg, 409),
  validation: (details: unknown) =>
    apiError("VALIDATION_ERROR", "Datos de entrada inválidos", 400, details),
  internal: (msg = "Error interno del servidor") =>
    apiError("INTERNAL_ERROR", msg, 500),
};
