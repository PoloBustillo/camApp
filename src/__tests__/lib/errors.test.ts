import { describe, it, expect } from "vitest"
import { Errors } from "@/lib/errors"

describe("Errors factory functions", () => {
  it("unauthorized() returns 401 with UNAUTHORIZED code", () => {
    const response = Errors.unauthorized()
    expect(response.status).toBe(401)
  })

  it("forbidden() returns 403 with FORBIDDEN code", () => {
    const response = Errors.forbidden()
    expect(response.status).toBe(403)
  })

  it("notFound('Cámara') returns 404 with resource name", async () => {
    const response = Errors.notFound("Cámara")
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error.message).toContain("Cámara")
    expect(body.error.code).toBe("NOT_FOUND")
  })

  it("conflict() returns 409", () => {
    const response = Errors.conflict("Ya existe")
    expect(response.status).toBe(409)
  })

  it("validation() returns 400 with VALIDATION_ERROR code", async () => {
    const response = Errors.validation({ fieldErrors: { email: ["Invalid email"] } })
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
  })

  it("internal() returns 500", () => {
    const response = Errors.internal()
    expect(response.status).toBe(500)
  })
})
