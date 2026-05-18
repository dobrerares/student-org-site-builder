import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";

import { resolvePathToPageIndex } from "../src/preview-navigation.js";

/**
 * Tests for the host-side path → pageIndex resolver. The resolver inverts
 * `pagePath(site, page)` from `@sosb/renderer/routing.ts`, so the test
 * cases here mirror the rules in that module:
 *   - default-language home → `/`
 *   - default-language non-home → `/<slug>/`
 *   - secondary-language home → `/<lang>/`
 *   - secondary-language non-home → `/<lang>/<slug>/`
 */

function makeSite(): Site {
  return {
    schemaVersion: 1,
    org: { name: "X" },
    theme: { id: "stub" },
    defaultLanguage: "ro",
    languages: ["ro", "en"],
    pages: [
      {
        slug: "acasa",
        lang: "ro",
        navOrder: 0,
        navLabel: "Acasă",
        showInNav: true,
        blocks: [],
      },
      {
        slug: "despre",
        lang: "ro",
        navOrder: 1,
        navLabel: "Despre",
        showInNav: true,
        blocks: [],
      },
      {
        slug: "home",
        lang: "en",
        navOrder: 0,
        navLabel: "Home",
        showInNav: true,
        blocks: [],
      },
      {
        slug: "about",
        lang: "en",
        navOrder: 1,
        navLabel: "About",
        showInNav: true,
        blocks: [],
      },
    ],
  } as unknown as Site;
}

describe("resolvePathToPageIndex", () => {
  test("resolves the default-language home (`/`) to index 0", () => {
    expect(resolvePathToPageIndex(makeSite(), "/")).toBe(0);
  });

  test("resolves a default-language non-home (`/despre/`) to the matching page", () => {
    expect(resolvePathToPageIndex(makeSite(), "/despre/")).toBe(1);
  });

  test("resolves a secondary-language home (`/en/`) to its page index", () => {
    expect(resolvePathToPageIndex(makeSite(), "/en/")).toBe(2);
  });

  test("resolves a secondary-language non-home (`/en/about/`) to its page index", () => {
    expect(resolvePathToPageIndex(makeSite(), "/en/about/")).toBe(3);
  });

  test("returns null for a path that matches no page", () => {
    expect(resolvePathToPageIndex(makeSite(), "/does-not-exist/")).toBeNull();
  });

  test("returns null for an empty string (defensive)", () => {
    expect(resolvePathToPageIndex(makeSite(), "")).toBeNull();
  });
});
