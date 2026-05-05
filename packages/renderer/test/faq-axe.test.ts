// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import axe from "axe-core";
import type { Site } from "@sosb/schema";
import faqOnly from "./fixtures/faq-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = faqOnly as unknown as Site;

/**
 * Accessibility regression for the FAQ block.
 *
 * Per #18 AC, the accordion must be accessible: keyboard navigable,
 * screen-reader announces state, focus visible. Using native
 * `<details>`/`<summary>` gives all of those for free at the structural
 * layer; this test asserts axe-core is happy with the rendered tree in
 * both states (default firstOpen=true, all-closed default).
 *
 * As with the other axe-core tests in this package, colour-contrast checks
 * are disabled because jsdom does not compute styles. Visual contrast is
 * exercised per-theme (Academic = #47, etc.).
 */

async function runAxe(html: string): Promise<axe.AxeResults> {
  const langMatch = /<html[^>]*\blang="([^"]+)"/i.exec(html);
  const innerMatch = /<html[^>]*>([\s\S]*)<\/html>/i.exec(html);
  if (innerMatch === null) throw new Error("renderSite output missing <html> root");
  if (langMatch !== null && langMatch[1] !== undefined) {
    document.documentElement.setAttribute("lang", langMatch[1]);
  }
  document.documentElement.innerHTML = innerMatch[1] ?? "";
  return axe.run(document, {
    rules: { "color-contrast": { enabled: false } },
  });
}

describe("renderSite axe-core accessibility — faq block", () => {
  test("faq fixture (firstOpen=true) has zero axe violations", async () => {
    const html = renderSite(fixture, "stub");
    const results = await runAxe(html);
    expect(results.violations).toEqual([]);
  });

  test("faq fixture (all closed) has zero axe violations", async () => {
    const allClosed = JSON.parse(JSON.stringify(fixture)) as Site;
    (allClosed.pages[0]!.blocks[0]!.data as { firstOpen: boolean }).firstOpen = false;
    const html = renderSite(allClosed, "stub");
    const results = await runAxe(html);
    expect(results.violations).toEqual([]);
  });

  test("faq fixture without a title has zero axe violations", async () => {
    const noTitle = JSON.parse(JSON.stringify(fixture)) as Site;
    delete (noTitle.pages[0]!.blocks[0]!.data as { title?: string }).title;
    const html = renderSite(noTitle, "stub");
    const results = await runAxe(html);
    expect(results.violations).toEqual([]);
  });
});
