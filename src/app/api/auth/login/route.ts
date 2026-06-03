import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  signAccessToken,
  signRefreshToken,
  REFRESH_COOKIE_NAME,
} from "@/lib/auth";
import { Errors } from "@/lib/errors";
import { randomUUID } from "crypto";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return Errors.validation(parsed.error.flatten());
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Respuesta genérica para no revelar si el email existe
  if (!user || user.deletedAt) {
    return Errors.unauthorized("Credenciales inválidas");
  }

  if (
    user.status === "locked" &&
    user.lockedUntil &&
    user.lockedUntil > new Date()
  ) {
    return Errors.unauthorized(
      `Cuenta bloqueada. Intenta de nuevo en ${LOCKOUT_MINUTES} minutos.`,
    );
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);

  if (!passwordValid) {
    const newAttempts = user.failedAttempts + 1;
    const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: newAttempts,
        ...(shouldLock && {
          status: "locked",
          lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000),
        }),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "auth_failure",
        ipAddress: req.headers.get("x-forwarded-for") ?? null,
        metadata: { reason: "invalid_password", attempts: newAttempts },
      },
    });

    return Errors.unauthorized("Credenciales inválidas");
  }

  // Login exitoso — resetear intentos fallidos
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedAttempts: 0,
      status: "active",
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  const jti = randomUUID();
  const [accessToken] = await Promise.all([
    signAccessToken({ sub: user.id, email: user.email, role: user.role }),
    signRefreshToken({ sub: user.id, jti }),
  ]);

  const refreshToken = await signRefreshToken({ sub: user.id, jti });

  // Almacenar refresh token en BD
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      jti,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent: req.headers.get("user-agent") ?? null,
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "user_login",
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
    },
  });

  const response = NextResponse.json({
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });

  response.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/refresh",
    maxAge: 7 * 24 * 60 * 60,
  });

  return response;
}
