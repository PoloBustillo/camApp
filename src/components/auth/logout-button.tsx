"use client"
import { signOut } from "next-auth/react"

export function LogoutButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={className ?? "text-sm text-muted-foreground hover:text-foreground transition-colors"}
    >
      Cerrar sesión
    </button>
  )
}
