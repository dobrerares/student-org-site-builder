// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import axe from "axe-core";
import type { Site } from "@sosb/schema";
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import valueListOnly from "./fixtures/value-list-only.json" with { type: "json" };
import documentDownloads from "./fixtures/document-downloads.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const heroFixture = heroOnly as unknown as Site;
const valueListFixture = valueListOnly as unknown as Site;
const docsFixture = documentDownloads as unknown as Site;

async function axeRun(html: string): Promise<axe.AxeResults> {
  // The vitest jsdom environment provides a real document/window. Re-hydrate
  // the document with the renderer's output so axe-core walks the actual
  // rendered tree.
  const langMatch = /<html[^>]*\blang="([^"]+)"/i.exec(html);
  const innerMatch = /<html[^>]*>([\s\S]*)<\/html>/i.exec(html);
  if (innerMatch === null) throw new Error("renderSite output missing <html> root");
  if (langMatch !== null && langMatch[1] !== undefined) {
    document.documentElement.setAttribute("lang", langMatch[1]);
  }
  document.documentElement.innerHTML = innerMatch[1] ?? "";

  return axe.run(document, {
    // JSDOM does not compute styles, so colour-contrast checks would be
    // unreliable in this layer. Visual contrast lives with the academic
    // theme (issue #47); structural/semantic axe rules are exercised here.
    rules: {
      "color-contrast": { enabled: false },
    },
  });
}

describe("renderSite axe-core accessibility", () => {
  test("hero-only sample with stub theme has zero axe violations", async () => {
    const results = await axeRun(renderSite(heroFixture, "stub"));
    expect(results.violations).toEqual([]);
  });

  test("valueList sample with stub theme has zero axe violations", async () => {
    const results = await axeRun(renderSite(valueListFixture, "stub"));
    expect(results.violations).toEqual([]);
  });

  test("documentDownloads sample with stub theme has zero axe violations", async () => {
    const results = await axeRun(renderSite(docsFixture, "stub"));
    expect(results.violations).toEqual([]);
  });
});
