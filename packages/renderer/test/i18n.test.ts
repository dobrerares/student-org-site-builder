import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import bilingual from "./fixtures/bilingual.json" with { type: "json" };
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import multiPage from "./fixtures/multi-page.json" with { type: "json" };
import { renderSite } from "../src/index.js";
import {
  homePagePathForLanguage,
  languageHomeIndex,
  languageSwitcherEntriesFor,
  pagePath,
} from "../src/routing.js";

const site = bilingual as unknown as Site;
const singleLang = heroOnly as unknown as Site;
const multiLangAll = multiPage as unknown as Site;

/**
 * AC: per-language URL trees emit correctly under dist/.
 *
 * Default-language pages keep the existing flat / and /<slug>/ paths.
 * Secondary-language pages live under /<lang>/ (home) and
 * /<lang>/<slug>/ (non-home).
 */
describe("routing - per-language URLs", () => {
  test("default-language home maps to '/'", () => {
    const home = site.pages.find((p) => p.slug === "acasa" && p.lang === "ro");
    expect(home).toBeDefined();
    expect(pagePath(site, home!)).toBe("/");
  });

  test("default-language non-home maps to '/<slug>/'", () => {
    const about = site.pages.find((p) => p.slug === "despre" && p.lang === "ro");
    expect(pagePath(site, about!)).toBe("/despre/");
  });

  test("secondary-language home maps to '/<lang>/'", () => {
    const home = site.pages.find((p) => p.slug === "home" && p.lang === "en");
    expect(pagePath(site, home!)).toBe("/en/");
  });

  test("secondary-language non-home maps to '/<lang>/<slug>/'", () => {
    const about = site.pages.find((p) => p.slug === "about" && p.lang === "en");
    expect(pagePath(site, about!)).toBe("/en/about/");
  });

  test("languageHomeIndex returns the navOrder=0 page per language", () => {
    expect(languageHomeIndex(site, "ro")).toBe(
      site.pages.findIndex((p) => p.slug === "acasa" && p.lang === "ro"),
    );
    expect(languageHomeIndex(site, "en")).toBe(
      site.pages.findIndex((p) => p.slug === "home" && p.lang === "en"),
    );
  });

  test("homePagePathForLanguage returns '/' for default lang and '/<lang>/' for others", () => {
    expect(homePagePathForLanguage(site, "ro")).toBe("/");
    expect(homePagePathForLanguage(site, "en")).toBe("/en/");
  });
});

/**
 * AC: hreflang annotations correct in head.
 *
 * Each rendered page emits one alternate per language present on the site,
 * plus an x-default pointing at the default-language counterpart. When a
 * counterpart is missing, the hreflang for that language points at the
 * language home page (graceful fallback).
 */
describe("renderSite - hreflang in head", () => {
  test("emits one alternate per declared language", () => {
    const html = renderSite(site, "stub", { pageIndex: 0 });
    expect(html).toMatch(/<link rel="alternate" hreflang="ro" href="\/"/);
    expect(html).toMatch(/<link rel="alternate" hreflang="en" href="\/en\/"/);
  });

  test("emits an x-default alternate pointing at the default-language counterpart", () => {
    const html = renderSite(site, "stub", { pageIndex: 0 });
    expect(html).toMatch(/<link rel="alternate" hreflang="x-default" href="\/"/);
  });

  test("non-home pages emit hreflang pointing at the localizedAs counterpart", () => {
    const aboutRoIdx = site.pages.findIndex((p) => p.slug === "despre" && p.lang === "ro");
    const html = renderSite(site, "stub", { pageIndex: aboutRoIdx });
    expect(html).toMatch(/<link rel="alternate" hreflang="ro" href="\/despre\/"/);
    expect(html).toMatch(/<link rel="alternate" hreflang="en" href="\/en\/about\/"/);
    expect(html).toMatch(/<link rel="alternate" hreflang="x-default" href="\/despre\/"/);
  });

  test("missing counterpart falls back to the language home page", () => {
    const onlyRoIdx = site.pages.findIndex((p) => p.slug === "doar-romana");
    const html = renderSite(site, "stub", { pageIndex: onlyRoIdx });
    expect(html).toMatch(/<link rel="alternate" hreflang="ro" href="\/doar-romana\/"/);
    expect(html).toMatch(/<link rel="alternate" hreflang="en" href="\/en\/"/);
  });

  test("single-language site does NOT emit hreflang alternates", () => {
    const html = renderSite(singleLang, "stub");
    expect(html).not.toMatch(/<link rel="alternate" hreflang=/);
  });

  test("single-language multi-page site does NOT emit hreflang alternates", () => {
    const html = renderSite(multiLangAll, "stub", { pageIndex: 1 });
    expect(html).not.toMatch(/<link rel="alternate" hreflang=/);
  });
});

/**
 * AC: language switcher rendered with correct cross-references.
 *
 * The switcher renders only when the site has 2+ languages. Each link uses
 * the language native name. The link points at the localizedAs counterpart,
 * or the language home page when no counterpart. The active language is
 * marked with aria-current.
 */
