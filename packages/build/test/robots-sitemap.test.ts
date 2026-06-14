import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import singlePageSite from "./fixtures/single-page-site.json" with { type: "json" };
import { build } from "../src/index.js";
import { textOf } from "./helpers/dist-text.js";

const fixture = singlePageSite as unknown as Site;

/**
 * `robots.txt` — minimal, deterministic, single-language, single-page.
 */
describe("build — robots.txt", () => {
  test("contains a `User-agent: *` line", () => {
    const dist = build(fixture);
    const robots = textOf(dist, "robots.txt");
    expect(robots).toMatch(/^User-agent:\s*\*/m);
  });

  test("does NOT block the site by default (no global Disallow)", () => {
    const dist = build(fixture);
    const robots = textOf(dist, "robots.txt");
    expect(robots).toMatch(/^Allow:\s*\//m);
  });

  test("references the sitemap when siteUrl is provided", () => {
    const dist = build(fixture, { siteUrl: "https://stub.example.org" });
    const robots = textOf(dist, "robots.txt");
    expect(robots).toMatch(/^Sitemap:\s*https:\/\/stub\.example\.org\/sitemap\.xml/m);
  });

  test("omits the Sitemap directive when no siteUrl is provided", () => {
    const dist = build(fixture);
    const robots = textOf(dist, "robots.txt");
    expect(robots).not.toMatch(/^Sitemap:/m);
  });

  test("ends with a single trailing newline (POSIX-ish convention)", () => {
    const dist = build(fixture);
    const robots = textOf(dist, "robots.txt");
    expect(robots.endsWith("\n")).toBe(true);
    expect(robots.endsWith("\n\n")).toBe(false);
  });
});

/**
 * `sitemap.xml` — single-page, single-language for v1. Multi-page entries
 * and `xhtml:link rel="alternate"` per language land in #23 + #24.
 */
describe("build — sitemap.xml", () => {
  test("starts with the XML declaration", () => {
    const dist = build(fixture);
    const sitemap = textOf(dist, "sitemap.xml");
    expect(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  test("declares the sitemap.org urlset namespace", () => {
    const dist = build(fixture);
    const sitemap = textOf(dist, "sitemap.xml");
    expect(sitemap).toMatch(/<urlset[^>]*xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
  });

  test("contains exactly one <url> entry for the home page (single-page v1)", () => {
    const dist = build(fixture);
    const sitemap = textOf(dist, "sitemap.xml");
    const urlOpens = sitemap.match(/<url>/g) ?? [];
    expect(urlOpens.length).toBe(1);
  });

  test("the home URL uses siteUrl when provided", () => {
    const dist = build(fixture, { siteUrl: "https://stub.example.org" });
    const sitemap = textOf(dist, "sitemap.xml");
    expect(sitemap).toMatch(/<loc>https:\/\/stub\.example\.org\/<\/loc>/);
  });

  test("the home URL falls back to a relative root when no siteUrl is provided", () => {
    const dist = build(fixture);
    const sitemap = textOf(dist, "sitemap.xml");
    // Without siteUrl, `<loc>/</loc>` is the v1 fallback. This is technically a
    // partial sitemap (search engines want absolute URLs), but it lets us emit a
    // structurally-valid file before the user has decided where they will host.
    expect(sitemap).toMatch(/<loc>\/<\/loc>/);
  });

  test("does NOT emit hreflang alternates (those are #24's contract)", () => {
    const dist = build(fixture);
    const sitemap = textOf(dist, "sitemap.xml");
    expect(sitemap).not.toMatch(/xmlns:xhtml/);
    expect(sitemap).not.toMatch(/<xhtml:link/);
    expect(sitemap).not.toMatch(/hreflang/);
  });

  test("ends with a closing </urlset> tag", () => {
    const dist = build(fixture);
    const sitemap = textOf(dist, "sitemap.xml");
    expect(sitemap).toMatch(/<\/urlset>\s*$/);
  });
});
