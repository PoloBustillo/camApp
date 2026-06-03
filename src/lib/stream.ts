import { SignJWT } from "jose"

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
