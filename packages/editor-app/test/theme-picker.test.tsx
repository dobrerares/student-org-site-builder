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

  test("renders an unknown theme id via the catalog's humanise fallback (no crash)", () => {
    const { container } = render(
      <ThemePicker value="someFutureTheme" onChange={() => {}} />,
    );
    // The current value is shown even if it isn't cataloged — never a fallback
    // to a raw text input (per ADR 0044).
    expect(container.querySelector('input[type="text"]')).toBeNull();
  });
});
