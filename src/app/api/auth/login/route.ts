import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeCredentials } from "@/lib/authorize"
import { Errors } from "@/lib/errors"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) return Errors.validation(parsed.error.flatten())

  const { email, password } = parsed.data
  const user = await authorizeCredentials(email, password).catch(() => null)

  if (!user) {
    return Errors.unauthorized("Credenciales inválidas")
  }

  return NextResponse.json({ data: user })
}
