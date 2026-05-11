// @vitest-environment jsdom
/**
 * Tests for the ThemeForm component — the form behind the theme
 * drill-in (ADR 0043). In Phase 1 it only contains the ThemePicker;
 * theme tokens land in Phase 3 (T13-T15).
 *
 * Per ADR 0044 (no technical field escape hatches) the form must
 * never expose a raw `<input type="text">` for `theme.id`.
 */
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/preact";
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
    let next: Site | null = null;
    const site = { theme: { id: "academic" } } as unknown as Site;
    const { container } = render(
      <ThemeForm site={site} onChange={(s) => (next = s)} />,
    );
    const civic = container.querySelector('[data-theme-id="civic"]') as HTMLElement;
    civic.click();
    expect(next).not.toBeNull();
    expect(next!.theme.id).toBe("civic");
  });

  test("ThemeForm does not render any auto-generated text inputs for theme.id", () => {
    // ADR 0044 invariant: never a raw input.
    const site = { theme: { id: "academic" } } as unknown as Site;
    const { container } = render(<ThemeForm site={site} onChange={() => {}} />);
    expect(container.querySelector('input[type="text"]')).toBeNull();
  });
});
