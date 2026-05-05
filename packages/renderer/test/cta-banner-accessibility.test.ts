// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import axe from "axe-core";
import type { Site } from "@sosb/schema";
import ctaFixture from "./fixtures/cta-banner-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = ctaFixture as unknown as Site;

describe("renderSite — ctaBanner axe-core accessibility", () => {
  test("ctaBanner sample with stub theme has zero axe violations", async () => {
    const html = renderSite(fixture, "stub");

    const langMatch = /<html[^>]*\blang="([^"]+)"/i.exec(html);
    const innerMatch = /<html[^>]*>([\s\S]*)<\/html>/i.exec(html);
    if (innerMatch === null) throw new Error("renderSite output missing <html> root");
    if (langMatch !== null && langMatch[1] !== undefined) {
      document.documentElement.setAttribute("lang", langMatch[1]);
    }
    document.documentElement.innerHTML = innerMatch[1] ?? "";

    const results = await axe.run(document, {
      // JSDOM does not compute styles, so colour-contrast checks are
      // unreliable. Visual contrast is the theme's responsibility.
      rules: {
        "color-contrast": { enabled: false },
      },
    });

    expect(results.violations).toEqual([]);
  });
});
