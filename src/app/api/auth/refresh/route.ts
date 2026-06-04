import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { Errors } from "@/lib/errors"

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return Errors.unauthorized()
  }

  return NextResponse.json({
    data: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    },
  })
}
