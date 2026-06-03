import { describe, it, expect, vi, beforeEach } from "vitest"
import { authorizeCredentials, AccountLockedError } from "@/lib/authorize"

// Mock next-auth to avoid ESM issues with next/server in vitest
vi.mock("next-auth", () => ({
  CredentialsSignin: class CredentialsSignin extends Error {
    code = ""
    constructor() {
      super("CredentialsSignin")
    }
  },
}))

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
  },
}))

import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

const mockUser = {
  id: "user-uuid-123",
  name: "Test User",
  email: "test@example.com",
  passwordHash: "$2a$12$hashedpassword",
  role: "viewer",
  status: "active",
  failedAttempts: 0,
  lockedUntil: null,
  lastLoginAt: null,
  deletedAt: null,
}

describe("authorizeCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any)
  })

  it("returns user on valid credentials", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    const result = await authorizeCredentials("test@example.com", "validpass")

    expect(result).toEqual({
      id: mockUser.id,
      name: mockUser.name,
      email: mockUser.email,
      role: mockUser.role,
    })
  })

  it("returns null for non-existent user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const result = await authorizeCredentials("nobody@example.com", "pass")

    expect(result).toBeNull()
  })

  it("returns null for deleted user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...mockUser,
      deletedAt: new Date(),
    } as any)

    const result = await authorizeCredentials("test@example.com", "pass")

    expect(result).toBeNull()
  })

  it("returns null for invalid password and increments failedAttempts", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

    const result = await authorizeCredentials("test@example.com", "wrongpass")

    expect(result).toBeNull()
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUser.id },
      data: expect.objectContaining({ failedAttempts: 1 }),
    })
  })

  it("locks account on 5th failed attempt", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...mockUser,
      failedAttempts: 4,
    } as any)
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

    const result = await authorizeCredentials("test@example.com", "wrongpass")

    expect(result).toBeNull()
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUser.id },
      data: expect.objectContaining({
        failedAttempts: 5,
        status: "locked",
        lockedUntil: expect.any(Date),
      }),
    })
  })

  it("throws AccountLockedError for locked account within lock period", async () => {
    const futureDate = new Date(Date.now() + 10 * 60 * 1000)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...mockUser,
      status: "locked",
      lockedUntil: futureDate,
      failedAttempts: 5,
    } as any)

    await expect(
      authorizeCredentials("test@example.com", "anypass"),
    ).rejects.toThrow(AccountLockedError)
  })

  it("allows login for locked account past lock expiry", async () => {
    const pastDate = new Date(Date.now() - 60 * 1000)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...mockUser,
      status: "locked",
      lockedUntil: pastDate,
      failedAttempts: 5,
    } as any)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    const result = await authorizeCredentials("test@example.com", "validpass")

    expect(result).not.toBeNull()
    expect(result?.id).toBe(mockUser.id)
  })
})
