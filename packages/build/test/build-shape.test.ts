import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import singlePageSite from "./fixtures/single-page-site.json" with { type: "json" };
import { build } from "../src/index.js";
import { textOf } from "./helpers/dist-text.js";

const fixture = singlePageSite as unknown as Site;

/**
 * AC #1 — `build(fixtureSite)` returns a virtual directory with
 * `index.html`, `robots.txt`, `sitemap.xml`.
 *
 * The dist folder is modelled as `Map<string, string>` so the same code path
 * runs in the browser editor and in Node — see ADR 0004 for the rationale.
 */
describe("build — output shape", () => {
  test("returns a Map", () => {
    const dist = build(fixture);
    expect(dist).toBeInstanceOf(Map);
  });

  test("contains index.html, robots.txt, and sitemap.xml", () => {
    const dist = build(fixture);
    expect(dist.has("index.html")).toBe(true);
    expect(dist.has("robots.txt")).toBe(true);
    expect(dist.has("sitemap.xml")).toBe(true);
  });

  test("contains exactly those four paths for a single-page site (incl. budget report)", () => {
    // `_lighthouse-budget.json` is added by issue #41 / ADR 0005 — the per-page
    // Lighthouse-budget verification artefact. The leading underscore signals
    // "build metadata, not a hostable page".
    const dist = build(fixture);
    expect([...dist.keys()].sort()).toEqual([
      "_lighthouse-budget.json",
      "index.html",
      "robots.txt",
      "sitemap.xml",
    ]);
  });

  test("emits string contents at every path (text-only — assets land in #8)", () => {
    const dist = build(fixture);
    for (const value of dist.values()) {
      expect(typeof value).toBe("string");
    }
  });

  test("index.html is a complete HTML document", () => {
    const dist = build(fixture);
    const html = textOf(dist, "index.html");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });
});

/**
 * AC #2 — HTML output preserves the renderer's body and `<head>` baseline.
 *
 * Without `siteUrl`, the build pipeline emits the renderer's output plus
 * the JSON-LD overlay (Organization is always emitted per #39). With
 * `siteUrl`, the pipeline performs additive head-injection (canonical,
 * og:url, og:image, twitter:image absolute, hreflang absolute, JSON-LD) —
 * every byte the renderer produced outside `<head>` stays untouched.
 */
describe("build — HTML preserves the renderer's body bytes", () => {
  test("dist/index.html body matches renderSite() body when no siteUrl is provided", async () => {
    const { renderSite } = await import("@sosb/renderer");
    const expected = renderSite(fixture, fixture.theme.id);
    const dist = build(fixture);
    const stripHead = (s: string): string => s.replace(/<head>[\s\S]*?<\/head>/, "<head/>");
    expect(stripHead(textOf(dist, "index.html"))).toBe(stripHead(expected));
  });

  test("the no-siteUrl head adds JSON-LD on top of the renderer's head bytes", async () => {
    const { renderSite } = await import("@sosb/renderer");
    const expected = renderSite(fixture, fixture.theme.id);
    const dist = build(fixture);
    const html = textOf(dist, "index.html");
    // Every byte the renderer produced in `<head>` survives — we only
    // append additional tags before `</head>`.
    const baselineHead = expected.match(/<head>[\s\S]*?<\/head>/)![0];
    const baselineWithoutClose = baselineHead.slice(0, -"</head>".length);
    expect(html).toContain(baselineWithoutClose);
    expect(html).toMatch(/<script type="application\/ld\+json">/);
  });
});

/**
 * Determinism — same input produces same output, byte-for-byte.
 *
 * Same Map keys, same values per key. We compare via JSON-encoding the
 * Map's entries because Map equality is reference-based.
 */
describe("build — determinism", () => {
  test("repeated calls with the same input produce identical output", () => {
    const a = build(fixture);
    const b = build(fixture);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  test("structurally-cloned input produces identical output", () => {
    const a = build(fixture);
    const b = build(structuredClone(fixture));
    expect([...a.entries()]).toEqual([...b.entries()]);
  });
});
