import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import bilingualSite from "./fixtures/bilingual-site.json" with { type: "json" };
import { build } from "../src/index.js";
import { textOf } from "./helpers/dist-text.js";

const fixture = bilingualSite as unknown as Site;

/**
 * Multi-language support (#24).
 *
 * Per-language URL trees:
 *   - default-language pages keep / and /<slug>/ paths.
 *   - secondary-language pages live under /<lang>/ and /<lang>/<slug>/.
 *
 * Sitemap hreflang:
 *   - one <url> per page,
 *   - inside each <url>, one <xhtml:link rel="alternate" hreflang="<lang>"/>
 *     for every counterpart (including self), plus an x-default,
 *   - for missing counterparts, the hreflang for that language points at the
 *     language home as a graceful fallback.
 */
describe("build - per-language URL trees", () => {
  test("emits index.html for the default-language home", () => {
    const dist = build(fixture);
    expect(dist.has("index.html")).toBe(true);
  });

  test("emits <slug>/index.html for default-language non-home pages", () => {
    const dist = build(fixture);
    expect(dist.has("despre/index.html")).toBe(true);
  });

  test("emits <lang>/index.html for the secondary-language home", () => {
    const dist = build(fixture);
    expect(dist.has("en/index.html")).toBe(true);
  });

  test("emits <lang>/<slug>/index.html for secondary-language non-home pages", () => {
    const dist = build(fixture);
    expect(dist.has("en/about/index.html")).toBe(true);
  });

  test("the output Map contains exactly the expected per-language paths", () => {
    const dist = build(fixture);
    expect([...dist.keys()].sort()).toEqual([
      "_lighthouse-budget.json",
      "despre/index.html",
      "en/about/index.html",
      "en/index.html",
      "index.html",
      "robots.txt",
      "sitemap.xml",
    ]);
  });

  test("each page contains a language switcher with native names", () => {
    const dist = build(fixture);
    for (const path of [
      "index.html",
      "despre/index.html",
      "en/index.html",
      "en/about/index.html",
    ]) {
      const html = textOf(dist, path);
      expect(html).toMatch(/<nav[^>]*data-language-switcher/);
      expect(html).toContain("Română");
      expect(html).toContain("English");
    }
  });

  test("each page contains hreflang alternates in head", () => {
    const dist = build(fixture);
    for (const path of [
      "index.html",
      "despre/index.html",
      "en/index.html",
      "en/about/index.html",
    ]) {
      const html = textOf(dist, path);
      expect(html).toMatch(/<link rel="alternate" hreflang="ro" href=/);
      expect(html).toMatch(/<link rel="alternate" hreflang="en" href=/);
      expect(html).toMatch(/<link rel="alternate" hreflang="x-default" href=/);
    }
  });

  test("hreflang URLs become absolute when siteUrl is provided", () => {
    const dist = build(fixture, { siteUrl: "https://stub.example.org" });
    const aboutEn = textOf(dist, "en/about/index.html");
    expect(aboutEn).toMatch(
      /<link rel="alternate" hreflang="ro" href="https:\/\/stub\.example\.org\/despre\/"/,
    );
    expect(aboutEn).toMatch(
      /<link rel="alternate" hreflang="en" href="https:\/\/stub\.example\.org\/en\/about\/"/,
    );
    expect(aboutEn).toMatch(
      /<link rel="alternate" hreflang="x-default" href="https:\/\/stub\.example\.org\/despre\/"/,
    );
  });

  test("with siteUrl, each page's canonical points at the per-language path", () => {
    const dist = build(fixture, { siteUrl: "https://stub.example.org" });
    expect(textOf(dist, "en/index.html")).toMatch(
      /<link rel="canonical" href="https:\/\/stub\.example\.org\/en\/"/,
    );
    expect(textOf(dist, "en/about/index.html")).toMatch(
      /<link rel="canonical" href="https:\/\/stub\.example\.org\/en\/about\/"/,
    );
  });
});

describe("build - sitemap hreflang alternates", () => {
  test("declares the xhtml namespace on the urlset element", () => {
    const dist = build(fixture);
    const sitemap = textOf(dist, "sitemap.xml");
    expect(sitemap).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });

  test("contains one <url> entry per page (4 in this fixture)", () => {
    const dist = build(fixture);
    const sitemap = textOf(dist, "sitemap.xml");
    const urlOpens = sitemap.match(/<url>/g) ?? [];
    expect(urlOpens.length).toBe(4);
  });

  test("each <url> contains hreflang alternates for every language plus x-default", () => {
    const dist = build(fixture, { siteUrl: "https://stub.example.org" });
    const sitemap = textOf(dist, "sitemap.xml");
    expect(sitemap).toContain(
      '<xhtml:link rel="alternate" hreflang="ro" href="https://stub.example.org/"/>',
    );
    expect(sitemap).toContain(
      '<xhtml:link rel="alternate" hreflang="en" href="https://stub.example.org/en/"/>',
    );
    expect(sitemap).toContain(
      '<xhtml:link rel="alternate" hreflang="x-default" href="https://stub.example.org/"/>',
    );
  });

  test("non-home cross-language alternates use the localizedAs counterpart", () => {
    const dist = build(fixture, { siteUrl: "https://stub.example.org" });
    const sitemap = textOf(dist, "sitemap.xml");
    expect(sitemap).toContain(
      '<xhtml:link rel="alternate" hreflang="ro" href="https://stub.example.org/despre/"/>',
    );
    expect(sitemap).toContain(
      '<xhtml:link rel="alternate" hreflang="en" href="https://stub.example.org/en/about/"/>',
    );
  });

  test("preserves page declaration order (deterministic)", () => {
    const dist = build(fixture);
    const sitemap = textOf(dist, "sitemap.xml");
    const acasaIdx = sitemap.indexOf("<loc>/</loc>");
    const despreIdx = sitemap.indexOf("<loc>/despre/</loc>");
    const enHomeIdx = sitemap.indexOf("<loc>/en/</loc>");
    const enAboutIdx = sitemap.indexOf("<loc>/en/about/</loc>");
    expect(acasaIdx).toBeLessThan(despreIdx);
    expect(despreIdx).toBeLessThan(enHomeIdx);
    expect(enHomeIdx).toBeLessThan(enAboutIdx);
  });
});

describe("build - i18n determinism", () => {
  test("repeated calls produce identical output", () => {
    const a = build(fixture);
    const b = build(fixture);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });
});
