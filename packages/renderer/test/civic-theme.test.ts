import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import { renderSite, CIVIC_THEME_ID } from "../src/index.js";

const fixture = heroOnly as unknown as Site;

/**
 * Civic theme - token + CSS contract tests.
 *
 * The Civic theme carries the locked "Activist" identity: a crimson + ink
 * palette on pure white, a heavy Archivo display / Inter body type stack,
 * compact density and sharp corners. Identity is fundamentals-only (no
 * decorative signature moves). This test pins the contract (which tokens get
 * emitted, that civic consumes them via var(--...), and that the existing
 * stub-theme goldens still pass when civic isn't requested) without locking
 * specific pixel values - those live in the CSS file itself.
 *
 * The colour values are documented in `packages/renderer/src/themes/civic.ts`
 * with their measured ratios. Visual axe-core (jsdom-mode, no contrast)
 * lives in `civic-axe.test.ts`.
 */

const renderCivic = (site: Site = fixture): string => renderSite(site, CIVIC_THEME_ID);

describe("civic theme - id is wired up", () => {
  test("CIVIC_THEME_ID is the literal string 'civic'", () => {
    expect(CIVIC_THEME_ID).toBe("civic");
  });

  test("renderSite accepts 'civic' as a known theme id", () => {
    const html = renderCivic();
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("</html>");
  });
});

describe("civic theme - token palette", () => {
  test("emits an ink --color-primary in :root", () => {
    const html = renderCivic();
    expect(html).toMatch(/:root\s*\{[\s\S]*?--color-primary:\s*#[0-9a-fA-F]{6}/);
  });

  test("emits all five core colour tokens with Activist palette values", () => {
    const html = renderCivic();
    expect(html).toContain("--color-primary: #17181c");
    expect(html).toContain("--color-accent: #cb2b2b");
    expect(html).toContain("--color-bg: #ffffff");
    expect(html).toContain("--color-fg: #17181c");
    expect(html).toContain("--color-muted: #6b6b6b");
  });

  test("does not emit a separate --color-border token (4-swatch palette)", () => {
    const html = renderCivic();
    expect(html).not.toContain("--color-border:");
  });

  test("emits the Archivo headline and Inter body font stack", () => {
    const html = renderCivic();
    expect(html).toMatch(/--font-headline:[^;]*Archivo/);
    expect(html).toMatch(/--font-body:[^;]*Inter/);
    // Defensive: civic must not regress to a serif headline. CSS later-wins
    // means we have to inspect the *last* --font-headline declaration in
    // :root (the one that would actually resolve at runtime). The renderer's
    // universal baseline emits a placeholder Georgia value; civic overrides
    // it. Both appear in :root; only the last one matters for the cascade.
    const rootMatch = /:root\s*\{([\s\S]*?)\}/.exec(html);
    expect(rootMatch).not.toBeNull();
    const rootBody = rootMatch![1]!;
    const headlineDecls = [...rootBody.matchAll(/--font-headline:\s*([^;]*);/g)].map((m) => m[1]!);
    expect(headlineDecls.length).toBeGreaterThan(0);
    const resolvedHeadline = headlineDecls[headlineDecls.length - 1]!;
    expect(resolvedHeadline).not.toMatch(/Georgia/i);
    expect(resolvedHeadline).not.toMatch(/Times/i);
    expect(resolvedHeadline).not.toMatch(/Source Serif/i);
    expect(resolvedHeadline).toMatch(/sans-serif\s*$/);
  });

  test("ships compact density and a sharp radius base (engine knobs)", () => {
    const html = renderCivic();
    expect(html).toContain("--density-scale: 0.85");
    expect(html).toContain("--radius-base: 2px");
    // The legacy direct --radius-sm/md/lg overrides are gone — the engine
    // derives them from --radius-base now.
    const rootMatch = /:root\s*\{([\s\S]*?)\}/.exec(html);
    expect(rootMatch).not.toBeNull();
    const rootBody = rootMatch![1]!;
    expect(rootBody).not.toContain("--radius-sm: 2px");
    expect(rootBody).not.toContain("--radius-md: 3px");
    expect(rootBody).not.toContain("--radius-lg: 4px");
  });

  test("user-supplied theme tokens still override civic baseline (later-wins)", () => {
    const overridden = structuredClone(fixture) as Site;
    overridden.theme = {
      id: CIVIC_THEME_ID,
      tokens: { colorPrimary: "#123456" },
    };
    const html = renderSite(overridden, CIVIC_THEME_ID);
    const rootMatch = /:root\s*\{([\s\S]*?)\}/.exec(html);
    expect(rootMatch).not.toBeNull();
    const rootBody = rootMatch![1]!;
    const civicIdx = rootBody.indexOf("--color-primary: #17181c");
    const userIdx = rootBody.lastIndexOf("--color-primary: #123456");
    expect(civicIdx).toBeGreaterThanOrEqual(0);
    expect(userIdx).toBeGreaterThan(civicIdx);
  });
});

describe("civic theme - CSS hygiene (token discipline)", () => {
  test("per-block CSS references var(--...) and never hardcodes hex/rgb outside :root", () => {
    const html = renderCivic();
    const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]!);
    const nonRootRules = styleBlocks.join("\n").replace(/:root\s*\{[^}]*\}/g, "");
    expect(nonRootRules).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(nonRootRules).not.toMatch(/\brgba?\(\s*[#0-9.]/);
    expect(nonRootRules).toContain("var(--");
  });

  test("no Preact/React runtime is shipped with civic output", () => {
    const html = renderCivic();
    expect(html).not.toMatch(/<script[^>]*src=[^>]*preact/i);
    expect(html).not.toMatch(/<script[^>]*src=[^>]*react/i);
  });
});

describe("civic theme - determinism", () => {
  test("repeated renders produce byte-identical output", () => {
    const a = renderCivic();
    const b = renderCivic();
    const c = renderCivic();
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  test("structurally-cloned input produces byte-identical output", () => {
    const a = renderCivic();
    const b = renderSite(structuredClone(fixture) as Site, CIVIC_THEME_ID);
    expect(a).toBe(b);
  });
});

describe("civic theme - does not regress stub theme", () => {
  test("rendering with stub theme still produces stub-theme output", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain("--color-primary: #1f3a5f");
    expect(html).not.toContain("--color-primary: #17181c");
  });
});
