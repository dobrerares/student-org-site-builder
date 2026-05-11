import { describe, expect, test } from "vitest";

import { buildThemeCatalog } from "../src/theme-catalog.js";

describe("buildThemeCatalog", () => {
  test("omits the stub theme id", () => {
    const catalog = buildThemeCatalog();
    expect(catalog.entries.map((e) => e.id)).not.toContain("stub");
  });

  test("includes the five v1 themes", () => {
    const catalog = buildThemeCatalog();
    const ids = catalog.entries.map((e) => e.id).sort();
    expect(ids).toEqual(["academic", "civic", "editorial", "minimal", "modern"]);
  });

  test("each entry has a non-empty label and description", () => {
    const catalog = buildThemeCatalog();
    for (const entry of catalog.entries) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  test("each entry has font lists (headline and body)", () => {
    const catalog = buildThemeCatalog();
    for (const entry of catalog.entries) {
      expect(entry.fonts.headline.length).toBeGreaterThan(0);
      expect(entry.fonts.body.length).toBeGreaterThan(0);
    }
  });

  test("entryFor returns a humanised fallback for unknown ids", () => {
    const catalog = buildThemeCatalog();
    const entry = catalog.entryFor("someFutureTheme");
    expect(entry.label).toBe("Some future theme");
    expect(entry.fonts.headline).toEqual([]);
  });
});
