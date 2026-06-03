import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { Errors } from "./errors"

export type SessionUser = {
  id: string
  email: string
  name: string
  role: string
}

export async function requireAuth(): Promise<SessionUser | NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return Errors.unauthorized()
  return session.user as SessionUser
}

export function requireRole(
  user: SessionUser,
  roles: string[],
): NextResponse | null {
  if (!roles.includes(user.role)) {
    return Errors.forbidden(`Se requiere rol: ${roles.join(" o ")}`)
  }
  return null
}
