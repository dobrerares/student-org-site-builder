/** @jsxImportSource react */
// @vitest-environment jsdom
/**
 * Theme miniatures.
 *
 * The picker shows every theme at once, so these have to be cheap: render the
 * HTML once per theme, mount only what is on screen, and boot one iframe at a
 * time. They also have to be honest — the whole reason they replaced
 * hand-written hex swatches is that the swatches were a manual copy of the
 * theme CSS that could drift.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

import { KNOWN_THEME_IDS } from "@sosb/renderer";

import {
  THEME_PREVIEW_VIEWPORT_WIDTH,
  clearThemePreviewHtmlCache,
  themePreviewHtml,
} from "../src/theme-preview-html.js";
import { ThemeMiniPreview, resetThemeMiniPreviewQueue } from "../src/theme-mini-preview.js";
import { buildThemeCatalog } from "../src/theme-catalog.js";

describe("themePreviewHtml", () => {
  beforeEach(() => {
    clearThemePreviewHtmlCache();
  });

  test("renders a complete document for every registered theme", () => {
    for (const themeId of KNOWN_THEME_IDS) {
      const html = themePreviewHtml(themeId);
      expect(html.startsWith("<!doctype html>")).toBe(true);
      expect(html).toContain("<main>");
    }
  });

  test("is the renderer's own output, so it cannot drift from the theme", () => {
    // Two themes must not produce the same picture — if they did, the picker
    // would be lying about the choice being meaningful.
    const academic = themePreviewHtml("academic");
    const civic = themePreviewHtml("civic");
    expect(academic).not.toBe(civic);
  });

  test("memoises per theme", () => {
    expect(themePreviewHtml("modern")).toBe(themePreviewHtml("modern"));
  });

  test("carries no preview-only scripts — a miniature is a still picture", () => {
    const html = themePreviewHtml("academic");
    expect(html).not.toContain("data-sosb-preview-nav");
    expect(html).not.toContain("data-sosb-preview-morph");
  });

  test("leaves no unresolvable asset path to render as a broken image", () => {
    const html = themePreviewHtml("editorial");
    expect(html).not.toMatch(/(?:src|href)="(?:\.\.\/)*assets\/(?!fonts\/)/);
  });

  test("every cataloged theme has a miniature", () => {
    for (const entry of buildThemeCatalog().entries) {
      expect(themePreviewHtml(entry.id).length).toBeGreaterThan(0);
    }
  });
});

describe("ThemeMiniPreview", () => {
  afterEach(() => {
    cleanup();
    resetThemeMiniPreviewQueue();
  });

  test("renders the miniature when no IntersectionObserver is available", () => {
    // jsdom has none; falling back to mounting immediately is better than
    // showing nothing at all.
    const { container } = render(<ThemeMiniPreview themeId="academic" />);
    const frame = container.querySelector<HTMLIFrameElement>(
      "[data-theme-mini-preview-frame]",
    );
    expect(frame).not.toBeNull();
    expect(frame!.getAttribute("srcdoc")).toContain("<!doctype html>");
  });

  test("is decorative and unreachable: aria-hidden, untabbable, no scripts", () => {
    const { container } = render(<ThemeMiniPreview themeId="civic" />);
    const root = container.querySelector("[data-theme-mini-preview]")!;
    expect(root.getAttribute("aria-hidden")).toBe("true");
    const frame = container.querySelector<HTMLIFrameElement>(
      "[data-theme-mini-preview-frame]",
    )!;
    expect(frame.getAttribute("tabindex")).toBe("-1");
    // Empty sandbox: no scripts, no forms, no navigation.
    expect(frame.getAttribute("sandbox")).toBe("");
  });

  test("scales the full-width render down to the requested box", () => {
    const { container } = render(<ThemeMiniPreview themeId="modern" width={300} height={200} />);
    const root = container.querySelector<HTMLElement>("[data-theme-mini-preview]")!;
    expect(root.style.width).toBe("300px");
    expect(root.style.height).toBe("200px");

    const frame = container.querySelector<HTMLIFrameElement>(
      "[data-theme-mini-preview-frame]",
    )!;
    // Laid out at the full viewport width, then scaled — so the miniature
    // shows the theme's desktop composition, not its mobile stack.
    expect(frame.style.width).toBe(`${THEME_PREVIEW_VIEWPORT_WIDTH}px`);
    expect(frame.style.transform).toBe(`scale(${300 / THEME_PREVIEW_VIEWPORT_WIDTH})`);
  });

  test("boots one miniature at a time", () => {
    const { container } = render(
      <>
        {KNOWN_THEME_IDS.map((id) => (
          <ThemeMiniPreview key={id} themeId={id} />
        ))}
      </>,
    );
    // Several are mounted, but only the first has been admitted to boot; the
    // rest wait their turn rather than starting six document parses at once.
    expect(container.querySelectorAll("[data-theme-mini-preview]").length).toBe(
      KNOWN_THEME_IDS.length,
    );
    expect(container.querySelectorAll("[data-theme-mini-preview-frame]").length).toBe(1);
  });

  test("hands the slot on when a miniature finishes loading", () => {
    const { container } = render(
      <>
        <ThemeMiniPreview themeId="academic" />
        <ThemeMiniPreview themeId="civic" />
      </>,
    );
    const first = container.querySelector<HTMLIFrameElement>(
      "[data-theme-mini-preview-frame]",
    )!;
    act(() => {
      first.dispatchEvent(new Event("load"));
    });
    expect(container.querySelectorAll("[data-theme-mini-preview-frame]").length).toBe(2);
  });
});
