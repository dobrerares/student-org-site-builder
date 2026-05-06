// @vitest-environment jsdom
import { describe, expect, test, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/preact";
import { createTranslator, enCatalog, roCatalog, type Translator } from "@sosb/i18n";
import type { Site } from "@sosb/schema";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { EditorApp } from "../src/editor-app.js";

const baseSite = minimal as unknown as Site;

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}

function makeTranslator(locale: "en" | "ro"): Translator {
  return createTranslator({
    catalogs: { en: enCatalog, ro: roCatalog },
    defaultLocale: "en",
    locale,
  });
}

describe("EditorApp — i18n integration", () => {
  afterEach(() => {
    cleanup();
  });

  test("uses RO labels when given a ro-locale translator", () => {
    setViewportWidth(1200);
    const t = makeTranslator("ro");
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} translator={t} />);

    const importButton = container.querySelector('[data-action="import"]');
    expect(importButton?.textContent).toBe("Importă");

    const exportButton = container.querySelector('[data-action="export"]');
    expect(exportButton?.textContent).toBe("Exportă");

    const resetButton = container.querySelector('[data-action="reset"]');
    expect(resetButton?.textContent).toBe("Resetează");
  });

  test("uses EN labels when given an en-locale translator", () => {
    setViewportWidth(1200);
    const t = makeTranslator("en");
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} translator={t} />);

    const importButton = container.querySelector('[data-action="import"]');
    expect(importButton?.textContent).toBe("Import");

    const exportButton = container.querySelector('[data-action="export"]');
    expect(exportButton?.textContent).toBe("Export");

    const resetButton = container.querySelector('[data-action="reset"]');
    expect(resetButton?.textContent).toBe("Reset");
  });

  test("narrow-layout tab labels are translated", () => {
    setViewportWidth(600);
    const t = makeTranslator("ro");
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} translator={t} />);

    const tabs = container.querySelectorAll('[data-testid="layout-tab"]');
    const labels = Array.from(tabs).map((node) => node.textContent?.trim());
    expect(labels).toContain("Editor");
    expect(labels).toContain("Previzualizare");
  });

  test("locale toggle changes the rendered labels in-place", () => {
    setViewportWidth(1200);
    const t = makeTranslator("en");
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} translator={t} />);

    expect(container.querySelector('[data-action="import"]')?.textContent).toBe("Import");

    const select = container.querySelector<HTMLSelectElement>('[data-testid="locale-select"]');
    expect(select).not.toBeNull();
    fireEvent.change(select!, { target: { value: "ro" } });

    expect(container.querySelector('[data-action="import"]')?.textContent).toBe("Importă");
  });

  test("falls back to a default translator when no translator prop is supplied", () => {
    // Backwards compatibility: existing callers (the layout / propagation
    // tests in this same package) must keep working without passing a
    // translator. The default should be EN (per PRD: "ro-* → RO; everything
    // else → EN", and tests run in node where navigator is undefined).
    setViewportWidth(1200);
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);
    const importButton = container.querySelector('[data-action="import"]');
    expect(importButton?.textContent).toBe("Import");
  });
});
