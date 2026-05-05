import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import singlePageSite from "./fixtures/single-page-site.json" with { type: "json" };
import { build } from "../src/index.js";

const fixture = singlePageSite as unknown as Site;

/**
 * AC #3 — Open Graph and basic SEO meta tags present on rendered HTML.
 *
 * The renderer (`@sosb/renderer`) already emits title/description/og:title/
 * og:description/og:type from page SEO data. The build pipeline layers on
 * top: canonical, og:url, and og:image (when a hero has backgroundImage),
 * conditional on a `siteUrl` being provided.
 */
describe("build — SEO meta (renderer-provided baseline)", () => {
  test("emits a <title> from page SEO", () => {
    const dist = build(fixture);
    const html = dist.get("index.html")!;
    expect(html).toContain("<title>Asociația Stub — Acasă</title>");
  });

  test("emits <meta name=\"description\"> from page SEO", () => {
    const dist = build(fixture);
    const html = dist.get("index.html")!;
    expect(html).toMatch(
      /<meta name="description" content="Bun venit pe site-ul de test al pipeline-ului de build\./,
    );
  });

  test("emits <meta property=\"og:title\">", () => {
    const dist = build(fixture);
    const html = dist.get("index.html")!;
    expect(html).toMatch(/<meta property="og:title" content="Asociația Stub — Acasă"/);
  });

  test("emits <meta property=\"og:description\">", () => {
    const dist = build(fixture);
    const html = dist.get("index.html")!;
    expect(html).toMatch(/<meta property="og:description"/);
  });

  test("emits <meta property=\"og:type\" content=\"website\">", () => {
    const dist = build(fixture);
    const html = dist.get("index.html")!;
    expect(html).toMatch(/<meta property="og:type" content="website"/);
  });
});

describe("build — SEO meta (build-pipeline overlay)", () => {
  test("with siteUrl, emits <link rel=\"canonical\"> pointing at the site URL", () => {
    const dist = build(fixture, { siteUrl: "https://stub.example.org" });
    const html = dist.get("index.html")!;
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/stub\.example\.org\/"/);
  });

  test("with siteUrl, emits <meta property=\"og:url\"> matching the canonical", () => {
    const dist = build(fixture, { siteUrl: "https://stub.example.org" });
    const html = dist.get("index.html")!;
    expect(html).toMatch(/<meta property="og:url" content="https:\/\/stub\.example\.org\/"/);
  });

  test("with siteUrl AND a hero backgroundImage, emits <meta property=\"og:image\">", () => {
    const dist = build(fixture, { siteUrl: "https://stub.example.org" });
    const html = dist.get("index.html")!;
    // The hero in the fixture has backgroundImage = "assets/hero.jpg".
    expect(html).toMatch(
      /<meta property="og:image" content="https:\/\/stub\.example\.org\/assets\/hero\.jpg"/,
    );
  });

  test("trailing slash on siteUrl is normalised", () => {
    const dist = build(fixture, { siteUrl: "https://stub.example.org/" });
    const html = dist.get("index.html")!;
    // No "//" double-slash sneaking into URLs.
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/stub\.example\.org\/"/);
    expect(html).not.toMatch(/href="https:\/\/stub\.example\.org\/\//);
    expect(html).not.toMatch(/content="https:\/\/stub\.example\.org\/\/assets/);
  });

  test("without siteUrl, does NOT emit canonical/og:url/og:image (renderer baseline only)", () => {
    const dist = build(fixture);
    const html = dist.get("index.html")!;
    expect(html).not.toMatch(/<link rel="canonical"/);
    expect(html).not.toMatch(/<meta property="og:url"/);
    expect(html).not.toMatch(/<meta property="og:image"/);
  });

  test("with siteUrl but no hero backgroundImage, does NOT emit og:image", () => {
    const noImage = structuredClone(fixture) as Site;
    delete (noImage.pages[0]!.blocks[0]!.data as { backgroundImage?: string }).backgroundImage;
    const dist = build(noImage, { siteUrl: "https://stub.example.org" });
    const html = dist.get("index.html")!;
    expect(html).toMatch(/<meta property="og:url"/); // url still present
    expect(html).not.toMatch(/<meta property="og:image"/);
  });

  test("absolute URLs in hero backgroundImage are preserved (not double-prefixed)", () => {
    const absUrl = structuredClone(fixture) as Site;
    (absUrl.pages[0]!.blocks[0]!.data as { backgroundImage?: string }).backgroundImage =
      "https://cdn.example.com/hero.jpg";
    const dist = build(absUrl, { siteUrl: "https://stub.example.org" });
    const html = dist.get("index.html")!;
    expect(html).toMatch(
      /<meta property="og:image" content="https:\/\/cdn\.example\.com\/hero\.jpg"/,
    );
  });

  test("the build-pipeline overlay is additive: every byte the renderer emitted is still in the output", async () => {
    const { renderSite } = await import("@sosb/renderer");
    const baseline = renderSite(fixture, fixture.theme.id);
    const dist = build(fixture, { siteUrl: "https://stub.example.org" });
    const html = dist.get("index.html")!;

    // The renderer's output ends with `</html>`. The body of the output (everything outside
    // <head>) must be unchanged. We verify by stripping the head from each and comparing.
    const stripHead = (s: string): string => s.replace(/<head>[\s\S]*?<\/head>/, "<head/>");
    expect(stripHead(html)).toBe(stripHead(baseline));
  });
});
