import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST() {
  const session = await auth()

  if (session?.user?.id) {
    prisma.auditLog
      .create({
        data: {
          userId: session.user.id,
          action: "user_logout",
          resourceType: "user",
          resourceId: session.user.id,
        },
      })
      .catch(() => {})
  }

  return NextResponse.json({ success: true })
}
