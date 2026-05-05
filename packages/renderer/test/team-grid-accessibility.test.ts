// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import axe from "axe-core";
import type { Site } from "@sosb/schema";
import historipol from "./fixtures/team-grid-historipol.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = historipol as unknown as Site;

/**
 * teamGrid axe-clean contract: the HISTORIPOL fixture (9 people across
 * 4 departments, mix of photo-bearing and avatar-fallback people, mix of
 * social-link platforms) must produce zero structural / semantic axe
 * violations. Visual contrast is exercised against curated themes
 * (#28-#31, #47), not the stub theme used here.
 */
describe("renderSite axe-core accessibility - teamGrid", () => {
  test("HISTORIPOL teamGrid sample with stub theme has zero axe violations", async () => {
    const html = renderSite(fixture, "stub");

    const langMatch = /<html[^>]*\blang="([^"]+)"/i.exec(html);
    const innerMatch = /<html[^>]*>([\s\S]*)<\/html>/i.exec(html);
    if (innerMatch === null) throw new Error("renderSite output missing <html> root");
    if (langMatch !== null && langMatch[1] !== undefined) {
      document.documentElement.setAttribute("lang", langMatch[1]);
    }
    document.documentElement.innerHTML = innerMatch[1] ?? "";

    const results = await axe.run(document, {
      // JSDOM does not compute styles, so colour-contrast checks would be
      // unreliable in this layer. Visual contrast lives with the academic
      // theme (issue #47); structural/semantic axe rules are exercised here.
      rules: {
        "color-contrast": { enabled: false },
      },
    });

    expect(results.violations).toEqual([]);
  });
});
