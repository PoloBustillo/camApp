import { describe, it, expect } from "vitest"

function jwtCallback({ token, user }: { token: Record<string, unknown>; user?: { id: string; role: string } }) {
  if (user) {
    token.id = user.id
    token.role = user.role
  }
  return token
}

function sessionCallback({
  session,
  token,
}: {
  session: { user: Record<string, unknown> }
  token: { id: string; role: string }
}) {
  session.user.id = token.id
  session.user.role = token.role
  return session
}

describe("JWT callback", () => {
  it("adds id and role to token when user is present", () => {
    const token = { name: "Test User" }
    const user = { id: "user-123", role: "admin" }

    const result = jwtCallback({ token, user })

    expect(result.id).toBe("user-123")
    expect(result.role).toBe("admin")
  })

  it("returns token unchanged when no user", () => {
    const token = { id: "existing-id", role: "viewer", name: "Test" }

    const result = jwtCallback({ token })

    expect(result).toEqual(token)
  })
})

describe("Session callback", () => {
  it("maps token.id and token.role to session.user", () => {
    const session = { user: { name: "Test", email: "test@test.com" } }
    const token = { id: "user-123", role: "operator" }

    const result = sessionCallback({ session, token })

    expect(result.user.id).toBe("user-123")
    expect(result.user.role).toBe("operator")
  })
})
