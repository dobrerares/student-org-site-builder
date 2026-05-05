// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import axe from "axe-core";
import type { Site } from "@sosb/schema";
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = heroOnly as unknown as Site;

describe("academic theme — axe-core accessibility", () => {
  test("hero-only sample with academic theme has zero axe violations", async () => {
    const html = renderSite(fixture, "academic");

    // Re-hydrate the JSDOM document with the renderer's output so that the
    // <title>, lang, and <main> landmark all surface to axe-core. The rebuild
    // pattern mirrors the stub-theme accessibility test.
    const langPart = html.match(/<html[^>]*\blang="([^"]+)"/i);
    const innerPart = html.match(/<html[^>]*>([\s\S]*)<\/html>/i);
    if (innerPart === null) throw new Error("renderSite output missing <html> root");
    if (langPart !== null && langPart[1] !== undefined) {
      document.documentElement.setAttribute("lang", langPart[1]);
    }
    const inside: string = innerPart[1] ?? "";
    // Renderer output is the renderer's own constants + schema-validated
    // user data — see the stub-theme accessibility test for the same pattern.
    Reflect.set(document.documentElement, "innerHTML", inside);

    const results = await axe.run(document, {
      // JSDOM does not compute styles, so colour-contrast checks would be
      // unreliable here. Visual contrast for the academic theme is part of
      // the maintainer's curation pass per #47.
      rules: { "color-contrast": { enabled: false } },
    });

    expect(results.violations).toEqual([]);
  });
});
