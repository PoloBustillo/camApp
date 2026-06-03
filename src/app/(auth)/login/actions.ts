"use server"
import { signIn } from "@/auth"
import { AuthError } from "next-auth"

export async function loginAction(
  email: string,
  password: string,
): Promise<{ error: string } | void> {
  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" })
  } catch (error) {
    // Must re-throw redirects so Next.js can handle them
    if ((error as Error).message?.includes("NEXT_REDIRECT")) throw error
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin": {
          const cause = (error as { cause?: { err?: { message?: string } } }).cause
          if (cause?.err?.message === "account_locked") {
            return { error: "Cuenta bloqueada. Intenta de nuevo en 15 minutos." }
          }
          return { error: "Credenciales inválidas. Verifica tu email y contraseña." }
        }
        default:
          return { error: "Error al iniciar sesión. Intenta de nuevo." }
      }
    }
    throw error
  }
}
