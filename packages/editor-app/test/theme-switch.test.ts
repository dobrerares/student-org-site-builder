/**
 * Theme switching and per-Theme variant memory (ADR 0046 / ADR 0051).
 *
 * The behaviour worth protecting is the one an author notices: trying another
 * look and coming back must not cost them their design choices, and it must
 * never touch their content.
 */

import { describe, expect, test } from "vitest";
import type { BlockEnvelope, Site } from "@sosb/schema";
import { ALL_THEME_SUPPORTS, type ThemeBundle } from "@sosb/renderer";

import {
  applyThemeSwitch,
  setBlockVariant,
  setShellVariant,
  themeRemovalBlockedReason,
} from "../src/theme-switch.js";

function bundle(id: string, heroVariants: string[], shellVariants: string[] = []): ThemeBundle {
  return {
    id,
    name: id,
    version: "1.0.0",
    origin: "package",
    css: "",
    baselineTokens: [],
    supports: ALL_THEME_SUPPORTS,
    blockVariants: { hero: heroVariants.map((v) => ({ id: v, label: v })) },
    shellVariants: shellVariants.map((v) => ({ id: v, label: v })),
    fontSource: { kind: "registry" },
    assets: new Map(),
  };
}

const THEME_A = bundle("org.example.a", ["split", "spotlight"], ["compact"]);
const THEME_B = bundle("org.example.b", ["banner"], []);

function site(block: Partial<BlockEnvelope> = {}): Site {
  return {
    schemaVersion: 1,
    org: { name: "Test" },
    theme: { id: THEME_A.id },
    defaultLanguage: "ro",
    languages: ["ro"],
    pages: [
      {
        slug: "acasa",
        lang: "ro",
        navLabel: "Acasă",
        navOrder: 0,
        showInNav: true,
        blocks: [
          {
            id: "blk_hero",
            type: "hero",
            version: 1,
            data: { title: "Salut" },
            ...block,
          } as BlockEnvelope,
        ],
      },
    ],
  } as Site;
}

const heroOf = (s: Site): BlockEnvelope => s.pages[0]!.blocks[0]!;

/**
 * The same Site with one Article whose body holds a hero Block. Articles keep
 * their Blocks outside `site.pages`, and those Blocks render through the same
 * variant machinery, so every rule here has to hold for them too.
 */
function siteWithArticle(block: Partial<BlockEnvelope> = {}): Site {
  const base = site();
  return {
    ...base,
    articles: [
      {
        id: "art_1",
        lang: "ro",
        slug: "gala",
        title: "Gala",
        publishedAt: "2026-06-12",
        state: "published",
        blocks: [
          {
            id: "blk_article_hero",
            type: "hero",
            version: 1,
            data: { title: "Gala" },
            ...block,
          } as BlockEnvelope,
        ],
      },
    ],
  } as Site;
}

const articleHeroOf = (s: Site): BlockEnvelope => s.articles![0]!.blocks[0]!;

