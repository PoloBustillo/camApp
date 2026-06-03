import { describe, it, expect } from "vitest";
import {
  layoutConfigurationSchema,
  createLayoutSchema,
  updateLayoutSchema,
  duplicateLayoutSchema,
} from "@/lib/validations/layout";

// ─── layoutConfigurationSchema ───────────────────────────────────────────────

describe("layoutConfigurationSchema", () => {
  it("accepts a valid 2x2 configuration", () => {
    const cfg = {
      gridLayout: "2x2",
      cellCameraIds: [
        "550e8400-e29b-41d4-a716-446655440001",
        "550e8400-e29b-41d4-a716-446655440002",
        null,
        null,
      ],
      customCols: 2,
      customRows: 2,
    };
    expect(() => layoutConfigurationSchema.parse(cfg)).not.toThrow();
  });

  it("accepts custom layout configuration", () => {
    const cfg = {
      gridLayout: "custom",
      cellCameraIds: [null, null, null, null, null, null],
      customCols: 3,
      customRows: 2,
    };
    const result = layoutConfigurationSchema.parse(cfg);
    expect(result.gridLayout).toBe("custom");
    expect(result.customCols).toBe(3);
  });

  it("rejects unknown gridLayout values", () => {
    const cfg = {
      gridLayout: "5x5",
      cellCameraIds: [],
      customCols: 5,
      customRows: 5,
    };
    expect(() => layoutConfigurationSchema.parse(cfg)).toThrow();
  });

  it("rejects customCols outside 1-6 range", () => {
    const cfg = {
      gridLayout: "custom",
      cellCameraIds: [],
      customCols: 0,
      customRows: 2,
    };
    expect(() => layoutConfigurationSchema.parse(cfg)).toThrow();
  });

  it("rejects customRows outside 1-6 range", () => {
    const cfg = {
      gridLayout: "custom",
      cellCameraIds: [],
      customCols: 2,
      customRows: 7,
    };
    expect(() => layoutConfigurationSchema.parse(cfg)).toThrow();
  });

  it("allows null entries in cellCameraIds", () => {
    const cfg = {
      gridLayout: "1x1",
      cellCameraIds: [null],
      customCols: 1,
      customRows: 1,
    };
    const result = layoutConfigurationSchema.parse(cfg);
    expect(result.cellCameraIds).toEqual([null]);
  });
});

// ─── createLayoutSchema ───────────────────────────────────────────────────────

describe("createLayoutSchema", () => {
  const validConfig = {
    gridLayout: "2x2",
    cellCameraIds: [null, null, null, null],
    customCols: 2,
    customRows: 2,
  };

  it("accepts a valid create payload with configuration", () => {
    const payload = { name: "My layout", configuration: validConfig };
    const result = createLayoutSchema.parse(payload);
    expect(result.name).toBe("My layout");
  });

  it("trims whitespace from name", () => {
    const payload = { name: "  My layout  ", configuration: validConfig };
    const result = createLayoutSchema.parse(payload);
    expect(result.name).toBe("My layout");
  });

  it("rejects empty name", () => {
    const payload = { name: "", configuration: validConfig };
    expect(() => createLayoutSchema.parse(payload)).toThrow();
  });

  it("rejects name longer than 100 characters", () => {
    const payload = { name: "a".repeat(101), configuration: validConfig };
    expect(() => createLayoutSchema.parse(payload)).toThrow();
  });

  it("accepts payload without configuration (optional)", () => {
    const payload = { name: "Layout without config" };
    expect(() => createLayoutSchema.parse(payload)).not.toThrow();
  });

  it("defaults isDefault to false", () => {
    const payload = { name: "Test" };
    const result = createLayoutSchema.parse(payload);
    expect(result.isDefault).toBe(false);
  });

  it("defaults isShared to false", () => {
    const payload = { name: "Test" };
    const result = createLayoutSchema.parse(payload);
    expect(result.isShared).toBe(false);
  });

  it("accepts isDefault: true", () => {
    const payload = { name: "Default layout", isDefault: true };
    const result = createLayoutSchema.parse(payload);
    expect(result.isDefault).toBe(true);
  });
});

// ─── updateLayoutSchema ───────────────────────────────────────────────────────

describe("updateLayoutSchema", () => {
  it("accepts a partial update with only name", () => {
    const payload = { name: "New name" };
    expect(() => updateLayoutSchema.parse(payload)).not.toThrow();
  });

  it("accepts an empty object (all fields optional)", () => {
    expect(() => updateLayoutSchema.parse({})).not.toThrow();
  });

  it("rejects empty string name", () => {
    expect(() => updateLayoutSchema.parse({ name: "" })).toThrow();
  });

  it("accepts updating isShared", () => {
    const result = updateLayoutSchema.parse({ isShared: true });
    expect(result.isShared).toBe(true);
  });

  it("accepts updating configuration", () => {
    const cfg = {
      gridLayout: "4x4",
      cellCameraIds: new Array(16).fill(null),
      customCols: 4,
      customRows: 4,
    };
    const result = updateLayoutSchema.parse({ configuration: cfg });
    expect(result.configuration?.gridLayout).toBe("4x4");
  });
});

// ─── duplicateLayoutSchema ────────────────────────────────────────────────────

describe("duplicateLayoutSchema", () => {
  it("accepts a valid name", () => {
    const result = duplicateLayoutSchema.parse({ name: "Copy of layout" });
    expect(result.name).toBe("Copy of layout");
  });

  it("trims whitespace", () => {
    const result = duplicateLayoutSchema.parse({ name: "  Copy  " });
    expect(result.name).toBe("Copy");
  });

  it("rejects empty name", () => {
    expect(() => duplicateLayoutSchema.parse({ name: "" })).toThrow();
  });

  it("rejects name over 100 chars", () => {
    expect(() => duplicateLayoutSchema.parse({ name: "a".repeat(101) })).toThrow();
  });
});
