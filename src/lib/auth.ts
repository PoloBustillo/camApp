import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const ACCESS_SECRET = new TextEncoder().encode(
  process.env.JWT_ACCESS_SECRET ?? "change-me-access-secret",
);
const REFRESH_SECRET = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET ?? "change-me-refresh-secret",
);

export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL = "7d";
export const REFRESH_COOKIE_NAME = "refreshToken";

export interface AccessTokenPayload extends JWTPayload {
  sub: string; // userId
  email: string;
  role: string;
}

export interface RefreshTokenPayload extends JWTPayload {
  sub: string; // userId
  jti: string; // token ID para revocación
}

export async function signAccessToken(
  payload: Omit<AccessTokenPayload, "iat" | "exp">,
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(ACCESS_SECRET);
}

export async function signRefreshToken(
  payload: Omit<RefreshTokenPayload, "iat" | "exp">,
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(REFRESH_SECRET);
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, ACCESS_SECRET);
  return payload as AccessTokenPayload;
}

export async function verifyRefreshToken(
  token: string,
): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, REFRESH_SECRET);
  return payload as RefreshTokenPayload;
}

/** Extrae el access token del header Authorization: Bearer <token> */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

/** Genera un token temporal (30s) para acceso a stream en MediaMTX */
export async function signStreamToken(cameraId: string, userId: string) {
  const secret = new TextEncoder().encode(
    process.env.MEDIAMTX_JWT_SECRET ?? "change-me-stream-secret",
  );
  return new SignJWT({ cameraId, userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30s")
    .sign(secret);
}
