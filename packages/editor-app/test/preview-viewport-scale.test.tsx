/** @jsxImportSource react */
// @vitest-environment jsdom
/**
 * Device-simulation presets.
 *
 * A preset must show the *true* viewport: the previewed page has to believe it
 * has 1440 (or 768, or 390) CSS pixels, so its media queries, `clamp()` type
 * scale and grid breakpoints resolve the way they will for a real visitor. The
 * frame is therefore laid out at full size and transform-scaled down to fit
 * the pane — rather than being given a smaller box, which is what it used to
 * get, so the 1440px desktop frame just overflowed the pane and showed a
 * horizontally-clipped page.
 */
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { Site } from "@sosb/schema";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { EditorApp, fitPreviewScale, previewViewportSizeLabel } from "../src/editor-app.js";

const baseSite = minimal as unknown as Site;

describe("fitPreviewScale", () => {
  test("scales a desktop viewport down into a narrow pane", () => {
    expect(fitPreviewScale({ width: 720, height: 900 }, { width: 1440, height: 900 })).toBe(0.5);
  });

  test("is limited by whichever axis is tighter", () => {
    expect(fitPreviewScale({ width: 1440, height: 450 }, { width: 1440, height: 900 })).toBe(0.5);
  });

  test("never enlarges past 1:1", () => {
    expect(fitPreviewScale({ width: 4000, height: 4000 }, { width: 390, height: 844 })).toBe(1);
  });

  test("falls back to 1 when the pane has not been measured", () => {
    // jsdom reports zero-sized layout boxes; a zero scale would collapse the
    // frame to nothing.
    expect(fitPreviewScale({ width: 0, height: 0 }, { width: 1440, height: 900 })).toBe(1);
  });
});

describe("previewViewportSizeLabel", () => {
  test("renders the simulated pixel size", () => {
    expect(previewViewportSizeLabel({ width: 1440, height: 900 })).toBe("1440 x 900");
  });

  test("calls the unsized 'fit' preset Auto", () => {
    expect(previewViewportSizeLabel({ width: null, height: null })).toBe("Auto");
  });
});

describe("preview frame markup", () => {
  afterEach(() => {
    cleanup();
  });

  function mount(): HTMLElement {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1200,
    });
    return render(<EditorApp initial={structuredClone(baseSite)} />).container;
  }

  function pick(container: HTMLElement, viewport: string): void {
    fireEvent.click(
      container.querySelector<HTMLButtonElement>(
        `[data-testid="viewport-preview-option"][data-viewport="${viewport}"]`,
      )!,
    );
  }

  test("fit leaves the frame unsized and untransformed", () => {
    const container = mount();
    const shell = container.querySelector<HTMLElement>('[data-testid="preview-frame-shell"]')!;
    expect(shell.style.width).toBe("");
    expect(shell.style.transform).toBe("");
  });

  test("a preset lays the frame out at its true viewport size", () => {
    const container = mount();
    pick(container, "desktop");
    const shell = container.querySelector<HTMLElement>('[data-testid="preview-frame-shell"]')!;
    expect(shell.style.width).toBe("1440px");
    expect(shell.style.height).toBe("900px");
    expect(shell.style.transform).toMatch(/^scale\(/);
  });

  test("the sizer tracks the frame's scaled footprint", () => {
    const container = mount();
    pick(container, "phone");
    const sizer = container.querySelector<HTMLElement>('[data-testid="preview-frame-sizer"]')!;
    const shell = container.querySelector<HTMLElement>('[data-testid="preview-frame-shell"]')!;
    const scale = Number(/scale\(([\d.]+)\)/.exec(shell.style.transform)![1]);
    expect(sizer.style.width).toBe(`${390 * scale}px`);
    expect(sizer.style.height).toBe(`${844 * scale}px`);
  });

  test("every preset advertises its simulated size in the toolbar", () => {
    const container = mount();
    const sizes = Array.from(
      container.querySelectorAll('[data-testid="viewport-preview-size"]'),
    ).map((n) => n.textContent);
    expect(sizes).toEqual(["Auto", "1440 x 900", "768 x 1024", "390 x 844"]);
  });
});
