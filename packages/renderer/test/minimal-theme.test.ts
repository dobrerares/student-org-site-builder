// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import axe from "axe-core";
import type { Site } from "@sosb/schema";
import heroOnlyMinimal from "./fixtures/hero-only-minimal.json" with { type: "json" };
import { renderSite } from "../src/index.js";
import {
  MINIMAL_THEME_BASELINE_TOKENS,
  MINIMAL_THEME_CSS,
  MINIMAL_THEME_ID,
  MINIMAL_THEME_TOKENS,
} from "../src/themes/minimal.js";

/** Resolve a baseline-token value by CSS custom-property name, or undefined. */
function baselineToken(prop: string): string | undefined {
  return MINIMAL_THEME_BASELINE_TOKENS.find(([name]) => name === prop)?.[1];
}

const fixture = heroOnlyMinimal as unknown as Site;

/**
 * Minimal theme — tests for issue #31.
 *
 * The Minimal theme is the most restraint-bound theme in v1: monochrome base,
 * a single accent used sparingly, one type family throughout, sharp corners,
 * minimal spacing. These tests assert the *guidelines* are honoured — the
 * theme's identity is "less is more", and ornamentation is a regression.
 */

describe("minimal theme — identity", () => {
  test("exposes a stable theme id", () => {
    expect(MINIMAL_THEME_ID).toBe("minimal");
  });

  test("contributes a theme-token defaults object", () => {
    expect(MINIMAL_THEME_TOKENS).toBeDefined();
    expect(typeof MINIMAL_THEME_TOKENS).toBe("object");
  });
});

describe("minimal theme — palette guidelines", () => {
  test("uses a monochrome base: white background, near-black foreground", () => {
    expect(MINIMAL_THEME_TOKENS.colorBg).toBe("#ffffff");
    // Calm's ink is near-black (#1a1a1a) — a valid 6-digit hex whose channels
    // are all dark (top nibble 0 or 1), i.e. no bright/coloured foreground.
    expect(MINIMAL_THEME_TOKENS.colorFg).toMatch(/^#[01][0-9a-f][01][0-9a-f][01][0-9a-f]$/i);
  });

  test("uses a single mid-grey for borders/muted text", () => {
    expect(MINIMAL_THEME_TOKENS.colorMuted).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test("primary equals foreground (hierarchy via weight + size, not colour)", () => {
    // The Minimal brief: "Hierarchy via weight + size only, not color."
    // So the primary text-colour token must equal the foreground token —
    // headings get their emphasis from typography, not from a separate
    // primary colour.
    expect(MINIMAL_THEME_TOKENS.colorPrimary).toBe(MINIMAL_THEME_TOKENS.colorFg);
  });

  test("declares exactly one accent colour", () => {
    expect(MINIMAL_THEME_TOKENS.colorAccent).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("minimal theme — typography", () => {
  test("uses a single sans-serif type family for both headline and body", () => {
    expect(MINIMAL_THEME_TOKENS.fontHeadline).toBe(MINIMAL_THEME_TOKENS.fontBody);
  });

  test("body font is a sans-serif stack", () => {
    expect(MINIMAL_THEME_TOKENS.fontBody?.toLowerCase()).toContain("sans-serif");
  });
});

describe("minimal theme — Calm fundamentals on tokens", () => {
  test("ships sharp corners via the engine knob (--radius-base: 0px)", () => {
    // Calm = no shape. The theme sets a single radius base; the engine derives
    // --radius-sm/md/lg: 0 from it, so the theme ships no direct radius
    // overrides and stays coupled to the engine.
    expect(baselineToken("--radius-base")).toBe("0px");
    expect(MINIMAL_THEME_CSS).not.toMatch(/--radius-(sm|md|lg):/);
  });

  test("ships airy density via the engine knob (--density-scale: 1.25)", () => {
    // Calm = the airiest of the set. Spacing flows from the engine's
    // density-scaled --space-* scale, so the theme ships no hardcoded scale.
    expect(baselineToken("--density-scale")).toBe("1.25");
    expect(MINIMAL_THEME_CSS).not.toMatch(/--space-(xs|sm|md|lg|xl):/);
  });

  test("contains no box-shadows (no decoration)", () => {
    expect(MINIMAL_THEME_CSS).not.toMatch(/box-shadow/i);
  });

  test("contains no gradients (no decoration)", () => {
    expect(MINIMAL_THEME_CSS).not.toMatch(/linear-gradient|radial-gradient|conic-gradient/i);
  });

  test("contains no decorative borders that aren't via tokens", () => {
    // Borders, if used, must reference a token. Scrub the :root rule first
    // (it legitimately defines colours).
    const nonRoot = MINIMAL_THEME_CSS.replace(/:root\s*\{[^}]*\}/g, "");
    expect(nonRoot).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(nonRoot).not.toMatch(/\brgb\(/);
    expect(nonRoot).not.toMatch(/\brgba\(/);
  });
});

describe("minimal theme — wired into renderSite", () => {
  test("renderSite resolves the 'minimal' themeId without falling back to stub", () => {
    const html = renderSite(fixture, "minimal");
    // The minimal theme must be selectable. Calm's sharp-corner shape token
    // (--radius-base: 0px) is the cheapest unique marker that the stub theme
    // does not emit (stub keeps the engine baseline of 8px).
    expect(html).toMatch(/--radius-base:\s*0px/);
  });

  test("output references no raw hex/rgb outside :root (token discipline)", () => {
    const html = renderSite(fixture, "minimal");
    const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(
      (m) => m[1] ?? "",
    );
    const nonRootRules = styleBlocks.join("\n").replace(/:root\s*\{[^}]*\}/g, "");
    expect(nonRootRules).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(nonRootRules).not.toMatch(/\brgba?\(\s*[#0-9.]/);
    expect(nonRootRules).toContain("var(--");
  });

  test("output is deterministic across repeated calls", () => {
    const a = renderSite(fixture, "minimal");
    const b = renderSite(fixture, "minimal");
    expect(a).toBe(b);
  });

  test("Romanian diacritics survive the round-trip unchanged", () => {
    const html = renderSite(fixture, "minimal");
    expect(html).toContain("Studenți la o conferință");
    expect(html).toMatch(/<html[^>]*lang="ro"/);
  });
});

describe("minimal theme — accessibility", () => {
  test("hero-only sample with minimal theme has zero axe-core violations", async () => {
    const html = renderSite(fixture, "minimal");

    const langMatch = /<html[^>]*\blang="([^"]+)"/i.exec(html);
    const innerMatch = /<html[^>]*>([\s\S]*)<\/html>/i.exec(html);
    if (innerMatch === null) throw new Error("renderSite output missing <html> root");
    if (langMatch !== null && langMatch[1] !== undefined) {
      document.documentElement.setAttribute("lang", langMatch[1]);
    }
    document.documentElement.innerHTML = innerMatch[1] ?? "";

    const results = await axe.run(document, {
      // JSDOM does not compute styles; colour-contrast is verified at the
      // visual layer (Lighthouse on the built fixture site, per AC).
      rules: {
        "color-contrast": { enabled: false },
      },
    });

    expect(results.violations).toEqual([]);
  });
});
