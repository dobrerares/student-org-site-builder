// @vitest-environment jsdom
/**
 * Tests for the theme picker — the canonical structural override that
 * replaces what would otherwise be a raw `theme.id` text input
 * (ADR 0043). Per ADR 0044, this component never falls back to a raw
 * text input.
 */
import { describe, expect, test, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/preact";

import { ThemePicker } from "../src/theme-picker.js";

describe("ThemePicker", () => {
  afterEach(() => cleanup());

  test("renders one option per cataloged theme (5 — stub omitted)", () => {
    const { container } = render(
      <ThemePicker value="academic" onChange={() => {}} />,
    );
    const options = container.querySelectorAll("[data-theme-option]");
    expect(options.length).toBe(5);
  });

  test("marks the active option", () => {
    const { container } = render(
      <ThemePicker value="civic" onChange={() => {}} />,
    );
    const active = container.querySelector('[data-theme-option][data-active="true"]');
    expect(active?.getAttribute("data-theme-id")).toBe("civic");
  });

  test("invokes onChange with the new theme id when an option is clicked", () => {
    let received = "";
    const { container } = render(
      <ThemePicker value="academic" onChange={(id) => (received = id)} />,
    );
    const civic = container.querySelector('[data-theme-id="civic"]') as HTMLElement;
    civic.click();
    expect(received).toBe("civic");
  });

  test("renders the humanised current-value note when value is unknown", () => {
    const { container } = render(
      <ThemePicker value="someFutureTheme" onChange={() => {}} />,
    );
    // Per ADR 0044, never fall back to a raw text input.
    expect(container.querySelector('input[type="text"]')).toBeNull();
    const note = container.querySelector('[data-theme-current-unknown]');
    expect(note).not.toBeNull();
    expect(note?.textContent).toContain("Some future theme");
  });

  test("the active option has aria-checked=true and others have aria-checked=false", () => {
    const { container } = render(
      <ThemePicker value="civic" onChange={() => {}} />,
    );
    const inputs = container.querySelectorAll('input[type="radio"]');
    expect(inputs.length).toBe(5);
    for (const input of Array.from(inputs)) {
      const expected = (input as HTMLInputElement).value === "civic";
      expect((input as HTMLInputElement).checked).toBe(expected);
    }
  });

  test("renders each theme's description text", () => {
    const { container } = render(
      <ThemePicker value="academic" onChange={() => {}} />,
    );
    // The "Academic" description from theme-catalog.ts mentions "scholarly"
    const academic = container.querySelector('[data-theme-id="academic"]');
    expect(academic?.textContent?.toLowerCase()).toContain("scholarly");
  });
});
