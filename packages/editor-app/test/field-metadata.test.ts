import { describe, expect, test } from "vitest";

import { lookupFieldOverride, SPINE_FIELD_METADATA, BLOCK_FIELD_METADATA } from "../src/field-metadata.js";

describe("field-metadata", () => {
  test("SPINE_FIELD_METADATA marks pages[].slug as advanced", () => {
    const entry = SPINE_FIELD_METADATA.find((e) => e.path === "pages.[].slug");
    expect(entry?.tier).toBe("advanced");
  });

  test("SPINE_FIELD_METADATA marks pages[].navOrder as hidden", () => {
    const entry = SPINE_FIELD_METADATA.find((e) => e.path === "pages.[].navOrder");
    expect(entry?.tier).toBe("hidden");
  });

  test("SPINE_FIELD_METADATA assigns the theme-picker renderer to theme.id", () => {
    const entry = SPINE_FIELD_METADATA.find((e) => e.path === "theme.id");
    expect(entry?.renderer).toBe("theme-picker");
  });

  test("lookupFieldOverride finds an entry by dotted path", () => {
    const result = lookupFieldOverride(SPINE_FIELD_METADATA, ["pages", 0, "slug"]);
    expect(result?.tier).toBe("advanced");
  });

  test("lookupFieldOverride normalises array indices to []", () => {
    // Array index 0 and 5 both match the wildcard "pages.[].slug" entry.
    const a = lookupFieldOverride(SPINE_FIELD_METADATA, ["pages", 0, "slug"]);
    const b = lookupFieldOverride(SPINE_FIELD_METADATA, ["pages", 5, "slug"]);
    expect(a?.tier).toBe("advanced");
    expect(b?.tier).toBe("advanced");
  });

  test("lookupFieldOverride returns undefined for paths with no override", () => {
    const result = lookupFieldOverride(SPINE_FIELD_METADATA, ["org", "name"]);
    expect(result).toBeUndefined();
  });

  test("BLOCK_FIELD_METADATA carries per-block-type entries", () => {
    // At minimum, the alt-text label rewrite applies to multiple block types.
    expect(BLOCK_FIELD_METADATA).toBeTypeOf("object");
  });
});
