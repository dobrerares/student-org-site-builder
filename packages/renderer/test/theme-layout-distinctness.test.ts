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

  test("production value grids center incomplete rows without changing the stub contract", () => {
    expect(styleText(renderSite(fixture, "stub"))).not.toContain("--value-list-item-width");

    const productionCss = styleText(renderSite(fixture, "academic"));
    expect(productionCss).toMatch(
      /\[data-block="valueList"\]\[data-layout="grid"\] \.value-list__items \{[\s\S]*display:\s*flex;[\s\S]*flex-wrap:\s*wrap;[\s\S]*justify-content:\s*center;/,
    );
    expect(productionCss).toMatch(
      /\[data-block="valueList"\]\[data-layout="grid"\] \.value-list__item \{[\s\S]*flex:\s*0 1 var\(--value-list-item-width, 100%\);/,
    );
    expect(productionCss).toMatch(
      /@media \(max-width: 640px\) \{[\s\S]*\[data-block="valueList"\]\[data-layout="grid"\] \.value-list__item \{[\s\S]*flex:\s*0 1 100%;/,
    );
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
    ["academic", /border-block-start:\s*1px solid var\(--color-accent\)/],
    // Civic's "Activist" identity is fundamentals-only: its distinct treatment
    // is the compact density token (--density-scale: 0.85) the engine scales
    // --space-* from — civic is the only theme that ships compact density.
    ["civic", /--density-scale:\s*0\.85/],
    ["editorial", /\[data-block="quote"\]\s*\{[\s\S]*width:\s*min\(100%, 56rem\)/],
  ])("%s contributes a distinct layout treatment", (themeId, expectedMarker) => {
    expect(styleText(renderSite(fixture, themeId))).toMatch(expectedMarker);
  });
});
