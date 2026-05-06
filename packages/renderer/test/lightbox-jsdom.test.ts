// @vitest-environment jsdom
import { describe, expect, test, beforeEach } from "vitest";
import type { Site } from "@sosb/schema";
import gridFixture from "./fixtures/image-gallery-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = gridFixture as unknown as Site;

/**
 * Lightbox vanilla-JS behaviour, exercised under the JSDOM environment.
 *
 * The lightbox JS is shipped inline by the renderer; this test loads the
 * page into JSDOM, runs the inline script, and asserts:
 *
 *  - clicking a trigger opens the lightbox dialog with the correct image,
 *  - the dialog traps focus,
 *  - Esc closes the dialog and returns focus to the trigger,
 *  - ArrowRight / ArrowLeft cycle through images,
 *  - the dialog uses ARIA attributes that screen readers honour
 *    (`role=dialog`, `aria-modal=true`, `aria-label` / `aria-labelledby`).
 *
 * The Playwright e2e (`e2e/lightbox.spec.ts`) reproduces the same flow in
 * real Chromium for the AC's "axe-core clean in open state" guarantee
 * that JSDOM cannot honour (no real layout, no real key event timing).
 */

function loadPage(html: string): void {
  const langMatch = /<html[^>]*\blang="([^"]+)"/i.exec(html);
  const innerMatch = /<html[^>]*>([\s\S]*)<\/html>/i.exec(html);
  if (innerMatch === null) throw new Error("renderSite output missing <html> root");
  if (langMatch !== null && langMatch[1] !== undefined) {
    document.documentElement.setAttribute("lang", langMatch[1]);
  }
  document.documentElement.innerHTML = innerMatch[1] ?? "";

  // JSDOM does not run scripts injected via innerHTML; we walk the inserted
  // scripts and evaluate their text content in the same global scope so the
  // lightbox bootstrap runs.
  const scripts = document.querySelectorAll("script");
  for (const script of scripts) {
    if (script.src) continue;
    const code = script.textContent ?? "";
    // The script is renderer-owned (./src/lightbox-script.ts) and never
    // embeds user data, so evaluating it in tests is safe.
    new Function(code)();
  }
  // The renderer's script attaches its DOMContentLoaded listener at load
  // time; mimic the browser firing the event.
  document.dispatchEvent(new Event("DOMContentLoaded"));
}

describe("lightbox jsdom — open/close behaviour", () => {
  beforeEach(() => {
    document.documentElement.innerHTML = "<head></head><body></body>";
  });

  test("clicking a trigger opens the dialog and shows the right image", () => {
    const html = renderSite(fixture, "stub");
    loadPage(html);

    const dialog = document.querySelector<HTMLElement>("[data-sosb-lightbox]");
    expect(dialog).not.toBeNull();
    // Closed by default.
    expect(dialog!.hasAttribute("hidden")).toBe(true);

    const triggers = document.querySelectorAll<HTMLButtonElement>("[data-sosb-lightbox-open]");
    expect(triggers.length).toBeGreaterThanOrEqual(2);

    triggers[0]!.click();
    expect(dialog!.hasAttribute("hidden")).toBe(false);

    const dialogImg = dialog!.querySelector<HTMLImageElement>("img");
    expect(dialogImg).not.toBeNull();
    expect(dialogImg!.getAttribute("src")).toBe("assets/8e3a7f9b1c0d2e4f.jpg");
    expect(dialogImg!.getAttribute("alt")).toBe("Studenți la o conferință de toamnă");
  });

  test("Escape key closes the dialog and returns focus to the trigger", () => {
    const html = renderSite(fixture, "stub");
    loadPage(html);

    const dialog = document.querySelector<HTMLElement>("[data-sosb-lightbox]")!;
    const triggers = document.querySelectorAll<HTMLButtonElement>("[data-sosb-lightbox-open]");
    const firstTrigger = triggers[0]!;
    firstTrigger.focus();
    firstTrigger.click();

    expect(dialog.hasAttribute("hidden")).toBe(false);

    const escEvent = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    document.dispatchEvent(escEvent);

    expect(dialog.hasAttribute("hidden")).toBe(true);
    expect(document.activeElement).toBe(firstTrigger);
  });

  test("the close button closes the dialog", () => {
    const html = renderSite(fixture, "stub");
    loadPage(html);

    const dialog = document.querySelector<HTMLElement>("[data-sosb-lightbox]")!;
    document.querySelectorAll<HTMLButtonElement>("[data-sosb-lightbox-open]")[0]!.click();
    expect(dialog.hasAttribute("hidden")).toBe(false);

    const closeBtn = dialog.querySelector<HTMLButtonElement>("[data-sosb-lightbox-close]");
    expect(closeBtn).not.toBeNull();
    closeBtn!.click();
    expect(dialog.hasAttribute("hidden")).toBe(true);
  });
});

