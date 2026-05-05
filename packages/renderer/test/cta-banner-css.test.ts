import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import ctaFixture from "./fixtures/cta-banner-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = ctaFixture as unknown as Site;

/**
 * The stub-theme CSS is the renderer's "Academic stub" baseline that other
 * themes (#28-#31, #47) override. It must:
 *   - target ctaBanner with token-based styles (no hex/rgb outside :root),
 *   - render distinct primary vs secondary button styles via tokens,
 *   - stack content on narrow viewports (responsive AC).
 */
describe("renderSite — ctaBanner stub-theme CSS contract", () => {
  test("emits a [data-block='ctaBanner'] selector", () => {
    const html = renderSite(fixture, "stub");
    const styles = extractStyles(html);
    expect(styles).toMatch(/\[data-block="ctaBanner"\]/);
  });

  test("emits distinct rules for the primary vs secondary button styles", () => {
    const html = renderSite(fixture, "stub");
    const styles = extractStyles(html);
    expect(styles).toMatch(/\.ctaBanner__button--primary\b/);
    expect(styles).toMatch(/\.ctaBanner__button--secondary\b/);
  });

  test("primary and secondary button rules differ in at least one declaration", () => {
    const html = renderSite(fixture, "stub");
    const styles = extractStyles(html);
    const primary = extractRule(styles, ".ctaBanner__button--primary");
    const secondary = extractRule(styles, ".ctaBanner__button--secondary");
    expect(primary).toBeTruthy();
    expect(secondary).toBeTruthy();
    expect(primary).not.toEqual(secondary);
  });

  test("ctaBanner rules use only var(--token), no hex/rgb leakage", () => {
    const html = renderSite(fixture, "stub");
    const styles = extractStyles(html);
    // Strip the :root rule that legitimately carries hex tokens.
    const nonRoot = styles.replace(/:root\s*\{[^}]*\}/g, "");
    // Find every block of ctaBanner rules.
    const ctaRules = nonRoot.match(/\[data-block="ctaBanner"\][^{]*\{[^}]*\}/g) ?? [];
    expect(ctaRules.length).toBeGreaterThan(0);
    for (const rule of ctaRules) {
      expect(rule).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(rule).not.toMatch(/\brgb\(/);
      expect(rule).not.toMatch(/\brgba\(/);
    }
  });

  test("includes a mobile breakpoint that stacks the cta content (responsive AC)", () => {
    const html = renderSite(fixture, "stub");
    const styles = extractStyles(html);
    // The stub CSS ships a single `@media (max-width: ...)` rule that flips
    // the cta layout to a stacked column. Loose match — the exact threshold
    // doesn't matter, just that one exists for ctaBanner.
    expect(styles).toMatch(/@media\s*\([^)]*max-width[^)]*\)/);
  });
});

function extractStyles(html: string): string {
  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
  return styleBlocks.map((m) => m[1]!).join("\n");
}

function extractRule(styles: string, selector: string): string | null {
  // Escape the selector for use in a regex.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return matches ? matches[1]!.trim() : null;
}
