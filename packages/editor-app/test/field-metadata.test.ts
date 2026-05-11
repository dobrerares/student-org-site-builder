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

  test("BLOCK_FIELD_METADATA relabels every alt-bearing block's alt field", () => {
    const ALT_BEARING_BLOCKS = [
      "hero",
      "quote",
      "imageGallery",
      "teamGrid",
      "partnerLogos",
      "ctaBanner",
    ] as const;
    for (const blockType of ALT_BEARING_BLOCKS) {
      const entries = BLOCK_FIELD_METADATA[blockType];
      expect(entries, `${blockType} should have a metadata entry`).toBeDefined();
      const altEntry = entries?.find(
        (e) => e.path.toLowerCase().endsWith("alt") || e.path.toLowerCase().endsWith("alt.alt"),
      );
      expect(
        altEntry?.label,
        `${blockType} alt-text label should be relabelled`,
      ).toBe("Image description (for screen readers)");
    }
  });

  test("every entry in both tables uses the canonical dotted path format", () => {
    // Format: a segment, then any number of (.segment | .[]) groups.
    // Catches typos like "pages[].slug" (missing dot) or "pages.0.slug"
    // (concrete index instead of wildcard) at module-load time.
    const PATH_RE = /^[a-zA-Z][a-zA-Z0-9]*(?:\.(?:\[\]|[a-zA-Z][a-zA-Z0-9]*))*$/;
    const allEntries = [
      ...SPINE_FIELD_METADATA,
      ...Object.values(BLOCK_FIELD_METADATA).flat(),
    ];
    for (const entry of allEntries) {
      expect(entry.path, `bad path: ${entry.path}`).toMatch(PATH_RE);
    }
  });
});