describe("lightbox jsdom — keyboard navigation", () => {
  beforeEach(() => {
    document.documentElement.innerHTML = "<head></head><body></body>";
  });

  test("ArrowRight moves to the next image and wraps", () => {
    const html = renderSite(fixture, "stub");
    loadPage(html);

    const dialog = document.querySelector<HTMLElement>("[data-sosb-lightbox]")!;
    const triggers = document.querySelectorAll<HTMLButtonElement>("[data-sosb-lightbox-open]");
    triggers[0]!.click();

    let img = dialog.querySelector<HTMLImageElement>("img")!;
    expect(img.getAttribute("alt")).toBe("Studenți la o conferință de toamnă");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    img = dialog.querySelector<HTMLImageElement>("img")!;
    expect(img.getAttribute("alt")).toBe("Diacritic test: ăîâșț");

    // Wraps to first.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    img = dialog.querySelector<HTMLImageElement>("img")!;
    expect(img.getAttribute("alt")).toBe("Studenți la o conferință de toamnă");
  });

  test("ArrowLeft moves to the previous image and wraps", () => {
    const html = renderSite(fixture, "stub");
    loadPage(html);

    const dialog = document.querySelector<HTMLElement>("[data-sosb-lightbox]")!;
    document.querySelectorAll<HTMLButtonElement>("[data-sosb-lightbox-open]")[0]!.click();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    const img = dialog.querySelector<HTMLImageElement>("img")!;
    // Wrapped to last image.
    expect(img.getAttribute("alt")).toBe("Diacritic test: ăîâșț");
  });
});

describe("lightbox jsdom — focus trap", () => {
  beforeEach(() => {
    document.documentElement.innerHTML = "<head></head><body></body>";
  });

  test("Tab inside the open dialog cycles through dialog buttons only", () => {
    const html = renderSite(fixture, "stub");
    loadPage(html);

    const dialog = document.querySelector<HTMLElement>("[data-sosb-lightbox]")!;
    document.querySelectorAll<HTMLButtonElement>("[data-sosb-lightbox-open]")[0]!.click();

    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      ),
    );
    expect(focusable.length).toBeGreaterThanOrEqual(1);

    // Move focus to the last focusable element, simulate Tab — wraps to first.
    const last = focusable[focusable.length - 1]!;
    last.focus();
    expect(document.activeElement).toBe(last);

    const tabEvent = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    document.dispatchEvent(tabEvent);
    // The focus trap intercepts and moves focus back to the first.
    expect(document.activeElement).toBe(focusable[0]);

    // Shift+Tab on first wraps to last.
    focusable[0]!.focus();
    const shiftTabEvent = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(shiftTabEvent);
    expect(document.activeElement).toBe(focusable[focusable.length - 1]);
  });
});

describe("lightbox jsdom — ARIA shape", () => {
  beforeEach(() => {
    document.documentElement.innerHTML = "<head></head><body></body>";
  });

  test("the dialog announces its role and modal state", () => {
    const html = renderSite(fixture, "stub");
    loadPage(html);

    const dialog = document.querySelector<HTMLElement>("[data-sosb-lightbox]")!;
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    // Either aria-label or aria-labelledby is set.
    const labelled = dialog.hasAttribute("aria-label") || dialog.hasAttribute("aria-labelledby");
    expect(labelled).toBe(true);
  });

  test("the trigger announces that it opens an image", () => {
    const html = renderSite(fixture, "stub");
    loadPage(html);

    const triggers = document.querySelectorAll<HTMLButtonElement>("[data-sosb-lightbox-open]");
    // Each trigger has an accessible label (button text or aria-label).
    for (const t of triggers) {
      const labelled = (t.textContent ?? "").trim().length > 0 || t.hasAttribute("aria-label");
      expect(labelled).toBe(true);
    }
  });
});
