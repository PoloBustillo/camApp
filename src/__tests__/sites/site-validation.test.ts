import { describe, it, expect, beforeEach } from "vitest";
import { createSiteSchema, updateSiteSchema } from "@/lib/validations/site";

describe("createSiteSchema", () => {
  it("validates a complete valid site", () => {
    const result = createSiteSchema.safeParse({
      name: "Edificio Principal",
      description: "Sede central",
      timezone: "America/Mexico_City",
      active: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Edificio Principal");
      expect(result.data.timezone).toBe("America/Mexico_City");
    }
  });

  it("uses UTC as default timezone", () => {
    const result = createSiteSchema.safeParse({ name: "Sitio A" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.timezone).toBe("UTC");
  });

  it("uses true as default active", () => {
    const result = createSiteSchema.safeParse({ name: "Sitio A" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.active).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createSiteSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 255 chars", () => {
    const result = createSiteSchema.safeParse({ name: "A".repeat(256) });
    expect(result.success).toBe(false);
  });

  it("rejects description longer than 1000 chars", () => {
    const result = createSiteSchema.safeParse({
      name: "Sitio A",
      description: "X".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it("allows optional description", () => {
    const result = createSiteSchema.safeParse({ name: "Sitio B" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBeUndefined();
  });

  it("allows active: false", () => {
    const result = createSiteSchema.safeParse({
      name: "Sitio C",
      active: false,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.active).toBe(false);
  });
});

describe("updateSiteSchema", () => {
  it("all fields are optional", () => {
    const result = updateSiteSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("validates partial update with only name", () => {
    const result = updateSiteSchema.safeParse({ name: "Nuevo nombre" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Nuevo nombre");
      expect(result.data.timezone).toBeUndefined();
    }
  });

  it("rejects empty name if provided", () => {
    const result = updateSiteSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("validates only timezone update", () => {
    const result = updateSiteSchema.safeParse({ timezone: "Europe/Madrid" });
    expect(result.success).toBe(true);
  });

  it("validates deactivating a site", () => {
    const result = updateSiteSchema.safeParse({ active: false });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.active).toBe(false);
  });
});
