import { auth } from "@/auth"
import { redirect } from "next/navigation"

export async function getSession() {
  return auth()
}

export async function requireSession() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  return session
}

export type SessionUser = {
  id: string
  name: string
  email: string
  role: string
}

export function isAdmin(user: SessionUser) {
  return user.role === "admin"
}

export function isOperator(user: SessionUser) {
  return user.role === "operator" || user.role === "admin"
}

export function isViewer(_user: SessionUser) {
  return true
}
