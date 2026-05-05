// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import axe from "axe-core";
import type { Site } from "@sosb/schema";
import quoteOnly from "./fixtures/quote-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = quoteOnly as unknown as Site;

describe("renderSite axe-core accessibility — quote block", () => {
  test("quote fixture with stub theme has zero axe violations", async () => {
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
