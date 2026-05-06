// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import axe from "axe-core";
import type { Site } from "@sosb/schema";
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import { renderSite, CIVIC_THEME_ID } from "../src/index.js";

const fixture = heroOnly as unknown as Site;

/**
 * Axe-core regression on the Civic theme.
 *
 * Same shape as the stub-theme axe test (see `accessibility.test.ts`).
 * Colour-contrast is disabled because JSDOM does not compute styles;
 * the civic palette's measured ratios are documented in
 * `packages/renderer/src/themes/civic.ts` and pinned by the token-value
 * tests in `civic-theme.test.ts`.
 */

describe("civic theme - axe-core accessibility", () => {
  test("hero-only sample with civic theme has zero axe violations", async () => {
    const html = renderSite(fixture, CIVIC_THEME_ID);

    const langMatch = /<html[^>]*\blang="([^"]+)"/i.exec(html);
    const innerMatch = /<html[^>]*>([\s\S]*)<\/html>/i.exec(html);
    if (innerMatch === null) throw new Error("renderSite output missing <html> root");
    if (langMatch !== null && langMatch[1] !== undefined) {
      document.documentElement.setAttribute("lang", langMatch[1]);
    }
    document.documentElement.innerHTML = innerMatch[1] ?? "";

    const results = await axe.run(document, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });

    expect(results.violations).toEqual([]);
  });
});
