import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import singlePageSite from "./fixtures/single-page-site.json" with { type: "json" };
import { build } from "../src/index.js";

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

  test("contains exactly those three paths for a single-page site", () => {
    const dist = build(fixture);
    expect([...dist.keys()].sort()).toEqual(["index.html", "robots.txt", "sitemap.xml"]);
  });

  test("emits string contents at every path (text-only — assets land in #8)", () => {
    const dist = build(fixture);
    for (const value of dist.values()) {
      expect(typeof value).toBe("string");
    }
  });

  test("index.html is a complete HTML document", () => {
    const dist = build(fixture);
    const html = dist.get("index.html");
    expect(html).toBeDefined();
    expect(html!.startsWith("<!doctype html>")).toBe(true);
    expect(html!).toContain("<html");
    expect(html!).toContain("</html>");
  });
});

/**
 * AC #2 — HTML output is identical to renderSite() output for the same data.
 *
 * Without `siteUrl`, the build pipeline emits the renderer's output verbatim.
 * With `siteUrl`, the pipeline performs additive head-injection (canonical,
 * og:url, og:image) — every other byte is preserved.
 */
describe("build — HTML byte-identity with renderSite", () => {
  test("dist/index.html equals renderSite(site, themeId) when no siteUrl is provided", async () => {
    const { renderSite } = await import("@sosb/renderer");
    const expected = renderSite(fixture, fixture.theme.id);
    const dist = build(fixture);
    expect(dist.get("index.html")).toBe(expected);
  });

  test("dist/index.html equals renderSite(site, themeId) for a default options object too", async () => {
    const { renderSite } = await import("@sosb/renderer");
    const expected = renderSite(fixture, fixture.theme.id);
    const dist = build(fixture, {});
    expect(dist.get("index.html")).toBe(expected);
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
