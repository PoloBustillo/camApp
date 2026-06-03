import { describe, it, expect } from "vitest";
import { createCameraSchema, updateCameraSchema } from "@/lib/validations/camera";

describe("createCameraSchema", () => {
  const validInput = {
    siteId: "550e8400-e29b-41d4-a716-446655440000",
    name: "Cámara Entrada",
    path: "rtsp://admin:pass@192.168.1.100:554/stream",
    protocol: "rtsp" as const,
    enabled: true,
  };

  it("validates a complete valid camera", () => {
    const result = createCameraSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("defaults protocol to rtsp", () => {
    const { protocol: _, ...rest } = validInput;
    const result = createCameraSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.protocol).toBe("rtsp");
  });

  it("defaults enabled to true", () => {
    const { enabled: _, ...rest } = validInput;
    const result = createCameraSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.enabled).toBe(true);
  });

  it("rejects invalid siteId (not UUID)", () => {
    const result = createCameraSchema.safeParse({ ...validInput, siteId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createCameraSchema.safeParse({ ...validInput, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name over 255 chars", () => {
    const result = createCameraSchema.safeParse({ ...validInput, name: "A".repeat(256) });
    expect(result.success).toBe(false);
  });

  it("rejects empty path", () => {
    const result = createCameraSchema.safeParse({ ...validInput, path: "" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid protocols", () => {
    for (const protocol of ["rtsp", "rtmp", "webrtc", "hls"] as const) {
      const result = createCameraSchema.safeParse({ ...validInput, protocol });
      expect(result.success).toBe(true);
    }
  });

  it("rejects unknown protocol", () => {
    const result = createCameraSchema.safeParse({ ...validInput, protocol: "ftp" });
    expect(result.success).toBe(false);
  });

  it("accepts optional description", () => {
    const result = createCameraSchema.safeParse({ ...validInput, description: "Mi cámara" });
    expect(result.success).toBe(true);
  });

  it("rejects description over 1000 chars", () => {
    const result = createCameraSchema.safeParse({ ...validInput, description: "X".repeat(1001) });
    expect(result.success).toBe(false);
  });
});

describe("updateCameraSchema", () => {
  it("all fields are optional", () => {
    expect(updateCameraSchema.safeParse({}).success).toBe(true);
  });

  it("validates partial update with name only", () => {
    const result = updateCameraSchema.safeParse({ name: "Nueva cámara" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Nueva cámara");
      expect(result.data.protocol).toBeUndefined();
    }
  });

  it("can update online status", () => {
    const result = updateCameraSchema.safeParse({ online: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.online).toBe(true);
  });

  it("can disable a camera", () => {
    const result = updateCameraSchema.safeParse({ enabled: false });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.enabled).toBe(false);
  });

  it("rejects empty name if provided", () => {
    expect(updateCameraSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("validates siteId change", () => {
    const result = updateCameraSchema.safeParse({ siteId: "550e8400-e29b-41d4-a716-446655440001" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid siteId if provided", () => {
    expect(updateCameraSchema.safeParse({ siteId: "invalid" }).success).toBe(false);
  });
});
