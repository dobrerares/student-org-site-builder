import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import { addLanguageVersion, missingTranslationLanguages } from "../src/pages-ops.js";

function bilingualSite(): Site {
  return {
    schemaVersion: 1,
    org: { name: "Bilingual Org" },
    theme: { id: "stub" },
    defaultLanguage: "ro",
    languages: ["ro", "en"],
    pages: [
      {
        slug: "acasa",
        lang: "ro",
        navLabel: "Acasă",
        navOrder: 0,
        showInNav: true,
        blocks: [{ id: "blk_home_ro", type: "hero", version: 1, data: { title: "Acasă" } }],
        localizedAs: { en: "home" },
      },
      {
        slug: "despre",
        lang: "ro",
        navLabel: "Despre",
        navOrder: 1,
        showInNav: true,
        blocks: [{ id: "blk_about_ro", type: "hero", version: 1, data: { title: "Despre" } }],
      },
      {
        slug: "home",
        lang: "en",
        navLabel: "Home",
        navOrder: 0,
        showInNav: true,
        blocks: [{ id: "blk_home_en", type: "hero", version: 1, data: { title: "Home" } }],
        localizedAs: { ro: "acasa" },
      },
    ],
  } as unknown as Site;
}

describe("missingTranslationLanguages", () => {
  test("returns languages that the page lacks a counterpart for", () => {
    const site = bilingualSite();
    const despre = site.pages[1]!;
    expect(missingTranslationLanguages(site, despre)).toEqual(["en"]);
  });

  test("returns [] when the page has counterparts in every other language", () => {
    const site = bilingualSite();
    const acasa = site.pages[0]!;
    expect(missingTranslationLanguages(site, acasa)).toEqual([]);
  });

  test("returns [] for monolingual sites (no other languages declared)", () => {
    const site = bilingualSite();
    const monolingual = { ...site, languages: ["ro"] } as Site;
    const acasa = monolingual.pages[0]!;
    expect(missingTranslationLanguages(monolingual, acasa)).toEqual([]);
  });
});

describe("addLanguageVersion", () => {
  test("creates a counterpart page in the target language and wires localizedAs both ways", () => {
    const site = bilingualSite();
    const next = addLanguageVersion(site, 1, "en");
    // A new EN counterpart for "despre" was added.
    expect(next.pages.length).toBe(site.pages.length + 1);
    const newPage = next.pages[next.pages.length - 1]!;
    expect(newPage.lang).toBe("en");
    // The source page's localizedAs.en now references the new counterpart.
    const sourceAfter = next.pages[1]!;
    expect(sourceAfter.localizedAs?.en).toBe(newPage.slug);
    // The new counterpart's localizedAs.ro references the source.
    expect(newPage.localizedAs?.ro).toBe(sourceAfter.slug);
  });

  test("the new counterpart inherits the source's slug + a hero placeholder block", () => {
    const site = bilingualSite();
    const next = addLanguageVersion(site, 1, "en");
    const newPage = next.pages[next.pages.length - 1]!;
    // Slug equals the source slug by default (cross-language slug collisions are
    // OK because the URL trees are language-prefixed).
    expect(newPage.slug).toBe("despre");
    expect(newPage.navLabel).toBe("Despre");
    expect(newPage.blocks.length).toBeGreaterThan(0);
    expect(newPage.blocks[0]!.type).toBe("hero");
  });

  test("if the source slug is already used in the target language, picks a unique slug", () => {
    const site = bilingualSite();
    // Add a second EN page whose slug matches the source's slug already.
    const withCollision = {
      ...site,
      pages: [
        ...site.pages,
        {
          slug: "despre",
          lang: "en",
          navLabel: "Other",
          navOrder: 1,
          showInNav: true,
          blocks: [
            { id: "blk_other", type: "hero", version: 1, data: { title: "Other" } },
          ],
        },
      ],
    } as unknown as Site;
    const next = addLanguageVersion(withCollision, 1, "en");
    const newPage = next.pages[next.pages.length - 1]!;
    expect(newPage.slug).not.toBe("despre");
    expect(newPage.slug.startsWith("despre")).toBe(true);
  });

  test("noop when the target language is not declared on the site", () => {
    const site = bilingualSite();
    const next = addLanguageVersion(site, 1, "fr");
    expect(next).toBe(site);
  });

  test("noop when the source page already has a counterpart in the target language", () => {
    const site = bilingualSite();
    const next = addLanguageVersion(site, 0, "en");
    expect(next).toBe(site);
  });

  test("noop when the source index is out of range", () => {
    const site = bilingualSite();
    const next = addLanguageVersion(site, 99, "en");
    expect(next).toBe(site);
  });
});
