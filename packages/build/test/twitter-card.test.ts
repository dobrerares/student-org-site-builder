import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import singlePageSite from "./fixtures/single-page-site.json" with { type: "json" };
import { build } from "../src/index.js";

const fixture = singlePageSite as unknown as Site;

/**
 * Twitter Card overlay (build pipeline).
 *
 * The renderer emits twitter:card / twitter:title / twitter:description /
 * twitter:image with relative image URLs. With siteUrl set, the build
 * pipeline rewrites twitter:image to an absolute URL (parity with og:image).
 */
describe("build - Twitter Card overlay (siteUrl absolutisation)", () => {
  test("with siteUrl, twitter:image is rewritten to an absolute URL", () => {
    const dist = build(fixture, { siteUrl: "https://stub.example.org" });
    const html = dist.get("index.html")!;
    expect(html).toMatch(
      /<meta name="twitter:image" content="https:\/\/stub\.example\.org\/assets\/hero\.jpg"/,
    );
    // No relative-form leftover
    expect(html).not.toMatch(/<meta name="twitter:image" content="assets\/hero\.jpg"/);
  });

  test("without siteUrl, twitter:image stays whatever the renderer produced (relative)", () => {
    const dist = build(fixture);
    const html = dist.get("index.html")!;
    expect(html).toMatch(/<meta name="twitter:image" content="assets\/hero\.jpg"/);
  });

  test("absolute Twitter image URLs in the renderer output are not double-prefixed", () => {
    const absUrl = structuredClone(fixture) as Site;
    (absUrl.pages[0]!.blocks[0]!.data as { backgroundImage?: { path: string } }).backgroundImage =
      {
        hash: "cdn",
        path: "https://cdn.example.com/hero.jpg",
        metadataPath: "assets/cdn.metadata.json",
        mime: "image/jpeg",
        width: 1600,
        height: 1067,
        alt: "CDN hero",
      };
    const dist = build(absUrl, { siteUrl: "https://stub.example.org" });
    const html = dist.get("index.html")!;
    expect(html).toMatch(
      /<meta name="twitter:image" content="https:\/\/cdn\.example\.com\/hero\.jpg"/,
    );
    expect(html).not.toMatch(/twitter:image" content="https:\/\/stub\.example\.org\/https/);
  });
});
