import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import civicHero from "./fixtures/civic-hero.json" with { type: "json" };
import { renderSite, CIVIC_THEME_ID } from "../src/index.js";

const fixture = civicHero as unknown as Site;

/**
 * Civic theme - hero golden file.
 *
 * Same framework as the stub-theme golden (`golden-file.test.ts`):
 * vitest's `toMatchFileSnapshot` writes the snapshot on first run and
 * diffs against it thereafter. CI fails on drift. Per-block goldens for
 * the remaining 14 blocks land with their respective issues; the hero
 * snapshot here is the AC for #30.
 *
 * The fixture is HISTORIPOL-shaped with Romanian diacritics across the
 * eyebrow, title, subtitle, and image alt text - exercising the civic
 * theme's "Romanian diacritics across all weights" AC at golden-file
 * level. The renderer is locale-agnostic (no Date.now / no toLocaleString)
 * so the diacritics flow through verbatim and pin in the snapshot.
 */

describe("golden-file framework - civic theme + hero", () => {
  test("hero-only civic-theme render matches its golden file", async () => {
    const html = renderSite(fixture, CIVIC_THEME_ID);
    await expect(html).toMatchFileSnapshot("__golden__/civic-theme-hero.html");
  });

  test("Romanian diacritics flow through verbatim into civic output", () => {
    const html = renderSite(fixture, CIVIC_THEME_ID);
    // Spot the four common Romanian diacritic letter classes.
    expect(html).toContain("Învățăm");
    expect(html).toContain("Construim politică");
    expect(html).toContain("comunitate civică");
    expect(html).toContain("Constanța");
    // U+0218/U+0219 (S with comma below) is the Romanian-correct form.
    // No mojibake / HTML entities should be introduced.
    expect(html).not.toMatch(/&[a-z]+;/);
  });
});
