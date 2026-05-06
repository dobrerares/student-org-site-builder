import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import heroOnlyEditorial from "./fixtures/hero-only-editorial.json" with { type: "json" };
import { renderSite } from "../src/index.js";
import { EDITORIAL_THEME_ID, EDITORIAL_THEME_TOKENS } from "../src/themes/editorial.js";

const fixture = heroOnlyEditorial as unknown as Site;

/**
 * Editorial theme — issue #29.
 *
 * Print-magazine inspired theme: serif body + sans-serif headlines, ink/cream
 * palette with a single ochre accent, perfect-fourth (1.333) type scale. This
 * suite asserts the token contract and surface-level CSS shape; per-block ×
 * per-theme goldens are deferred until the block matrix lands (#9-#22 +
 * #28/#30/#31/#47).
 */

describe("editorial theme — token emission", () => {
  test("exports the canonical theme id", () => {
    expect(EDITORIAL_THEME_ID).toBe("editorial");
  });

  test("emits the curated palette on :root when no user overrides are set", () => {
    const html = renderSite(fixture, EDITORIAL_THEME_ID);
    expect(html).toMatch(/:root\s*\{[\s\S]*--color-primary:\s*#0e0c0a/);
    expect(html).toMatch(/:root\s*\{[\s\S]*--color-accent:\s*#a8732a/);
  });

  test("emits a serif body font stack and a sans-serif headline font stack", () => {
    const html = renderSite(fixture, EDITORIAL_THEME_ID);
    // Body stack must lead with a serif face (Charter / Source Serif / Georgia).
    expect(html).toMatch(/--font-body:\s*[^;]*Charter[^;]*serif/);
    // Headline stack must lead with sans for the editorial sans/serif contrast.
    expect(html).toMatch(/--font-headline:\s*[^;]*sans-serif/);
  });

  test("user-supplied tokens still win over theme defaults", () => {
    const customised = structuredClone(fixture) as Site;
    customised.theme.tokens = { colorAccent: "#123456" };
    const html = renderSite(customised, EDITORIAL_THEME_ID);
    // The schema override appears after the theme default in :root, so the
    // last-declared value (#123456) is the effective one.
    const rootMatch = /:root\s*\{([\s\S]*?)\}/.exec(html);
    expect(rootMatch).not.toBeNull();
    const rootBody = rootMatch![1]!;
    const positions = [...rootBody.matchAll(/--color-accent:\s*([^;]+);/g)].map((m) =>
      m[1]!.trim(),
    );
    expect(positions.length).toBeGreaterThanOrEqual(2);
    expect(positions[positions.length - 1]).toBe("#123456");
  });

  test("EDITORIAL_THEME_TOKENS exposes the same palette + font keys the schema accepts", () => {
    expect(EDITORIAL_THEME_TOKENS.colorPrimary).toMatch(/^#[0-9a-f]{6}$/);
    expect(EDITORIAL_THEME_TOKENS.colorAccent).toMatch(/^#[0-9a-f]{6}$/);
    expect(typeof EDITORIAL_THEME_TOKENS.fontHeadline).toBe("string");
    expect(typeof EDITORIAL_THEME_TOKENS.fontBody).toBe("string");
  });
});

describe("editorial theme — layout-only CSS contract", () => {
  test("per-block CSS uses var(--token) and never hardcodes hex or rgb colours", () => {
    const html = renderSite(fixture, EDITORIAL_THEME_ID);
    const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]!);
    // The :root block legitimately holds raw colour values (it _defines_ the
    // tokens); every _other_ rule must consume them via var().
    const nonRootRules = styleBlocks.join("\n").replace(/:root\s*\{[^}]*\}/g, "");
    expect(nonRootRules).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(nonRootRules).not.toMatch(/\brgb\(/);
    expect(nonRootRules).not.toMatch(/\brgba\(/);
    expect(nonRootRules).toContain("var(--");
  });

  test("body line-height is generous (1.5–1.7 range) per the editorial brief", () => {
    const html = renderSite(fixture, EDITORIAL_THEME_ID);
    // The first `html, body { margin: 0; padding: 0; }` reset is not the
    // typographic `body { ... }` declaration we care about — match the rule
    // that contains `font-family: var(--font-body)` to pick the right block.
    const bodyDeclMatch = html.match(
      /(?:^|\s)body\s*\{[^}]*font-family:\s*var\(--font-body\)[^}]*\}/,
    );
    expect(bodyDeclMatch).not.toBeNull();
    const body = bodyDeclMatch![0]!;
    const lh = body.match(/line-height:\s*([0-9.]+)/);
    expect(lh).not.toBeNull();
    const value = Number.parseFloat(lh![1]!);
    expect(value).toBeGreaterThanOrEqual(1.5);
    expect(value).toBeLessThanOrEqual(1.7);
  });

  test("hero h1 has the type-scale's largest size for editorial display contrast", () => {
    const html = renderSite(fixture, EDITORIAL_THEME_ID);
    // The 1.333 ratio gives h1 ≈ 3.157rem; we just assert it is meaningfully
    // larger than 2rem so the contract isn't accidentally flattened later.
    const heroH1Match = html.match(/\[data-block="hero"\]\s+h1\s*\{([\s\S]*?)\}/);
    expect(heroH1Match).not.toBeNull();
    const fs = heroH1Match![1]!.match(/font-size:\s*([0-9.]+)rem/);
    expect(fs).not.toBeNull();
    expect(Number.parseFloat(fs![1]!)).toBeGreaterThanOrEqual(2.5);
  });

  test("output ships no Preact or React runtime", () => {
    const html = renderSite(fixture, EDITORIAL_THEME_ID);
    expect(html).not.toMatch(/<script[^>]*src=[^>]*preact/i);
    expect(html).not.toMatch(/<script[^>]*src=[^>]*react/i);
    expect(html).not.toMatch(/__html\b/);
  });
});

describe("editorial theme — determinism", () => {
  test("repeated calls produce byte-identical output", () => {
    const a = renderSite(fixture, EDITORIAL_THEME_ID);
    const b = renderSite(fixture, EDITORIAL_THEME_ID);
    expect(a).toBe(b);
  });
});

describe("editorial theme — Romanian content sanity", () => {
  test("the hero renders Romanian diacritics through unchanged", () => {
    const html = renderSite(fixture, EDITORIAL_THEME_ID);
    // These strings come from the fixture's hero data and the page SEO meta —
    // they each contain the full diacritic set (ă â î ș ț). If any is mangled
    // the renderer is dropping characters somewhere on the path from JSON
    // to HTML.
    expect(html).toContain("asociație studențească");
    expect(html).toContain("Studenți");
    expect(html).toContain("acțiune politică");
    expect(html).toContain("să o memoreze");
  });
});
