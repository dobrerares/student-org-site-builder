import { describe, expect, test } from "vitest";
import { PRODUCTION_SITE_BASE_CSS } from "../src/themes/production-base.js";

describe("universal hero treatment (production base)", () => {
  test("base hero title uses the fluid --type-3xl token and primary color", () => {
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(/\.hero__title\s*\{[^}]*font-size:\s*var\(--type-3xl\)/);
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(/\.hero__title\s*\{[^}]*color:\s*var\(--color-primary\)/);
  });

  test("has-image hero makes media a full-bleed absolute layer", () => {
    expect(PRODUCTION_SITE_BASE_CSS).toContain(".hero--has-image");
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(/\.hero--has-image\s+\.hero__media\s*\{[^}]*position:\s*absolute/);
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(/\.hero--has-image\s+\.hero__media\s+img\s*\{[^}]*object-fit:\s*cover/);
  });

  test("has-image hero applies a token-based dark scrim and token lockup text", () => {
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(/rgba\(var\(--color-fg-rgb\)/);
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(/\.hero--has-image[^{]*\.hero__title[^{]*\{[^}]*color:\s*var\(--color-on-image\)/);
  });
});
