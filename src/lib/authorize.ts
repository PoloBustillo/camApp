import bcrypt from "bcryptjs"
import { CredentialsSignin } from "next-auth"
import { prisma } from "@/lib/prisma"

export class AccountLockedError extends CredentialsSignin {
  code = "account_locked" as const
}

const LOCK_AFTER_ATTEMPTS = 5
const LOCK_DURATION_MS = 15 * 60 * 1000

export async function authorizeCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || user.deletedAt) {
    prisma.auditLog.create({
      data: {
        action: "auth_failure",
        metadata: { email },
      },
    }).catch(() => {})
    return null
  }

  const now = new Date()
  if (user.status === "locked" && user.lockedUntil && user.lockedUntil > now) {
    throw new AccountLockedError()
  }

  if (user.status === "locked" && (!user.lockedUntil || user.lockedUntil <= now)) {
    await prisma.user.update({
      where: { id: user.id },
      data: { status: "active", failedAttempts: 0, lockedUntil: null },
    })
  }

  if (user.status === "inactive") {
    return null
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash)

  if (!passwordValid) {
    const newFailedAttempts = user.failedAttempts + 1
    const shouldLock = newFailedAttempts >= LOCK_AFTER_ATTEMPTS

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: newFailedAttempts,
        ...(shouldLock && {
          status: "locked",
          lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS),
        }),
      },
    })

    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "auth_failure",
        resourceType: "user",
        resourceId: user.id,
        metadata: { email: user.email, failedAttempts: newFailedAttempts },
      },
    }).catch(() => {})

    return null
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: now },
  })

  prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "user_login",
      resourceType: "user",
      resourceId: user.id,
    },
  }).catch(() => {})

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as string,
  }
}
