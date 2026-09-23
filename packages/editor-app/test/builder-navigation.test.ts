import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import {
  INITIAL_DESTINATION,
  NAV_SECTIONS,
  OUTLINE_DRILL,
  backDestination,
  destinationForSection,
  isWorkspace,
  reconcileDestination,
  reconcileDrill,
  sectionOf,
  type Destination,
} from "../src/builder-navigation.js";

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
    articles: [
      {
        id: "art_1",
        slug: "primul",
        lang: "ro",
        title: "Primul",
        state: "draft",
        publishedAt: "2026-01-01",
        blocks: [],
      },
    ],
  } as unknown as Site;
}

describe("main navigation", () => {
  test("opens a Site into the content Overview", () => {
    expect(INITIAL_DESTINATION).toEqual({ kind: "overview" });
  });

  test("offers the five accepted destinations in order", () => {
    expect(NAV_SECTIONS).toEqual(["overview", "pages", "articles", "theme", "settings"]);
  });

  test("every section round-trips through its destination", () => {
    for (const section of NAV_SECTIONS) {
      expect(sectionOf(destinationForSection(section))).toBe(section);
    }
  });

  test("a workspace keeps its list highlighted in the navigation", () => {
    expect(sectionOf({ kind: "pageWorkspace", pageIndex: 1 })).toBe("pages");
    expect(sectionOf({ kind: "articleWorkspace", articleId: "art_1" })).toBe("articles");
  });
});

describe("workspaces", () => {
  test("only the two content destinations are workspaces", () => {
    expect(isWorkspace({ kind: "pageWorkspace", pageIndex: 0 })).toBe(true);
    expect(isWorkspace({ kind: "articleWorkspace", articleId: "art_1" })).toBe(true);
    for (const section of NAV_SECTIONS) {
      expect(isWorkspace(destinationForSection(section))).toBe(false);
    }
  });

  test("back from a workspace goes to the list the content came from", () => {
    expect(backDestination({ kind: "pageWorkspace", pageIndex: 1 })).toEqual({ kind: "pages" });
    expect(backDestination({ kind: "articleWorkspace", articleId: "art_1" })).toEqual({
      kind: "articles",
    });
  });

  test("back from a list is a no-op, so callers need no special case", () => {
    const pages: Destination = { kind: "pages" };
    expect(backDestination(pages)).toBe(pages);
  });
});

describe("reconcileDestination", () => {
  test("keeps a destination whose target still exists", () => {
    const site = baseSite();
    const destination: Destination = { kind: "pageWorkspace", pageIndex: 1 };
    // Same object back, so the shell can skip the state update entirely.
    expect(reconcileDestination(destination, site)).toBe(destination);
  });

  test("falls back to Pages when the edited page is deleted", () => {
    const site = baseSite();
    const shrunk: Site = { ...site, pages: [site.pages[0]!] };
    expect(reconcileDestination({ kind: "pageWorkspace", pageIndex: 1 }, shrunk)).toEqual({
      kind: "pages",
    });
  });

  test("falls back to Articles when the edited Article is deleted", () => {
    const site = baseSite();
    const shrunk: Site = { ...site, articles: [] } as unknown as Site;
    expect(reconcileDestination({ kind: "articleWorkspace", articleId: "art_1" }, shrunk)).toEqual({
      kind: "articles",
    });
  });

  test("survives a Site with no articles key at all", () => {
    const site = baseSite();
    const none = { ...site, articles: undefined } as unknown as Site;
    expect(reconcileDestination({ kind: "articleWorkspace", articleId: "art_1" }, none)).toEqual({
      kind: "articles",
    });
  });

  test("leaves the non-content destinations untouched", () => {
    const site = baseSite();
    for (const section of NAV_SECTIONS) {
      const destination = destinationForSection(section);
      expect(reconcileDestination(destination, site)).toBe(destination);
    }
  });
});

describe("reconcileDrill", () => {
  test("keeps an Inspector whose Block is still on the outline", () => {
    const drill = { kind: "block", blockId: "blk_home" } as const;
    expect(reconcileDrill(drill, ["blk_home", "blk_about"])).toBe(drill);
  });

  test("drills back out when the Block is removed underneath it", () => {
    expect(reconcileDrill({ kind: "block", blockId: "gone" }, ["blk_home"])).toEqual(OUTLINE_DRILL);
  });

  test("leaves the settings and related Inspectors alone", () => {
    // Related Articles keeps its configuration when switched off, so its
    // Inspector must not be yanked away from under the author.
    const settings = { kind: "settings" } as const;
    const related = { kind: "related" } as const;
    expect(reconcileDrill(settings, [])).toBe(settings);
    expect(reconcileDrill(related, [])).toBe(related);
  });
});
