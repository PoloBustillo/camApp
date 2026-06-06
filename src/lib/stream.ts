import { SignJWT, jwtVerify } from "jose"

/** Genera un token temporal (30s) para acceso a stream en MediaMTX */
export async function signStreamToken(cameraId: string, userId: string) {
  const secret = new TextEncoder().encode(
    process.env.MEDIAMTX_JWT_SECRET ?? "change-me-stream-secret",
  )
  return new SignJWT({ cameraId, userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30s")
    .sign(secret)
}

/** Verifica un token de stream y devuelve su payload */
export async function verifyStreamToken(token: string): Promise<{ cameraId: string; userId: string }> {
  const secret = new TextEncoder().encode(
    process.env.MEDIAMTX_JWT_SECRET ?? "change-me-stream-secret",
  )
  const { payload } = await jwtVerify(token, secret)
  return payload as { cameraId: string; userId: string }
}
