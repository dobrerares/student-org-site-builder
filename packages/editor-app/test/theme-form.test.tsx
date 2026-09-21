/** @jsxImportSource react */
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
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { Site } from "@sosb/schema";

import type { ThemeBundle } from "@sosb/renderer";

import { ThemeForm } from "../src/theme-form.js";

/**
 * A Site is `{ theme, pages }` at minimum. These fixtures used to omit
 * `pages`, which typechecked only because of the `as unknown as Site` cast and
 * worked only because nothing in the form walked the page list. Switching
 * Themes now migrates each Block's design-variant memory (ADR 0051), so it
 * does — and a fixture that lies about the shape of a Site fails for a reason
 * that has nothing to do with what the test is asserting.
 */
function siteWithTheme(id: string, tokens?: Record<string, string>): Site {
  return {
    theme: tokens === undefined ? { id } : { id, tokens },
    pages: [],
  } as unknown as Site;
}

describe("ThemeForm", () => {
  afterEach(() => cleanup());

  test("ThemeForm renders the theme picker", () => {
    const site = siteWithTheme("academic");
    const { container } = render(<ThemeForm site={site} onChange={() => {}} />);
    expect(container.querySelector('[data-testid="theme-picker"]')).not.toBeNull();
  });

  test("ThemeForm onChange writes a new theme id back to the site", () => {
    const updates: Site[] = [];
    const site = siteWithTheme("academic");
    const { container } = render(<ThemeForm site={site} onChange={(s) => updates.push(s)} />);
    const civic = container.querySelector('[data-theme-id="civic"]') as HTMLElement;
    civic.click();
    expect(updates[0]!.theme.id).toBe("civic");
  });

  test("ThemeForm does not render any auto-generated text inputs for theme.id", () => {
    // ADR 0044 invariant: never a raw input.
    const site = siteWithTheme("academic");
    const { container } = render(<ThemeForm site={site} onChange={() => {}} />);
    expect(container.querySelector('input[type="text"]')).toBeNull();
  });

  test("ThemeForm renders all six theme-token widgets", () => {
    const site = siteWithTheme("academic");
    const { container } = render(<ThemeForm site={site} onChange={() => {}} />);
    expect(container.querySelectorAll('[data-testid="color-picker"]').length).toBe(2);
    expect(container.querySelectorAll('[data-testid="font-picker"]').length).toBe(2);
    expect(container.querySelectorAll('[data-testid="named-value-select"]').length).toBe(2);
  });

  test("ThemeForm onChange for a color token writes to site.theme.tokens", () => {
    let next: Site | null = null;
    const site = siteWithTheme("academic");
    const { container } = render(<ThemeForm site={site} onChange={(s) => (next = s)} />);
    const firstColorInput = container.querySelector('input[type="color"]') as HTMLInputElement;
    fireEvent.input(firstColorInput, { target: { value: "#ff0000" } });
    expect((next as Site | null)?.theme.tokens?.colorPrimary).toBe("#ff0000");
  });

  test("ThemeForm onChange for a font token writes to site.theme.tokens", () => {
    let next: Site | null = null;
    const site = siteWithTheme("academic");
    const { container } = render(<ThemeForm site={site} onChange={(s) => (next = s)} />);
    // headline picker is the first font-picker
    const headlineSelect = container.querySelector(
      '[data-testid="font-picker"][data-kind="headline"] select',
    ) as HTMLSelectElement;
    fireEvent.change(headlineSelect, { target: { value: "Fraunces" } });
    expect((next as Site | null)?.theme.tokens?.fontHeadline).toBe("Fraunces");
  });

  test("ThemeForm shows an on-color preview chip for each set palette color (Guardrail 2)", () => {
    // Light accent → dark sample text; dark primary → white sample text.
    const site = siteWithTheme("academic", {
      colorPrimary: "#1a2440",
      colorAccent: "#ffe14d",
    });
    const { container } = render(<ThemeForm site={site} onChange={() => {}} />);
    const chips = container.querySelectorAll('[data-testid="color-picker-on-color"]');
    // One per palette ColorPicker (primary + accent); font pickers don't carry chips.
    expect(chips.length).toBe(2);
  });

  test("ThemeForm preserves existing tokens when updating a single token", () => {
    let next: Site | null = null;
    const site = siteWithTheme("academic", { colorPrimary: "#111111", fontBody: "Inter" });
    const { container } = render(<ThemeForm site={site} onChange={(s) => (next = s)} />);
    const accentInput = container.querySelectorAll('input[type="color"]')[1] as HTMLInputElement;
    fireEvent.input(accentInput, { target: { value: "#aa00aa" } });
    expect((next as Site | null)?.theme.tokens?.colorAccent).toBe("#aa00aa");
    // Other tokens preserved:
    expect((next as Site | null)?.theme.tokens?.colorPrimary).toBe("#111111");
    expect((next as Site | null)?.theme.tokens?.fontBody).toBe("Inter");
  });
});

/**
 * A Site whose Theme package is not installed (ADR 0051).
 *
 * The rule is "preserve the content, block the export, offer a repair" — not
 * "quietly render under some other Theme", which would produce a
 * plausible-looking wrong site that an author could publish without ever
 * learning their design was missing. The form is where the author finds out.
 */
describe("ThemeForm with a missing Theme package", () => {
  afterEach(() => cleanup());

  const missingSite = {
    theme: { id: "org.example.practice", version: "1.0.0" },
    pages: [],
  } as unknown as Site;

  test("names the missing Theme and reassures the author about their content", () => {
    const { container } = render(<ThemeForm site={missingSite} onChange={() => {}} />);
    const alert = container.querySelector('[data-testid="theme-missing"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain("org.example.practice");
    expect(alert?.textContent).toContain("unchanged");
  });

  test("the repair switches to a built-in look", () => {
    let next: Site | null = null;
    const { container } = render(<ThemeForm site={missingSite} onChange={(s) => (next = s)} />);
    const repair = container.querySelector(
      '[data-testid="theme-missing-repair"]',
    ) as HTMLElement | null;
    expect(repair).not.toBeNull();
    repair?.click();
    expect((next as Site | null)?.theme.id).toBe("modern");
    // The dangling package version must not survive the switch, or the Site
    // would claim to be at v1.0.0 of a Theme it no longer uses.
    expect((next as Site | null)?.theme.version).toBeUndefined();
  });

  test("no alert once the Theme is installed", () => {
    const bundle = {
      id: "org.example.practice",
      name: "Practice",
      version: "1.0.0",
      origin: "package",
      css: "",
      baselineTokens: [],
      supports: { colors: true, fonts: true, density: true, radius: true },
      blockVariants: {},
      shellVariants: [],
      fontSource: { kind: "registry" },
      assets: new Map(),
    } as unknown as ThemeBundle;
    const { container } = render(
      <ThemeForm site={missingSite} onChange={() => {}} installedThemes={[bundle]} />,
    );
    expect(container.querySelector('[data-testid="theme-missing"]')).toBeNull();
  });
});
