import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyRefreshToken,
  extractBearerToken,
  verifyAccessToken,
  REFRESH_COOKIE_NAME,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  // Revocar refresh token de la cookie
  const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (refreshToken) {
    try {
      const payload = await verifyRefreshToken(refreshToken);
      await prisma.refreshToken.updateMany({
        where: { jti: payload.jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: payload.sub,
          action: "user_logout",
          ipAddress: req.headers.get("x-forwarded-for") ?? null,
        },
      });
    } catch {
      // Token inválido — igual limpiar la cookie
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(REFRESH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/refresh",
    maxAge: 0,
  });

  return response;
}
