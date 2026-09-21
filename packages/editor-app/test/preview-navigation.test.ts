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

/**
 * Author-written link fields are not canonical `pagePath` values. They may be
 * relative to the page the user is looking at, and they may carry a hash or a
 * query. The iframe forwards the href verbatim (its own `document.baseURI` is
 * the editor's URL, so it cannot resolve relatives itself), so the host owns
 * normalisation.
 */
describe("resolvePathToPageIndex — non-canonical hrefs", () => {
  test("resolves a relative path against the page being previewed", () => {
    const despre = resolvePathToPageIndex(makeSite(), "/despre/");
    expect(despre).not.toBeNull();
    // From the home page, "despre/" means the same thing as "/despre/".
    expect(resolvePathToPageIndex(makeSite(), "despre/", 0)).toBe(despre);
  });

  test("walks ../ back out of a nested page", () => {
    const despre = resolvePathToPageIndex(makeSite(), "/despre/")!;
    const home = resolvePathToPageIndex(makeSite(), "/")!;
    expect(resolvePathToPageIndex(makeSite(), "../", despre)).toBe(home);
  });

  test("tolerates a missing trailing slash", () => {
    expect(resolvePathToPageIndex(makeSite(), "/despre")).toBe(
      resolvePathToPageIndex(makeSite(), "/despre/"),
    );
  });

  test("ignores hash fragments and query strings", () => {
    const despre = resolvePathToPageIndex(makeSite(), "/despre/");
    expect(resolvePathToPageIndex(makeSite(), "/despre/#echipa")).toBe(despre);
    expect(resolvePathToPageIndex(makeSite(), "/despre/?utm=x")).toBe(despre);
  });

  test("an unknown path is still a soft no-match", () => {
    expect(resolvePathToPageIndex(makeSite(), "/nu-exista/")).toBeNull();
  });
});
