import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"

describe("crypto - encryptRtspUrl / decryptRtspUrl", () => {
  const validKey = "a".repeat(64) // 64 hex chars = 32 bytes

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = validKey
  })

  afterAll(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it("roundtrip: encrypt then decrypt returns original string", async () => {
    const { encryptRtspUrl, decryptRtspUrl } = await import("@/lib/crypto")
    const original = "rtsp://user:pass@192.168.1.100:554/stream1"

    const encrypted = encryptRtspUrl(original)
    const decrypted = decryptRtspUrl(encrypted)

    expect(decrypted).toBe(original)
  })

  it("different calls produce different ciphertext", async () => {
    const { encryptRtspUrl } = await import("@/lib/crypto")
    const url = "rtsp://camera.example.com/live"

    const enc1 = encryptRtspUrl(url)
    const enc2 = encryptRtspUrl(url)

    expect(enc1).not.toBe(enc2)
  })

  it("throws error when ENCRYPTION_KEY is missing", async () => {
    const originalKey = process.env.ENCRYPTION_KEY
    delete process.env.ENCRYPTION_KEY

    vi.resetModules()
    const { encryptRtspUrl } = await import("@/lib/crypto")

    expect(() => encryptRtspUrl("rtsp://test")).toThrow("ENCRYPTION_KEY")

    process.env.ENCRYPTION_KEY = originalKey
    vi.resetModules()
  })

  it("throws error for invalid encrypted format", async () => {
    const { decryptRtspUrl } = await import("@/lib/crypto")

    expect(() => decryptRtspUrl("invalid-format")).toThrow()
  })
})
