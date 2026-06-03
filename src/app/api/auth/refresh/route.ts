import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
  REFRESH_COOKIE_NAME,
} from "@/lib/auth";
import { Errors } from "@/lib/errors";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (!token) return Errors.unauthorized("Refresh token no encontrado");

  let payload;
  try {
    payload = await verifyRefreshToken(token);
  } catch {
    return Errors.unauthorized("Refresh token inválido o expirado");
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { jti: payload.jti },
    include: { user: true },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    return Errors.unauthorized("Refresh token revocado o expirado");
  }

  if (stored.user.deletedAt || stored.user.status !== "active") {
    return Errors.unauthorized("Usuario inactivo");
  }

  // Rotar: revocar el token actual y emitir uno nuevo
  const newJti = randomUUID();
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        userId: stored.userId,
        jti: newJti,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: req.headers.get("user-agent") ?? null,
        ipAddress: req.headers.get("x-forwarded-for") ?? null,
      },
    }),
  ]);

  const [accessToken, newRefreshToken] = await Promise.all([
    signAccessToken({
      sub: stored.user.id,
      email: stored.user.email,
      role: stored.user.role,
    }),
    signRefreshToken({ sub: stored.user.id, jti: newJti }),
  ]);

  const response = NextResponse.json({ accessToken });

  response.cookies.set(REFRESH_COOKIE_NAME, newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/refresh",
    maxAge: 7 * 24 * 60 * 60,
  });

  return response;
}
