import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken, extractBearerToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/refresh"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rutas públicas — pasar sin verificar
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // API routes — verificar JWT en header
  if (pathname.startsWith("/api/")) {
    const token = extractBearerToken(req.headers.get("authorization"));
    if (!token) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "No autorizado" } },
        { status: 401 },
      );
    }
    try {
      await verifyAccessToken(token);
      return NextResponse.next();
    } catch {
      return NextResponse.json(
        {
          error: { code: "UNAUTHORIZED", message: "Token inválido o expirado" },
        },
        { status: 401 },
      );
    }
  }

  // Páginas — verificar sesión via cookie (el access token lo maneja el cliente)
  // En el MVP el cliente maneja la redirección si no hay token en memoria.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
