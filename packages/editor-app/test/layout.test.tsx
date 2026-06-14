// @vitest-environment jsdom
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/preact";
import type { Site } from "@sosb/schema";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { EditorApp } from "../src/editor-app.js";

const baseSite = minimal as unknown as Site;

/**
 * AC: mobile / narrow layouts (<768px) swap two-pane to tabs (Editor | Preview).
 *
 * The editor inspects `window.innerWidth` (and listens to `resize`) to pick
 * its layout. The two assertions:
 *
 * - At ≥768px the rendered DOM contains both an editor pane and a preview
 *   pane simultaneously (the two-pane layout).
 * - At <768px the rendered DOM contains a tab-style header with at least an
 *   "Editor" and a "Preview" tab.
 *
 * We do NOT assert visual styling (CSS). The contract is structural
 * markup, which is what tab-vs-pane fundamentally is.
 */

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}

describe("EditorApp layout responsiveness", () => {
  beforeEach(() => {
    setViewportWidth(1200);
  });

  afterEach(() => {
    cleanup();
  });

  test("at 1200px viewport, renders the two-pane layout with both editor and preview visible", () => {
    setViewportWidth(1200);
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);

    expect(container.querySelector('[data-testid="editor-pane"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="preview-pane"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="layout-tabs"]')).toBeNull();
  });

  test("at 600px viewport, renders the tab layout (Editor | Preview tabs)", () => {
    setViewportWidth(600);
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);

    expect(container.querySelector('[data-testid="layout-tabs"]')).not.toBeNull();
    const tabs = container.querySelectorAll('[data-testid="layout-tab"]');
    const labels = Array.from(tabs).map((t) => t.textContent?.trim());
    expect(labels).toContain("Editor");
    expect(labels).toContain("Preview");
  });

  test("preview pane exposes selectable viewport sizes", () => {
    setViewportWidth(1200);
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);

    const controls = container.querySelector('[data-testid="viewport-preview-controls"]');
    expect(controls).not.toBeNull();

    const frame = container.querySelector('[data-testid="preview-frame-shell"]');
    expect(frame?.getAttribute("data-preview-viewport")).toBe("fit");

    const options = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[data-testid="viewport-preview-option"]'),
    );
    expect(options.map((option) => option.dataset.viewport)).toEqual([
      "fit",
      "desktop",
      "tablet",
      "phone",
    ]);

    const phone = options.find((option) => option.dataset.viewport === "phone");
    expect(phone).toBeDefined();
    fireEvent.click(phone!);

    expect(frame?.getAttribute("data-preview-viewport")).toBe("phone");
    expect(phone?.getAttribute("aria-pressed")).toBe("true");
  });
});
