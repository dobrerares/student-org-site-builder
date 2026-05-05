import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import { homePageIndex, navPagesFor, pageDistPath, pagePath } from "../src/routing.js";

function makeSite(overrides: Partial<Site> = {}): Site {
  const base: Site = {
    schemaVersion: 1,
    org: { name: "Stub" },
    theme: { id: "stub" },
    defaultLanguage: "ro",
    languages: ["ro"],
    pages: [
      {
        slug: "acasa",
        lang: "ro",
        navLabel: "Acasă",
        navOrder: 0,
        showInNav: true,
        blocks: [{ id: "b1", type: "hero", version: 1, data: { title: "Acasă" } }],
      },
      {
        slug: "despre",
        lang: "ro",
        navLabel: "Despre",
        navOrder: 1,
        showInNav: true,
        blocks: [{ id: "b2", type: "hero", version: 1, data: { title: "Despre" } }],
      },
      {
        slug: "multumim",
        lang: "ro",
        navLabel: "Mulțumim",
        navOrder: 2,
        showInNav: false,
        blocks: [{ id: "b3", type: "hero", version: 1, data: { title: "Mulțumim" } }],
      },
    ],
  } as unknown as Site;
  return { ...base, ...overrides };
}

describe("homePageIndex", () => {
  test("returns the index of the page with navOrder=0 in defaultLanguage", () => {
    const site = makeSite();
    expect(homePageIndex(site)).toBe(0);
  });

  test("survives non-zero ordering of pages[]", () => {
    const site = makeSite({
      pages: [
        {
          slug: "despre",
          lang: "ro",
          navLabel: "Despre",
          navOrder: 1,
          showInNav: true,
          blocks: [],
        },
        {
          slug: "acasa",
          lang: "ro",
          navLabel: "Acasă",
          navOrder: 0,
          showInNav: true,
          blocks: [],
        },
      ] as Site["pages"],
    });
    expect(homePageIndex(site)).toBe(1);
  });

  test("falls back to 0 when no navOrder=0 default-language page exists", () => {
    const site = makeSite({
      pages: [
        {
          slug: "despre",
          lang: "ro",
          navLabel: "Despre",
          navOrder: 5,
          showInNav: true,
          blocks: [],
        },
      ] as Site["pages"],
    });
    expect(homePageIndex(site)).toBe(0);
  });
});

describe("pagePath / pageDistPath", () => {
  test("home page maps to '/' (URL) and 'index.html' (dist)", () => {
    const site = makeSite();
    expect(pagePath(site, site.pages[0]!)).toBe("/");
    expect(pageDistPath(site, site.pages[0]!)).toBe("index.html");
  });

  test("non-home pages map to '/<slug>/' and '<slug>/index.html'", () => {
    const site = makeSite();
    expect(pagePath(site, site.pages[1]!)).toBe("/despre/");
    expect(pageDistPath(site, site.pages[1]!)).toBe("despre/index.html");

    expect(pagePath(site, site.pages[2]!)).toBe("/multumim/");
    expect(pageDistPath(site, site.pages[2]!)).toBe("multumim/index.html");
  });
});

describe("navPagesFor", () => {
  test("includes only pages with showInNav=true and same lang as the active page", () => {
    const site = makeSite();
    const active = site.pages[0]!;
    const nav = navPagesFor(site, active);
    const slugs = nav.map((p) => p.slug);
    expect(slugs).toEqual(["acasa", "despre"]);
    // The hidden 'multumim' page is omitted.
    expect(slugs).not.toContain("multumim");
  });

  test("orders by navOrder ascending", () => {
    const site = makeSite({
      pages: [
        {
          slug: "c",
          lang: "ro",
          navLabel: "C",
          navOrder: 2,
          showInNav: true,
          blocks: [],
        },
        {
          slug: "a",
          lang: "ro",
          navLabel: "A",
          navOrder: 0,
          showInNav: true,
          blocks: [],
        },
        {
          slug: "b",
          lang: "ro",
          navLabel: "B",
          navOrder: 1,
          showInNav: true,
          blocks: [],
        },
      ] as Site["pages"],
    });
    const nav = navPagesFor(site, site.pages[1]!);
    expect(nav.map((p) => p.slug)).toEqual(["a", "b", "c"]);
  });

  test("filters out pages from other languages", () => {
    const site = makeSite({
      languages: ["ro", "en"],
      pages: [
        {
          slug: "acasa",
          lang: "ro",
          navLabel: "Acasă",
          navOrder: 0,
          showInNav: true,
          blocks: [],
        },
        {
          slug: "home",
          lang: "en",
          navLabel: "Home",
          navOrder: 0,
          showInNav: true,
          blocks: [],
        },
      ] as Site["pages"],
    });
    const roNav = navPagesFor(site, site.pages[0]!);
    expect(roNav.map((p) => p.slug)).toEqual(["acasa"]);
    const enNav = navPagesFor(site, site.pages[1]!);
    expect(enNav.map((p) => p.slug)).toEqual(["home"]);
  });
});
