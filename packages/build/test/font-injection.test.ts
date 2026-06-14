import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import singlePageSite from "./fixtures/single-page-site.json" with { type: "json" };
import { build, BUDGET_LIMITS } from "../src/index.js";
import { textOf } from "./helpers/dist-text.js";

/**
 * PR-F2b — `build()` carries self-hosted font bytes.
 *
 * The renderer (PR-F2a) emits `@font-face { src:url(assets/fonts/<file>.woff2) }`
 * for the families a site/theme actually uses; `build()` must place the matching
 * woff2 bytes at that path so the deployed site serves them over `font-src
 * 'self'`. These tests are theme-independent: they drive the used family through
 * a `fontHeadline` token override on the `stub` theme rather than depending on a
 * particular production theme's typography.
 */

/** woff2 files begin with the ASCII signature `wOF2`. */
const WOFF2_MAGIC = [0x77, 0x4f, 0x46, 0x32]; // 'w','O','F','2'

function siteWithFont(): Site {
  const base = structuredClone(singlePageSite) as unknown as {
    theme: { id: string; tokens: Record<string, unknown> };
  };
  base.theme = {
    id: "stub",
    tokens: { fontHeadline: '"Space Grotesk", system-ui, sans-serif' },
  };
  return base as unknown as Site;
}

describe("build — self-hosted font injection", () => {
  test("injects assets/fonts/space-grotesk-*.woff2 entries as Uint8Array bytes", () => {
    const dist = build(siteWithFont());
    const fontKeys = [...dist.keys()].filter(
      (k) => k.startsWith("assets/fonts/space-grotesk-") && k.endsWith(".woff2"),
    );
    expect(fontKeys.length).toBeGreaterThan(0);

    for (const key of fontKeys) {
      const value = dist.get(key);
      expect(value).toBeInstanceOf(Uint8Array);
      const bytes = value as Uint8Array;
      // woff2 signature: first 4 bytes spell 'wOF2'.
      expect(Array.from(bytes.subarray(0, 4))).toEqual(WOFF2_MAGIC);
    }
  });

  test("the HTML carries the matching @font-face referencing the injected path", () => {
    const dist = build(siteWithFont());
    const html = textOf(dist, "index.html");
    expect(html).toContain('font-family:"Space Grotesk"');
    // Every injected font path is referenced by an @font-face src in the HTML.
    const fontKeys = [...dist.keys()].filter(
      (k) => k.startsWith("assets/fonts/") && k.endsWith(".woff2"),
    );
    for (const key of fontKeys) {
      expect(html).toContain(`src:url(${key})`);
    }
  });

  test("the budget report's fonts metric is > 0 and within limit", () => {
    const dist = build(siteWithFont());
    const report = JSON.parse(textOf(dist, "_lighthouse-budget.json"));
    const fonts = report.pages["index.html"].metrics.fonts;
    expect(fonts.status).toBe("pass");
    expect(fonts.bytes).toBeGreaterThan(0);
    expect(fonts.bytes).toBeLessThanOrEqual(BUDGET_LIMITS.fonts);
    expect(fonts.limitBytes).toBe(BUDGET_LIMITS.fonts);
  });

  test("font bytes do NOT inflate the CSS metric (woff2 excluded from CSS budget)", () => {
    const withFonts = build(siteWithFont());
    const report = JSON.parse(textOf(withFonts, "_lighthouse-budget.json"));
    const css = report.pages["index.html"].metrics.css;
    // CSS metric stays comfortably under the 15KB gzipped budget — the woff2
    // bytes (tens of KB raw) never enter the CSS measurement.
    expect(css.status).toBe("pass");
    expect(css.bytes).toBeLessThan(BUDGET_LIMITS.cssGzipped);
  });

  test("injection is deterministic — repeat builds are byte-identical", () => {
    const a = build(siteWithFont());
    const b = build(siteWithFont());
    const aKeys = [...a.keys()].sort();
    const bKeys = [...b.keys()].sort();
    expect(aKeys).toEqual(bKeys);
    for (const key of aKeys) {
      const av = a.get(key)!;
      const bv = b.get(key)!;
      if (av instanceof Uint8Array && bv instanceof Uint8Array) {
        expect(Array.from(av)).toEqual(Array.from(bv));
      } else {
        expect(av).toBe(bv);
      }
    }
  });
});

describe("build — system-font site ships no fonts", () => {
  const fixture = singlePageSite as unknown as Site;

  test("no assets/fonts/* entries are emitted for a system-font (stub) theme", () => {
    const dist = build(fixture);
    const fontKeys = [...dist.keys()].filter((k) => k.startsWith("assets/fonts/"));
    expect(fontKeys).toEqual([]);
  });

  test("the fonts metric reports 'skipped' when the site ships no fonts", () => {
    const dist = build(fixture);
    const report = JSON.parse(textOf(dist, "_lighthouse-budget.json"));
    const fonts = report.pages["index.html"].metrics.fonts;
    expect(fonts.status).toBe("skipped");
    expect(fonts.bytes).toBeUndefined();
    expect(fonts.note).toBeDefined();
  });
});
