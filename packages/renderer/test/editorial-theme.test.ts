import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import heroOnlyEditorial from "./fixtures/hero-only-editorial.json" with { type: "json" };
import { renderSite } from "../src/index.js";
import { EDITORIAL_THEME_BASELINE_TOKENS, EDITORIAL_THEME_ID } from "../src/themes/editorial.js";

const fixture = heroOnlyEditorial as unknown as Site;

/**
 * Editorial theme — "Editorial" identity recast.
 *
 * Magazine-inspired theme: Fraunces serif display + Inter body, terracotta on
 * a warm cream ground, comfortable density, soft 6px corners, fluid `--type-*`
 * display scale. Palette/fonts/density/radius ship via the tuple baseline-token
 * mechanism (so --color-bg/-fg/-muted and the density/radius engine knobs
 * actually render). This suite asserts the token contract and surface-level CSS
 * shape; per-block × per-theme goldens are deferred until the block matrix
 * lands.
 */

/** Look up a CSS-prop value in the editorial baseline tuple list. */
function baselineToken(prop: string): string | undefined {
  return EDITORIAL_THEME_BASELINE_TOKENS.find(([key]) => key === prop)?.[1];
}

describe("editorial theme — token emission", () => {
  test("exports the canonical theme id", () => {
    expect(EDITORIAL_THEME_ID).toBe("editorial");
  });

  test("emits the curated warm palette on :root when no user overrides are set", () => {
    const html = renderSite(fixture, EDITORIAL_THEME_ID);
    // Recast identity: terracotta accent + warm ink on a cream ground. The
    // tuple mechanism (unlike the legacy Record) lets the theme set bg/fg/muted
    // too, so the cream ground actually renders.
    expect(html).toMatch(/:root\s*\{[\s\S]*--color-primary:\s*#1a1714/);
    expect(html).toMatch(/:root\s*\{[\s\S]*--color-accent:\s*#c4622d/);
    expect(html).toMatch(/:root\s*\{[\s\S]*--color-bg:\s*#fbf8f3/);
    expect(html).toMatch(/:root\s*\{[\s\S]*--color-fg:\s*#1a1714/);
    expect(html).toMatch(/:root\s*\{[\s\S]*--color-muted:\s*#8a7e72/);
  });

  test("emits a serif headline font stack and a sans-serif body font stack", () => {
    const html = renderSite(fixture, EDITORIAL_THEME_ID);
    // Recast flips the legacy pairing: the magazine voice is now the Fraunces
    // serif display, with Inter for body.
    expect(html).toMatch(/--font-headline:\s*[^;]*Fraunces[^;]*serif/);
    expect(html).toMatch(/--font-body:\s*[^;]*Inter[^;]*sans-serif/);
  });

  test("comfortable density + soft radius ship via the engine knobs", () => {
    const html = renderSite(fixture, EDITORIAL_THEME_ID);
    expect(html).toMatch(/:root\s*\{[\s\S]*--density-scale:\s*1\.15/);
    expect(html).toMatch(/:root\s*\{[\s\S]*--radius-base:\s*6px/);
  });

  test("self-hosts Fraunces + Inter via @font-face (first family in each stack)", () => {
    const html = renderSite(fixture, EDITORIAL_THEME_ID);
    expect(html).toMatch(/@font-face\s*\{[^}]*font-family:\s*"Fraunces"/);
    expect(html).toMatch(/@font-face\s*\{[^}]*font-family:\s*"Inter"/);
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

  test("EDITORIAL_THEME_BASELINE_TOKENS ships the palette + fonts + engine knobs as raw [cssProp, value] tuples", () => {
    // Recast moved editorial onto the uniform tuple mechanism (matching
    // civic/academic/modern/minimal): raw [cssProp, value] pairs, not a
    // schema-keyed Record. This is what lets it set bg/fg/muted/density/radius.
    expect(baselineToken("--color-primary")).toMatch(/^#[0-9a-f]{6}$/);
    expect(baselineToken("--color-accent")).toMatch(/^#[0-9a-f]{6}$/);
    expect(baselineToken("--color-bg")).toMatch(/^#[0-9a-f]{6}$/);
    expect(baselineToken("--color-fg")).toMatch(/^#[0-9a-f]{6}$/);
    expect(baselineToken("--color-muted")).toMatch(/^#[0-9a-f]{6}$/);
    expect(typeof baselineToken("--font-headline")).toBe("string");
    expect(typeof baselineToken("--font-body")).toBe("string");
    expect(baselineToken("--density-scale")).toBe("1.15");
    expect(baselineToken("--radius-base")).toBe("6px");
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
    expect(nonRootRules).not.toMatch(/\brgba?\(\s*[#0-9.]/);
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

  test("display h1 uses the engine's largest fluid type token for editorial display contrast", () => {
    const html = renderSite(fixture, EDITORIAL_THEME_ID);
    // The recast drops the legacy hardcoded rem scale (h1 ≈ 3.157rem) in favour
    // of the engine's fluid `--type-3xl` clamp (max 3.75rem). Assert the bare
    // `h1 { font-size }` rule consumes `var(--type-3xl)` rather than a fixed
    // rem, so display type stays responsive and never overflows on mobile. The
    // editorial <h1> (incl. the hero's, which also gets var(--type-3xl) from the
    // shared hero overlay) inherits this contract.
    // Anchor on the rule boundary (start-of-line, `}`, `;`, or a `*/` comment
    // close) so we match the standalone `h1 { … }` rule and never the grouped
    // `h1, h2, …` selector or `.hero__title`.
    const h1Matches = [...html.matchAll(/(?:^|[};]|\*\/)\s*h1\s*\{([\s\S]*?)\}/g)];
    expect(h1Matches.length).toBeGreaterThan(0);
    const usesTypeToken = h1Matches.some((m) => /font-size:\s*var\(--type-3xl\)/.test(m[1]!));
    expect(usesTypeToken).toBe(true);
    // And the rule must NOT pin a fixed-rem font-size (the mobile-overflow risk
    // the fluid switch removes).
    const usesFixedRem = h1Matches.some((m) => /font-size:\s*[0-9.]+rem/.test(m[1]!));
    expect(usesFixedRem).toBe(false);
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
