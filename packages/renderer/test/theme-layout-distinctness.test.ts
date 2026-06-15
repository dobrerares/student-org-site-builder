import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";

import valueListOnly from "./fixtures/value-list-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = valueListOnly as unknown as Site;

function styleText(html: string): string {
  return [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((match) => match[1] ?? "")
    .join("\n");
}

describe("production themes — generated-site layout polish", () => {
  test("production themes get the shared site layout layer, while stub stays a fixture theme", () => {
    expect(styleText(renderSite(fixture, "stub"))).not.toContain("--site-max-width");
    expect(styleText(renderSite(fixture, "modern"))).toContain("--site-max-width");
  });

  test("production card grids center an incomplete final row via flex-wrap (no stranded orphan)", () => {
    // The legacy flex `--value-list-item-width` system is gone everywhere.
    expect(styleText(renderSite(fixture, "stub"))).not.toContain("--value-list-item-width");
    expect(styleText(renderSite(fixture, "academic"))).not.toContain("--value-list-item-width");

    // Production themes lay multi-item blocks out as a centered flex-wrap: full
    // rows fill edge-to-edge, an incomplete final row CENTERS (no orphan left at
    // the edge). The item flex-basis derives from the author column count
    // (--grid-cols) via a max()/calc formula, so columns also reduce on narrow
    // viewports without any media-query column maths. These markers are
    // production-only — the stub baseline (its own CSS-grid) ships none of them.
    const productionCss = styleText(renderSite(fixture, "academic"));
    expect(productionCss).toMatch(/flex-wrap:\s*wrap;\s*justify-content:\s*center;/);
    expect(productionCss).toMatch(/flex:\s*0 1\s*max\(/);
    expect(productionCss).toContain("--grid-cols");

    const stubCss = styleText(renderSite(fixture, "stub"));
    expect(stubCss).not.toMatch(/flex-wrap:\s*wrap;\s*justify-content:\s*center;/);
    expect(stubCss).not.toContain("--grid-cols");
  });

  test("academic narrows its content sections to a tight readable rail", () => {
    const academicCss = styleText(renderSite(fixture, "academic"));
    // Academic's scholarly identity keeps content sections on a narrow 64rem
    // readable rail. The hero no longer sets a per-theme rail — it uses the
    // shared universal hero overlay (production-base.ts), so the former
    // hero-specific rail assertion was removed.
    expect(academicCss).toContain("--site-readable-width: 64rem");
    expect(academicCss).toMatch(
      /\[data-block="valueList"\] \.value-list__inner,[\s\S]*\[data-block="teamGrid"\] \.team-grid__inner,[\s\S]*max-width:\s*var\(--site-readable-width\);/,
    );
  });

  test.each([
    // Modern's "Tech" identity is fundamentals-only: its distinct treatment is
    // the round shape token (--radius-base: 12px) that the engine derives the
    // card/badge/button radii from — no decorative tint/bar signature.
    ["modern", /--radius-base:\s*12px/],
    ["minimal", /\[data-block="valueList"\][\s\S]*max-width: 56rem/],
    // Academic's "Scholarly" identity is fundamentals-only: its distinct
    // treatment is the soft shape token (--radius-base: 4px) the engine derives
    // the card/badge radii from — academic is the only theme that ships 4px (the
    // legacy rule-line costume is gone). The earlier accent rule-line marker was
    // replaced when the manuscript costume was stripped.
    ["academic", /--radius-base:\s*4px/],
    // Civic's "Activist" identity is fundamentals-only: its distinct treatment
    // is the compact density token (--density-scale: 0.85) the engine scales
    // --space-* from — civic is the only theme that ships compact density.
    ["civic", /--density-scale:\s*0\.85/],
    ["editorial", /\[data-block="quote"\]\s*\{[\s\S]*width:\s*min\(100%, 56rem\)/],
  ])("%s contributes a distinct layout treatment", (themeId, expectedMarker) => {
    expect(styleText(renderSite(fixture, themeId))).toMatch(expectedMarker);
  });
});
