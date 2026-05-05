/**
 * Tests for the block library catalog. The catalog drives the
 * "Add Block" dialog: it lists every block type the schema knows about,
 * grouped by category, with a label and one-line description per entry.
 *
 * Crucially, the catalog is derived *dynamically* from
 * `@sosb/schema`'s `KnownBlockSchemas` registry. Adding a new block
 * to the registry causes it to appear in the catalog without further
 * code changes. Hard-coding type names is explicitly out of bounds
 * for issue #27.
 */
import { describe, expect, test } from "vitest";
import { KnownBlockSchemas } from "@sosb/schema";

import { buildBlockCatalog } from "../src/block-catalog.js";

describe("buildBlockCatalog", () => {
  test("includes one entry per known block type in the schema registry", () => {
    const catalog = buildBlockCatalog();
    const known = Object.keys(KnownBlockSchemas);

    const catalogTypes = catalog.entries.map((e) => e.type).sort();
    expect(catalogTypes).toEqual([...known].sort());
  });

  test("each entry has a non-empty label and description", () => {
    const catalog = buildBlockCatalog();
    for (const entry of catalog.entries) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  test("each entry has a category drawn from the mandatory / optional / advanced set", () => {
    const catalog = buildBlockCatalog();
    const allowed = new Set(["mandatory", "optional", "advanced"]);
    for (const entry of catalog.entries) {
      expect(allowed.has(entry.category)).toBe(true);
    }
  });

  test("groups by category with stable ordering: mandatory, optional, advanced", () => {
    const catalog = buildBlockCatalog();
    const seen = new Set<string>();
    for (const group of catalog.groups) {
      seen.add(group.category);
    }
    // Order is fixed regardless of which categories actually have members.
    expect(catalog.groups.map((g) => g.category)).toEqual(["mandatory", "optional", "advanced"]);
  });

  test("a hypothetical unknown registry entry falls back to optional + humanised label", () => {
    // Simulate an entry without explicit metadata. Since we only have
    // `hero` registered today, we test the helper used to build entries.
    const { entryFor } = buildBlockCatalog();
    const unknown = entryFor("brandNewBlock");
    expect(unknown.type).toBe("brandNewBlock");
    expect(unknown.category).toBe("optional");
    expect(unknown.label).toBe("Brand new block");
    expect(unknown.description.length).toBeGreaterThan(0);
  });
});
