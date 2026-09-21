/**
 * Asset references must resolve from the page that emits them.
 *
 * The renderer emits directory-style pages (`activitati/index.html`), so a
 * bare `assets/hero.jpg` reference resolves against the page's own folder and
 * 404s everywhere except the home page. Before this suite existed the zip
 * export hid the breakage by mirroring the whole asset folder into every page
 * directory; a raw `dist/` folder produced by `build()` alone was broken.
 *
 * The contract asserted here: every `assets/...` reference carries exactly one
 * `../` hop per level of page depth, and the editor preview's blob resolver
 * still wins outright (blob URLs are absolute — prefixing them would break
 * them).
 */
import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import multiPage from "./fixtures/multi-page.json" with { type: "json" };
import bilingual from "./fixtures/bilingual.json" with { type: "json" };
import { renderSite } from "../src/index.js";
import { assetPrefixForDistPath, depthAwareAssetResolver } from "../src/asset-url.js";

const LOGO = {
  hash: "logo",
  path: "assets/logo.png",
  metadataPath: "assets/logo.metadata.json",
  mime: "image/png",
  width: 512,
  height: 512,
  alt: "Stub Org logo",
} as const;

function withLogo(site: Site): Site {
  const clone = structuredClone(site);
  clone.org.logo = { ...LOGO };
  clone.org.logoAlt = LOGO.alt;
  return clone;
}

/** Every `assets/...` reference in `src`/`href` attributes and in CSS `url()`. */
function assetRefs(html: string): string[] {
  const refs: string[] = [];
  for (const m of html.matchAll(/(?:src|href)="((?:\.\.\/)*assets\/[^"]+)"/g)) refs.push(m[1]!);
  for (const m of html.matchAll(/url\(((?:\.\.\/)*assets\/[^)]+)\)/g)) refs.push(m[1]!);
  return refs;
}

describe("assetPrefixForDistPath", () => {
  test("counts one ../ hop per directory level below the dist root", () => {
    expect(assetPrefixForDistPath("index.html")).toBe("");
    expect(assetPrefixForDistPath("activitati/index.html")).toBe("../");
    expect(assetPrefixForDistPath("en/activitati/index.html")).toBe("../../");
  });
});

describe("depthAwareAssetResolver", () => {
  test("is a no-op at depth zero", () => {
    const resolver = depthAwareAssetResolver(undefined, "");
    expect(resolver).toBeUndefined();
  });

  test("prefixes unresolved relative paths only", () => {
    const resolver = depthAwareAssetResolver(undefined, "../")!;
    expect(resolver("assets/a.png")).toBe("../assets/a.png");
    expect(resolver("/assets/a.png")).toBe("/assets/a.png");
    expect(resolver("https://cdn.example/a.png")).toBe("https://cdn.example/a.png");
    expect(resolver("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
  });

  test("a caller-resolved URL (the preview's blob:) wins and is never prefixed", () => {
    const resolver = depthAwareAssetResolver(
      (p) => (p === "assets/a.png" ? "blob:http://editor/abc" : undefined),
      "../../",
    )!;
    expect(resolver("assets/a.png")).toBe("blob:http://editor/abc");
    expect(resolver("assets/b.png")).toBe("../../assets/b.png");
  });
});

describe("renderSite — asset references resolve from the emitting page", () => {
  test("the home page emits bare asset paths", () => {
    const html = renderSite(withLogo(multiPage as unknown as Site), "academic");
    const refs = assetRefs(html);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(ref.startsWith("../")).toBe(false);
  });

  test("a one-level-deep page prefixes every asset reference with ../", () => {
    const html = renderSite(withLogo(multiPage as unknown as Site), "academic", { pageIndex: 1 });
    const refs = assetRefs(html);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(ref.startsWith("../assets/")).toBe(true);
  });

  test("a two-level-deep secondary-language page uses ../../", () => {
    const site = withLogo(bilingual as unknown as Site);
    const deepIndex = site.pages.findIndex(
      (p) => p.lang !== site.defaultLanguage && p.navOrder !== 0,
    );
    expect(deepIndex).toBeGreaterThanOrEqual(0);
    const html = renderSite(site, "academic", { pageIndex: deepIndex });
    const refs = assetRefs(html);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(ref.startsWith("../../assets/")).toBe(true);
  });

  test("preview blob URLs are emitted verbatim on a nested page", () => {
    const html = renderSite(withLogo(multiPage as unknown as Site), "academic", {
      pageIndex: 1,
      mode: "preview",
      assetUrlForPath: (p) => `blob:http://editor/${p}`,
    });
    expect(html).toContain("blob:http://editor/assets/logo.png");
    expect(html).not.toContain("../blob:");
  });
});