describe("applyThemeSwitch", () => {
  test("files the outgoing choice and clears a variant the new Theme lacks", () => {
    const next = applyThemeSwitch(site({ variant: "split" }), THEME_B.id, THEME_B);
    expect(heroOf(next).variant).toBeUndefined();
    expect(heroOf(next).variantsByTheme).toEqual({ [THEME_A.id]: "split" });
  });

  test("switching back restores the remembered choice", () => {
    const away = applyThemeSwitch(site({ variant: "split" }), THEME_B.id, THEME_B);
    const back = applyThemeSwitch(away, THEME_A.id, THEME_A);
    expect(heroOf(back).variant).toBe("split");
  });

  test("a remembered choice the Theme no longer offers stays filed but inactive", () => {
    const away = applyThemeSwitch(site({ variant: "spotlight" }), THEME_B.id, THEME_B);
    // The Theme is re-authored without `spotlight`.
    const narrowed = bundle(THEME_A.id, ["split"], ["compact"]);
    const back = applyThemeSwitch(away, THEME_A.id, narrowed);
    expect(back.pages[0]!.blocks[0]!.variant).toBeUndefined();
    expect(back.pages[0]!.blocks[0]!.variantsByTheme?.[THEME_A.id]).toBe("spotlight");
  });

  test("never touches Block content", () => {
    const before = site({ variant: "split" });
    const after = applyThemeSwitch(before, THEME_B.id, THEME_B);
    expect(heroOf(after).data).toEqual(heroOf(before).data);
    expect(heroOf(after).id).toBe("blk_hero");
    expect(heroOf(after).type).toBe("hero");
  });

  test("records the package version, and drops it for a built-in", () => {
    const toPackage = applyThemeSwitch(site(), THEME_B.id, THEME_B);
    expect(toPackage.theme.version).toBe("1.0.0");
    const toBuiltin = applyThemeSwitch(toPackage, "modern");
    expect(toBuiltin.theme.version).toBeUndefined();
  });

  test("remembers shell variants per Theme too", () => {
    const withShell = setShellVariant(site(), "compact");
    const away = applyThemeSwitch(withShell, THEME_B.id, THEME_B);
    expect(away.theme.shellVariant).toBeUndefined();
    const back = applyThemeSwitch(away, THEME_A.id, THEME_A);
    expect(back.theme.shellVariant).toBe("compact");
  });

  test("switching to a Theme that is not installed still files the choices", () => {
    const away = applyThemeSwitch(site({ variant: "split" }), "org.example.missing");
    expect(away.theme.id).toBe("org.example.missing");
    expect(heroOf(away).variantsByTheme).toEqual({ [THEME_A.id]: "split" });
  });

  test("switching to the same Theme is a no-op", () => {
    const before = site({ variant: "split" });
    expect(applyThemeSwitch(before, THEME_A.id, THEME_A)).toBe(before);
  });
});

describe("setBlockVariant", () => {
  test("sets and clears the live variant", () => {
    const set = setBlockVariant(site(), "blk_hero", "spotlight");
    expect(heroOf(set).variant).toBe("spotlight");
    expect(heroOf(setBlockVariant(set, "blk_hero", undefined)).variant).toBeUndefined();
  });

  test("leaves other blocks alone", () => {
    const before = site({ variant: "split" });
    expect(heroOf(setBlockVariant(before, "blk_other", "banner")).variant).toBe("split");
  });
});

describe("themeRemovalBlockedReason", () => {
  test("blocks removing the Theme in use, and explains why", () => {
    const reason = themeRemovalBlockedReason(site(), THEME_A.id);
    expect(reason).toMatch(/using this Theme/);
    expect(reason).toMatch(/content is not affected/);
  });

  test("allows removing any other Theme", () => {
    expect(themeRemovalBlockedReason(site(), THEME_B.id)).toBeUndefined();
  });
});

describe("Articles share the Page variant machinery", () => {
  test("a theme switch files and clears an Article Block's variant too", () => {
    const next = applyThemeSwitch(siteWithArticle({ variant: "split" }), THEME_B.id, THEME_B);
    // Without this, the Article kept `variant: "split"` after switching away:
    // harmless while the new Theme has no such id, and a design the author
    // never chose the moment it does.
    expect(articleHeroOf(next).variant).toBeUndefined();
    expect(articleHeroOf(next).variantsByTheme).toEqual({ [THEME_A.id]: "split" });
  });

  test("switching back restores an Article Block's remembered choice", () => {
    const away = applyThemeSwitch(siteWithArticle({ variant: "split" }), THEME_B.id, THEME_B);
    const back = applyThemeSwitch(away, THEME_A.id, THEME_A);
    expect(articleHeroOf(back).variant).toBe("split");
  });

  test("setBlockVariant reaches a Block inside an Article", () => {
    const next = setBlockVariant(siteWithArticle(), "blk_article_hero", "spotlight");
    expect(articleHeroOf(next).variant).toBe("spotlight");
    // And clearing it removes the key rather than storing undefined.
    const cleared = setBlockVariant(next, "blk_article_hero", undefined);
    expect("variant" in articleHeroOf(cleared)).toBe(false);
  });

  test("a Site with no articles is left without an articles key", () => {
    const next = applyThemeSwitch(site({ variant: "split" }), THEME_B.id, THEME_B);
    // ADR 0002 round-trip identity: absent stays absent.
    expect("articles" in next).toBe(false);
    expect("articles" in setBlockVariant(site(), "blk_hero", "split")).toBe(false);
  });
});
