// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import axe from "axe-core";
import type { Site } from "@sosb/schema";
import customHtmlOn from "./fixtures/custom-html-on.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = customHtmlOn as unknown as Site;

/**
 * Axe-core regression on a sanitize-on customHTML render.
 *
 * The PRD's a11y commitment (zero axe violations as a CI gate) extends to the
 * customHTML escape hatch: when sanitize-on is in effect, the rendered output
 * must remain accessible. Sanitize-off is intentionally power-user-controlled
 * and is not gated here (the editor's persistent warning UI takes the place
 * of automated guard-rails for that mode).
 */
describe("customHTML axe-core accessibility (sanitize-on)", () => {
  test("page with a sanitize-on customHTML block has zero axe violations", async () => {
    const html = renderSite(fixture, "stub");

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
