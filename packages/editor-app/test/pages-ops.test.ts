import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import { addPage, clonePage, deletePage, movePage } from "../src/pages-ops.js";

function baseSite(): Site {
  return {
    schemaVersion: 1,
    org: { name: "Stub Org" },
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
        blocks: [{ id: "blk_home", type: "hero", version: 1, data: { title: "Acasă" } }],
      },
      {
        slug: "despre",
        lang: "ro",
        navLabel: "Despre",
        navOrder: 1,
        showInNav: true,
        blocks: [{ id: "blk_about", type: "hero", version: 1, data: { title: "Despre" } }],
      },
    ],
  } as unknown as Site;
}

describe("addPage", () => {
  test("appends a page in the default language with the next navOrder", () => {
    const site = baseSite();
    const next = addPage(site, "proiecte");
    expect(next.pages).toHaveLength(3);
    const added = next.pages[2]!;
    expect(added.slug).toBe("proiecte");
    expect(added.lang).toBe("ro");
    expect(added.navOrder).toBe(2);
    expect(added.showInNav).toBe(true);
    expect(added.blocks.length).toBeGreaterThan(0);
    expect(added.blocks[0]!.type).toBe("hero");
  });

  test("does not mutate the original site", () => {
    const site = baseSite();
    const before = JSON.parse(JSON.stringify(site));
    addPage(site, "proiecte");
    expect(site).toEqual(before);
  });
});

describe("clonePage", () => {
  test("inserts a clone immediately after the source", () => {
    const site = baseSite();
    const next = clonePage(site, 0, "acasa-copy");
    expect(next.pages).toHaveLength(3);
    expect(next.pages.map((p) => p.slug)).toEqual(["acasa", "acasa-copy", "despre"]);
  });

  test("clone has its own block ids (no collisions)", () => {
    const site = baseSite();
    const next = clonePage(site, 0, "acasa-copy");
    const original = next.pages[0]!;
    const clone = next.pages[1]!;
    expect(clone.blocks[0]!.id).not.toBe(original.blocks[0]!.id);
  });

  test("clone gets the next navOrder for its language", () => {
    const site = baseSite();
    const next = clonePage(site, 1, "despre-copy");
    const clone = next.pages[2]!;
    expect(clone.navOrder).toBe(2);
  });

  test("throws on out-of-range source index", () => {
    const site = baseSite();
    expect(() => clonePage(site, 99, "x")).toThrow();
  });
});

describe("deletePage", () => {
  test("removes the page at index", () => {
    const site = baseSite();
    const next = deletePage(site, 1);
    expect(next.pages.map((p) => p.slug)).toEqual(["acasa"]);
  });

  test("refuses to delete the last page (a site must have at least one)", () => {
    const single = {
      ...baseSite(),
      pages: [baseSite().pages[0]!],
    };
    const result = deletePage(single, 0);
    expect(result.pages).toHaveLength(1);
  });
});

describe("movePage", () => {
  test("swaps adjacent pages and renumbers navOrder", () => {
    const site = baseSite();
    const next = movePage(site, 1, "up");
    expect(next.pages.map((p) => p.slug)).toEqual(["despre", "acasa"]);
    // navOrder is renumbered to match the new pages[] order in the lang.
    expect(next.pages[0]!.navOrder).toBe(0);
    expect(next.pages[1]!.navOrder).toBe(1);
  });

  test("noop at the start when moving up", () => {
    const site = baseSite();
    const next = movePage(site, 0, "up");
    expect(next.pages.map((p) => p.slug)).toEqual(["acasa", "despre"]);
  });

  test("noop at the end when moving down", () => {
    const site = baseSite();
    const next = movePage(site, 1, "down");
    expect(next.pages.map((p) => p.slug)).toEqual(["acasa", "despre"]);
  });
});
