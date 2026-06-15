// @vitest-environment jsdom
/**
 * Tests for the ThemeForm component — the form behind the theme
 * drill-in (ADR 0043). Phase 3 (this batch) adds the six theme-token
 * widgets (ColorPicker × 2, FontPicker × 2, NamedValueSelect × 2) on
 * top of the ThemePicker landed in Phase 1.
 *
 * Per ADR 0044 (no technical field escape hatches) the form must
 * never expose a raw `<input type="text">` for `theme.id` or any
 * token slot — the only entry points are the structural pickers.
 */
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/preact";
import type { Site } from "@sosb/schema";

import { ThemeForm } from "../src/theme-form.js";

describe("ThemeForm", () => {
  afterEach(() => cleanup());

  test("ThemeForm renders the theme picker", () => {
    const site = { theme: { id: "academic" } } as unknown as Site;
    const { container } = render(<ThemeForm site={site} onChange={() => {}} />);
    expect(container.querySelector('[data-testid="theme-picker"]')).not.toBeNull();
  });

  test("ThemeForm onChange writes a new theme id back to the site", () => {
    const updates: Site[] = [];
    const site = { theme: { id: "academic" } } as unknown as Site;
    const { container } = render(<ThemeForm site={site} onChange={(s) => updates.push(s)} />);
    const civic = container.querySelector('[data-theme-id="civic"]') as HTMLElement;
    civic.click();
    expect(updates[0]!.theme.id).toBe("civic");
  });

  test("ThemeForm does not render any auto-generated text inputs for theme.id", () => {
    // ADR 0044 invariant: never a raw input.
    const site = { theme: { id: "academic" } } as unknown as Site;
    const { container } = render(<ThemeForm site={site} onChange={() => {}} />);
    expect(container.querySelector('input[type="text"]')).toBeNull();
  });

  test("ThemeForm renders all six theme-token widgets", () => {
    const site = { theme: { id: "academic" } };
    const { container } = render(<ThemeForm site={site as unknown as Site} onChange={() => {}} />);
    expect(container.querySelectorAll('[data-testid="color-picker"]').length).toBe(2);
    expect(container.querySelectorAll('[data-testid="font-picker"]').length).toBe(2);
    expect(container.querySelectorAll('[data-testid="named-value-select"]').length).toBe(2);
  });

  test("ThemeForm onChange for a color token writes to site.theme.tokens", () => {
    let next: Site | null = null;
    const site = { theme: { id: "academic" } };
    const { container } = render(
      <ThemeForm site={site as unknown as Site} onChange={(s) => (next = s)} />,
    );
    const firstColorInput = container.querySelector('input[type="color"]') as HTMLInputElement;
    fireEvent.input(firstColorInput, { target: { value: "#ff0000" } });
    expect((next as Site | null)?.theme.tokens?.colorPrimary).toBe("#ff0000");
  });

  test("ThemeForm onChange for a font token writes to site.theme.tokens", () => {
    let next: Site | null = null;
    const site = { theme: { id: "academic" } };
    const { container } = render(
      <ThemeForm site={site as unknown as Site} onChange={(s) => (next = s)} />,
    );
    // headline picker is the first font-picker
    const headlineSelect = container.querySelector(
      '[data-testid="font-picker"][data-kind="headline"] select',
    ) as HTMLSelectElement;
    fireEvent.change(headlineSelect, { target: { value: "Fraunces" } });
    expect((next as Site | null)?.theme.tokens?.fontHeadline).toBe("Fraunces");
  });

  test("ThemeForm shows an on-color preview chip for each set palette color (Guardrail 2)", () => {
    // Light accent → dark sample text; dark primary → white sample text.
    const site = {
      theme: {
        id: "academic",
        tokens: { colorPrimary: "#1a2440", colorAccent: "#ffe14d" },
      },
    };
    const { container } = render(<ThemeForm site={site as unknown as Site} onChange={() => {}} />);
    const chips = container.querySelectorAll('[data-testid="color-picker-on-color"]');
    // One per palette ColorPicker (primary + accent); font pickers don't carry chips.
    expect(chips.length).toBe(2);
  });

  test("ThemeForm preserves existing tokens when updating a single token", () => {
    let next: Site | null = null;
    const site = {
      theme: {
        id: "academic",
        tokens: { colorPrimary: "#111111", fontBody: "Inter" },
      },
    };
    const { container } = render(
      <ThemeForm site={site as unknown as Site} onChange={(s) => (next = s)} />,
    );
    const accentInput = container.querySelectorAll('input[type="color"]')[1] as HTMLInputElement;
    fireEvent.input(accentInput, { target: { value: "#aa00aa" } });
    expect((next as Site | null)?.theme.tokens?.colorAccent).toBe("#aa00aa");
    // Other tokens preserved:
    expect((next as Site | null)?.theme.tokens?.colorPrimary).toBe("#111111");
    expect((next as Site | null)?.theme.tokens?.fontBody).toBe("Inter");
  });
});
