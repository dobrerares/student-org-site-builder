// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import axe from "axe-core";
import type { Site } from "@sosb/schema";
import gridFixture from "./fixtures/image-gallery-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = gridFixture as unknown as Site;

/**
 * imageGallery axe-core regression — closed and open states.
 *
 * The AC pins "Lightbox passes axe-core (proper roles, focus management,
 * screen-reader announcements)". JSDOM cannot exercise computed-style or
 * real focus-visibility checks, so colour-contrast is disabled (the
 * Academic theme #47 covers visual contrast). Structural / semantic
 * rules — labels, dialog role, alt text presence, button-name — are all
 * exercised here.
 */

function loadPage(html: string): void {
  const langMatch = /<html[^>]*\blang="([^"]+)"/i.exec(html);
  const innerMatch = /<html[^>]*>([\s\S]*)<\/html>/i.exec(html);
  if (innerMatch === null) throw new Error("renderSite output missing <html> root");
  if (langMatch !== null && langMatch[1] !== undefined) {
    document.documentElement.setAttribute("lang", langMatch[1]);
  }
  document.documentElement.innerHTML = innerMatch[1] ?? "";
  // Run inline scripts so the lightbox can be tested in its open state.
  for (const s of document.querySelectorAll("script")) {
    if (s.src) continue;
    new Function(s.textContent ?? "")();
  }
  document.dispatchEvent(new Event("DOMContentLoaded"));
}

describe("imageGallery axe-core — closed (default) state", () => {
  test("a grid gallery with the lightbox closed has zero violations", async () => {
    const html = renderSite(fixture, "stub");
    loadPage(html);

    const results = await axe.run(document, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});

describe("imageGallery axe-core — open lightbox state", () => {
  test("the open lightbox dialog has zero axe violations", async () => {
    const html = renderSite(fixture, "stub");
    loadPage(html);

    // Open the lightbox before scanning.
    const trigger = document.querySelector<HTMLButtonElement>(
      "[data-sosb-lightbox-open]",
    );
    if (trigger === null) throw new Error("expected a lightbox trigger");
    trigger.click();

    const dialog = document.querySelector<HTMLElement>("[data-sosb-lightbox]")!;
    expect(dialog.hasAttribute("hidden")).toBe(false);

    const results = await axe.run(document, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