describe("renderSite - language switcher", () => {
  test("emits a language switcher landmark with native names", () => {
    const html = renderSite(site, "stub", { pageIndex: 0 });
    expect(html).toMatch(/<nav[^>]*data-language-switcher/);
    expect(html).toMatch(/aria-label="Language"/);
    expect(html).toContain("Română");
    expect(html).toContain("English");
  });

  test("switcher uses lang attribute on each anchor for accessibility", () => {
    const html = renderSite(site, "stub", { pageIndex: 0 });
    const swMatch = /<nav[^>]*data-language-switcher[^>]*>([\s\S]*?)<\/nav>/.exec(html);
    expect(swMatch).not.toBeNull();
    const sw = swMatch![1]!;
    expect(sw).toMatch(/<a[^>]*lang="ro"/);
    expect(sw).toMatch(/<a[^>]*lang="en"/);
  });

  test("switcher links the active language to its own page (self link)", () => {
    const html = renderSite(site, "stub", { pageIndex: 0 });
    const swMatch = /<nav[^>]*data-language-switcher[^>]*>([\s\S]*?)<\/nav>/.exec(html);
    const sw = swMatch![1]!;
    expect(sw).toMatch(/<a[^>]*href="\/"[^>]*lang="ro"/);
  });

  test("switcher links non-active languages to the localizedAs counterpart", () => {
    const html = renderSite(site, "stub", { pageIndex: 0 });
    const swMatch = /<nav[^>]*data-language-switcher[^>]*>([\s\S]*?)<\/nav>/.exec(html);
    const sw = swMatch![1]!;
    expect(sw).toMatch(/<a[^>]*href="\/en\/"[^>]*lang="en"/);
  });

  test("non-home: switcher links non-active language to its localizedAs counterpart", () => {
    const aboutRoIdx = site.pages.findIndex((p) => p.slug === "despre" && p.lang === "ro");
    const html = renderSite(site, "stub", { pageIndex: aboutRoIdx });
    const swMatch = /<nav[^>]*data-language-switcher[^>]*>([\s\S]*?)<\/nav>/.exec(html);
    const sw = swMatch![1]!;
    expect(sw).toMatch(/<a[^>]*href="\/en\/about\/"[^>]*lang="en"/);
  });

  test("missing counterpart: switcher falls back to the language home", () => {
    const onlyRoIdx = site.pages.findIndex((p) => p.slug === "doar-romana");
    const html = renderSite(site, "stub", { pageIndex: onlyRoIdx });
    const swMatch = /<nav[^>]*data-language-switcher[^>]*>([\s\S]*?)<\/nav>/.exec(html);
    const sw = swMatch![1]!;
    expect(sw).toMatch(/<a[^>]*href="\/doar-romana\/"[^>]*lang="ro"/);
    expect(sw).toMatch(/<a[^>]*href="\/en\/"[^>]*lang="en"/);
  });

  test("active language is marked aria-current", () => {
    const html = renderSite(site, "stub", { pageIndex: 0 });
    const swMatch = /<nav[^>]*data-language-switcher[^>]*>([\s\S]*?)<\/nav>/.exec(html);
    const sw = swMatch![1]!;
    expect(sw).toMatch(/<a[^>]*lang="ro"[^>]*aria-current="true"/);
    expect(sw).not.toMatch(/<a[^>]*lang="en"[^>]*aria-current=/);
  });

  test("single-language site does NOT emit a language switcher", () => {
    const html = renderSite(singleLang, "stub");
    expect(html).not.toMatch(/<nav[^>]*data-language-switcher/);
  });

  test("single-language multi-page site does NOT emit a language switcher", () => {
    const html = renderSite(multiLangAll, "stub", { pageIndex: 1 });
    expect(html).not.toMatch(/<nav[^>]*data-language-switcher/);
  });
});

/**
 * AC: site-nav links use per-language URLs.
 */
describe("renderSite - nav uses per-language URLs", () => {
  test("EN home: nav links use the /en/ prefix", () => {
    const enHomeIdx = site.pages.findIndex((p) => p.slug === "home" && p.lang === "en");
    const html = renderSite(site, "stub", { pageIndex: enHomeIdx });
    const navMatch = /<nav[^>]*data-site-nav[^>]*>([\s\S]*?)<\/nav>/.exec(html);
    expect(navMatch).not.toBeNull();
    const nav = navMatch![1]!;
    expect(nav).toMatch(/<a[^>]*href="\/en\/"/);
    expect(nav).toMatch(/<a[^>]*href="\/en\/about\/"/);
  });

  test("RO home: nav links use the unprefixed default-language paths", () => {
    const html = renderSite(site, "stub", { pageIndex: 0 });
    const navMatch = /<nav[^>]*data-site-nav[^>]*>([\s\S]*?)<\/nav>/.exec(html);
    const nav = navMatch![1]!;
    expect(nav).toMatch(/<a[^>]*href="\/"/);
    expect(nav).toMatch(/<a[^>]*href="\/despre\/"/);
  });
});

describe("languageSwitcherEntriesFor", () => {
  test("returns one entry per declared language with native name + href", () => {
    const entries = languageSwitcherEntriesFor(site, site.pages[0]!);
    const langs = entries.map((e) => e.lang);
    expect(langs).toEqual(["ro", "en"]);
    const entryByLang = Object.fromEntries(entries.map((e) => [e.lang, e]));
    expect(entryByLang.ro!.nativeName).toBe("Română");
    expect(entryByLang.en!.nativeName).toBe("English");
    expect(entryByLang.ro!.href).toBe("/");
    expect(entryByLang.en!.href).toBe("/en/");
  });

  test("preserves the order of site.languages", () => {
    const entries = languageSwitcherEntriesFor(
      { ...site, languages: ["en", "ro"] } as Site,
      site.pages[0]!,
    );
    expect(entries.map((e) => e.lang)).toEqual(["en", "ro"]);
  });

  test("returns [] for single-language sites", () => {
    expect(languageSwitcherEntriesFor(singleLang, singleLang.pages[0]!)).toEqual([]);
  });
});

describe("renderSite - i18n determinism", () => {
  test("repeated bilingual renders are byte-identical", () => {
    const a = renderSite(site, "stub", { pageIndex: 0 });
    const b = renderSite(site, "stub", { pageIndex: 0 });
    expect(a).toBe(b);
  });
});
