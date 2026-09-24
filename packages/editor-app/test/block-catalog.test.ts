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

import { buildCustomBlockRegistry, parseCustomBlockDeclaration } from "@sosb/schema";

import { buildBlockCatalog } from "../src/block-catalog.js";
import { PARTNERS_DECLARATION } from "./fixtures/partners-package.js";

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

  test("exclude hides types from entries and groups but not from entryFor", () => {
    const catalog = buildBlockCatalog({ exclude: ["articleList", "siteFooter"] });
    const types = catalog.entries.map((entry) => entry.type);
    expect(types).not.toContain("articleList");
    expect(types).not.toContain("siteFooter");
    for (const group of catalog.groups) {
      expect(group.entries.map((entry) => entry.type)).not.toContain("articleList");
    }
    // An excluded type can still exist in a project, so its row still needs a
    // label in the Inspector.
    expect(catalog.entryFor("articleList").label).toBe("Article list");
  });

  test("no exclude list leaves every registry type visible", () => {
    expect(buildBlockCatalog().entries.map((entry) => entry.type)).toContain("articleList");
  });
});

describe("buildBlockCatalog — Custom Blocks (ADR 0055)", () => {
  const parsed = parseCustomBlockDeclaration(PARTNERS_DECLARATION);
  if (!parsed.ok) throw new Error(parsed.message);
  const registry = buildCustomBlockRegistry([
    {
      packageId: "org.example.declaring",
      packageVersion: "1.0.0",
      declarations: [parsed.declaration],
    },
  ]);

  test("an available type is listed under its label, in a custom group after the built-ins", () => {
    const catalog = buildBlockCatalog({ customBlocks: registry, locale: "ro" });
    expect(catalog.groups.map((g) => g.category)).toEqual([
      "mandatory",
      "optional",
      "advanced",
      "custom",
    ]);
    const entry = catalog.entries.find((e) => e.type === "org.example/partners");
    expect(entry).toMatchObject({
      category: "custom",
      label: "Parteneri",
      description: "Logo-uri de parteneri pe grupuri.",
    });
    // Fallback to the default label when the locale has none.
    expect(
      buildBlockCatalog({ customBlocks: registry, locale: "de" }).entryFor("org.example/partners")
        .label,
    ).toBe("Partners");
  });

  test("the custom group is absent when nothing is available, and entryFor still labels an unavailable type", () => {
    const catalog = buildBlockCatalog();
    expect(catalog.groups.map((g) => g.category)).toEqual(["mandatory", "optional", "advanced"]);
    expect(catalog.entries.map((e) => e.type)).not.toContain("org.example/partners");
    const entry = catalog.entryFor("org.example/partner-groups");
    expect(entry.category).toBe("custom");
    expect(entry.label).toBe("Partner groups");
  });
});
