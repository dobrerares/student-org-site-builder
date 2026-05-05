import { describe, expect, test } from "vitest";
import {
  VALUE_LIST_BLOCK_VERSION,
  VALUE_LIST_ICON_NAMES,
  ValueListBlockSchema,
  isKnownBlockType,
  validateBlock,
} from "../src/index.js";

describe("valueList block schema", () => {
  test("validates a minimal valueList (just an items array)", () => {
    const block = {
      id: "blk_01",
      type: "valueList",
      version: 1,
      data: {
        items: [{ label: "Comunitate" }],
      },
    };
    const parsed = ValueListBlockSchema.safeParse(block);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // `layout` and `columns` get defaults from the schema.
      expect(parsed.data.data.layout).toBe("grid");
      expect(parsed.data.data.columns).toBe(3);
    }
  });

  test("validates a valueList with title, intro, multiple items and all options", () => {
    const block = {
      id: "blk_02",
      type: "valueList",
      version: 1,
      data: {
        title: "Valorile noastre",
        intro: "Principiile care ne ghidează activitatea.",
        items: [
          { icon: "users", label: "Comunitate", description: "Sprijinim membrii." },
          { icon: "lightbulb", label: "Curiozitate" },
          { label: "Integritate" },
        ],
        layout: "grid",
        columns: 2,
      },
    };
    expect(ValueListBlockSchema.safeParse(block).success).toBe(true);
  });

  test("rejects valueList with no items array", () => {
    const block = {
      id: "blk_03",
      type: "valueList",
      version: 1,
      data: { title: "x" },
    };
    expect(ValueListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects items missing the required label", () => {
    const block = {
      id: "blk_04",
      type: "valueList",
      version: 1,
      data: {
        items: [{ description: "no label here" }],
      },
    };
    expect(ValueListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects items with an empty-string label", () => {
    const block = {
      id: "blk_05",
      type: "valueList",
      version: 1,
      data: {
        items: [{ label: "" }],
      },
    };
    expect(ValueListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects icons outside the curated set", () => {
    const block = {
      id: "blk_06",
      type: "valueList",
      version: 1,
      data: {
        items: [{ icon: "skull-and-crossbones", label: "Bad icon" }],
      },
    };
    expect(ValueListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects layout values outside the allowed enum", () => {
    const block = {
      id: "blk_07",
      type: "valueList",
      version: 1,
      data: {
        items: [{ label: "x" }],
        layout: "carousel",
      },
    };
    expect(ValueListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects columns outside 1..4", () => {
    const block = {
      id: "blk_08",
      type: "valueList",
      version: 1,
      data: {
        items: [{ label: "x" }],
        columns: 5,
      },
    };
    expect(ValueListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("preserves unknown extra fields on data and on items (forward-compat)", () => {
    const block = {
      id: "blk_09",
      type: "valueList",
      version: 1,
      data: {
        items: [{ label: "x", futureItemField: "preserved" }],
        futureDataField: { kind: "experimental" },
      },
    };
    const parsed = ValueListBlockSchema.safeParse(block);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const data = parsed.data.data as Record<string, unknown>;
      expect(data.futureDataField).toEqual({ kind: "experimental" });
      const item = parsed.data.data.items[0] as Record<string, unknown>;
      expect(item.futureItemField).toBe("preserved");
    }
  });

  test("validateBlock surfaces severity-tiered errors", () => {
    const block = {
      id: "blk_10",
      type: "valueList",
      version: 1,
      data: { items: [{ description: "missing label" }] },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.severity).toBe("error");
  });

  test("registry exposes valueList as a known block type", () => {
    expect(isKnownBlockType("valueList")).toBe(true);
  });

  test("VALUE_LIST_BLOCK_VERSION is 1", () => {
    expect(VALUE_LIST_BLOCK_VERSION).toBe(1);
  });

  test("VALUE_LIST_ICON_NAMES is non-empty and stable in shape", () => {
    expect(VALUE_LIST_ICON_NAMES.length).toBeGreaterThan(0);
    // Every entry is kebab-case-or-single-word: lucide-style identifier.
    for (const name of VALUE_LIST_ICON_NAMES) {
      expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });
});
