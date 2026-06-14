import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import { renderSite, usedFamiliesFor, fontAssetsFor } from "../src/index.js";

const fixture = heroOnly as unknown as Site;

/** Clone the hero-only fixture with a fresh theme block. */
function siteWithTheme(theme: Site["theme"]): Site {
  const site = structuredClone(fixture) as Site;
  site.theme = theme;
  return site;
}

// A site that forces a single self-hosted family via a user override. It rides
// on the `stub` theme (whose baseline fonts are system stacks: Georgia /
// system-ui), so overriding only `fontHeadline` leaves the body on a system
// font and the sole emitted family is Space Grotesk. (On `minimal` the baseline
// already pins both slots to Inter, which would add Inter to the used set.)
const spaceGroteskSite = siteWithTheme({
  id: "stub",
  tokens: { fontHeadline: '"Space Grotesk", system-ui, sans-serif' },
});

describe("@font-face emission (gated)", () => {
  test("a self-hosted family override emits matching @font-face rules", () => {
    const html = renderSite(spaceGroteskSite, "stub");
    expect(html).toContain('@font-face{font-family:"Space Grotesk"');
    expect(html).toContain("font-display:swap");
    expect(html).toMatch(/src:url\(assets\/fonts\/space-grotesk-[^)]+\) format\("woff2"\)/);
    // The latin-ext face carries the Romanian Ș/Ț range.
    expect(html).toContain("U+0100-02BA");
  });

  test("@font-face rules appear before :root in the composed CSS", () => {
    const html = renderSite(spaceGroteskSite, "stub");
    const face = html.indexOf("@font-face");
    const root = html.indexOf(":root");
    expect(face).toBeGreaterThanOrEqual(0);
    expect(root).toBeGreaterThan(face);
  });

  test("usedFamiliesFor returns the registry-gated family", () => {
    expect(usedFamiliesFor(spaceGroteskSite, "stub")).toEqual(["Space Grotesk"]);
  });
});

describe("@font-face emission (negative — system fonts)", () => {
  test("a system-font site on stub emits zero @font-face and no used families", () => {
    const html = renderSite(fixture, "stub");
    expect(html).not.toContain("@font-face");
    expect(usedFamiliesFor(fixture, "stub")).toEqual([]);
  });
});

describe("fontAssetsFor", () => {
  test("maps assets/fonts/*.woff2 paths to valid woff2 byte arrays", () => {
    const assets = fontAssetsFor(spaceGroteskSite, "stub");
    expect(assets.size).toBeGreaterThan(0);
    for (const [path, bytes] of assets) {
      expect(path).toMatch(/^assets\/fonts\/space-grotesk-.+\.woff2$/);
      expect(bytes).toBeInstanceOf(Uint8Array);
      // woff2 magic number: ASCII "wOF2" = 0x77 0x4F 0x46 0x32.
      expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x77, 0x4f, 0x46, 0x32]);
    }
  });

  test("returns an empty map for a system-font site", () => {
    expect(fontAssetsFor(fixture, "stub").size).toBe(0);
  });
});

describe("determinism", () => {
  test("two renders of the same self-hosted site are byte-identical", () => {
    const a = renderSite(spaceGroteskSite, "stub");
    const b = renderSite(structuredClone(spaceGroteskSite) as Site, "stub");
    expect(a).toBe(b);
  });
});

describe("preview asset resolver", () => {
  test("an assetUrlForPath resolver rewrites the @font-face src URL", () => {
    const html = renderSite(spaceGroteskSite, "stub", {
      assetUrlForPath: (path) => `blob:fake/${path}`,
    });
    expect(html).toMatch(/src:url\(blob:fake\/assets\/fonts\/space-grotesk-[^)]+\)/);
    // The canonical (unresolved) path should not leak as a raw src.
    expect(html).not.toMatch(/src:url\(assets\/fonts\//);
  });
});
