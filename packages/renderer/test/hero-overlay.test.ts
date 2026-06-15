import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";
import { PRODUCTION_SITE_BASE_CSS } from "../src/themes/production-base.js";

describe("universal hero treatment (production base)", () => {
  test("base hero title uses the fluid --type-3xl token and primary color", () => {
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(
      /\.hero__title\s*\{[^}]*font-size:\s*var\(--type-3xl\)/,
    );
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(
      /\.hero__title\s*\{[^}]*color:\s*var\(--color-primary\)/,
    );
  });

  test("has-image hero makes media a full-bleed absolute layer", () => {
    expect(PRODUCTION_SITE_BASE_CSS).toContain(".hero--has-image");
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(
      /\.hero--has-image\s+\.hero__media\s*\{[^}]*position:\s*absolute/,
    );
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(
      /\.hero--has-image\s+\.hero__media\s+img\s*\{[^}]*object-fit:\s*cover/,
    );
  });

  test("has-image hero applies a token-based dark scrim and token lockup text", () => {
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(/rgba\(var\(--color-fg-rgb\)/);
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(
      /\.hero--has-image[^{]*\.hero__title[^{]*\{[^}]*color:\s*var\(--color-on-image\)/,
    );
  });
});

const fixture = heroOnly as unknown as Site;

describe("no theme overrides the shared hero (per-theme hero CSS stripped)", () => {
  const PRODUCTION_THEME_IDS = ["minimal", "modern", "editorial", "civic", "academic"];
  for (const id of PRODUCTION_THEME_IDS) {
    test(`${id}: emits no theme-level [data-block="hero"] rule`, () => {
      const site = structuredClone(fixture) as Site;
      site.theme = { id, tokens: {} };
      const html = renderSite(site, id);
      const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
        .map((m) => m[1]!)
        .join("\n");
      expect(styles).not.toContain(".hero__eyebrow");
      const heroTitleSizes = [
        ...styles.matchAll(/\[data-block="hero"\][^{]*h1[^{]*\{[^}]*font-size[^}]*\}/g),
      ];
      expect(heroTitleSizes.length).toBe(0);
    });
  }
});
