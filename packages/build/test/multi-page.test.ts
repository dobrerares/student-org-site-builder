import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import multiPageSite from "./fixtures/multi-page-site.json" with { type: "json" };
import { build } from "../src/index.js";
import { textOf } from "./helpers/dist-text.js";

const fixture = multiPageSite as unknown as Site;

/**
 * AC #5 — Build emits per-page directory structure (`/<slug>/index.html`).
 *
 * Home page (defaultLanguage + navOrder=0) → dist/index.html.
 * Every other page → dist/<slug>/index.html.
 */
describe("build — multi-page output structure", () => {
  test("emits index.html for the home page", () => {
    const dist = build(fixture);
    expect(dist.has("index.html")).toBe(true);
  });

  test("emits <slug>/index.html for every non-home page", () => {
    const dist = build(fixture);
    expect(dist.has("despre/index.html")).toBe(true);
    expect(dist.has("puterea-cuvintelor/index.html")).toBe(true);
  });

  test("emits robots.txt and sitemap.xml alongside the per-page HTML", () => {
    const dist = build(fixture);
    expect(dist.has("robots.txt")).toBe(true);
    expect(dist.has("sitemap.xml")).toBe(true);
  });

  test("the output Map contains exactly the expected keys (no stray paths)", () => {
    const dist = build(fixture);
    expect([...dist.keys()].sort()).toEqual([
      "_lighthouse-budget.json",
      "despre/index.html",
      "index.html",
      "puterea-cuvintelor/index.html",
      "robots.txt",
      "sitemap.xml",
    ]);
  });

  test("each per-page HTML file contains its own SEO title", () => {
    const dist = build(fixture);
    expect(textOf(dist, "index.html")).toContain("<title>Asociația Stub — Acasă</title>");
    expect(textOf(dist, "despre/index.html")).toContain("<title>Asociația Stub — Despre</title>");
    expect(textOf(dist, "puterea-cuvintelor/index.html")).toContain(
      "<title>Asociația Stub — Puterea cuvintelor</title>",
    );
  });

  test("each per-page HTML file contains the site nav with three entries", () => {
    const dist = build(fixture);
    for (const path of ["index.html", "despre/index.html", "puterea-cuvintelor/index.html"]) {
      const html = textOf(dist, path);
      expect(html).toMatch(/<nav[^>]*data-site-nav/);
      expect(html).toContain("Acasă");
      expect(html).toContain("Despre");
      expect(html).toContain("Puterea cuvintelor");
    }
  });

  test("active page is correct in each rendered HTML file", () => {
    const dist = build(fixture);
    const home = textOf(dist, "index.html");
    expect(home).toMatch(/<a[^>]*href="\/"[^>]*data-active="true"/);
    expect(home).toMatch(/<a[^>]*href="\/despre\/"[^>]*data-active="false"/);

    const about = textOf(dist, "despre/index.html");
    expect(about).toMatch(/<a[^>]*href="\/despre\/"[^>]*data-active="true"/);
    expect(about).toMatch(/<a[^>]*href="\/"[^>]*data-active="false"/);
  });

  test("with siteUrl, each page's canonical points at its own path", () => {
    const dist = build(fixture, { siteUrl: "https://stub.example.org" });
    const home = textOf(dist, "index.html");
    expect(home).toMatch(
      /<link rel="canonical" href="https:\/\/stub\.example\.org\/"/,
    );
    const about = textOf(dist, "despre/index.html");
    expect(about).toMatch(
      /<link rel="canonical" href="https:\/\/stub\.example\.org\/despre\/"/,
    );
    const project = textOf(dist, "puterea-cuvintelor/index.html");
    expect(project).toMatch(
      /<link rel="canonical" href="https:\/\/stub\.example\.org\/puterea-cuvintelor\/"/,
    );
  });

  test("og:url per page uses the page's canonical URL", () => {
    const dist = build(fixture, { siteUrl: "https://stub.example.org" });
    expect(textOf(dist, "despre/index.html")).toMatch(
      /<meta property="og:url" content="https:\/\/stub\.example\.org\/despre\/"/,
    );
  });
});

/**
 * AC #6 — Sitemap contains entries for every page.
 */
describe("build — multi-page sitemap.xml", () => {
  test("contains one <url> entry per page", () => {
    const dist = build(fixture);
    const sitemap = textOf(dist, "sitemap.xml");
    const urlOpens = sitemap.match(/<url>/g) ?? [];
    expect(urlOpens.length).toBe(3);
  });

  test("entries use absolute URLs when siteUrl is provided", () => {
    const dist = build(fixture, { siteUrl: "https://stub.example.org" });
    const sitemap = textOf(dist, "sitemap.xml");
    expect(sitemap).toContain("<loc>https://stub.example.org/</loc>");
    expect(sitemap).toContain("<loc>https://stub.example.org/despre/</loc>");
    expect(sitemap).toContain("<loc>https://stub.example.org/puterea-cuvintelor/</loc>");
  });

  test("entries use path-relative URLs when no siteUrl is provided", () => {
    const dist = build(fixture);
    const sitemap = textOf(dist, "sitemap.xml");
    expect(sitemap).toContain("<loc>/</loc>");
    expect(sitemap).toContain("<loc>/despre/</loc>");
    expect(sitemap).toContain("<loc>/puterea-cuvintelor/</loc>");
  });

  test("preserves page declaration order (deterministic)", () => {
    const dist = build(fixture);
    const sitemap = textOf(dist, "sitemap.xml");
    const homeIdx = sitemap.indexOf("<loc>/</loc>");
    const aboutIdx = sitemap.indexOf("<loc>/despre/</loc>");
    const projectIdx = sitemap.indexOf("<loc>/puterea-cuvintelor/</loc>");
    expect(homeIdx).toBeLessThan(aboutIdx);
    expect(aboutIdx).toBeLessThan(projectIdx);
  });
});

/**
 * Determinism — multi-page builds stay byte-identical across runs.
 */
describe("build — multi-page determinism", () => {
  test("repeated calls with the same multi-page input produce identical output", () => {
    const a = build(fixture);
    const b = build(fixture);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  test("structurally-cloned multi-page input produces identical output", () => {
    const a = build(fixture);
    const b = build(structuredClone(fixture));
    expect([...a.entries()]).toEqual([...b.entries()]);
  });
});
