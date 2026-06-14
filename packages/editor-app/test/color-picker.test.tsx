// @vitest-environment jsdom
/**
 * Tests for the ColorPicker component — the structural form override
 * for `theme.tokens.color*` slots (ADR 0043).
 *
 * The component layers tri-state semantics (`string | undefined`) on
 * top of the native `<input type="color">`, which natively only
 * supports `string`. The cases below exercise the four user-visible
 * behaviours: bound value, default-note, picked-colour propagation,
 * and reset-to-undefined.
 */
import { describe, expect, test, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import { onColorFor } from "@sosb/renderer";

import { ColorPicker } from "../src/color-picker.js";

/**
 * jsdom normalises inline `color`/`background` to `rgb(...)`. Convert a
 * hex string to the canonical `rgb(r, g, b)` jsdom emits so we can assert
 * against the element's resolved inline style.
 */
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

afterEach(cleanup);

describe("ColorPicker", () => {
  test("renders a native color input bound to the value", () => {
    const { container } = render(<ColorPicker value="#1a2440" onChange={() => {}} />);
    const input = container.querySelector('input[type="color"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value.toLowerCase()).toBe("#1a2440");
  });

  test("shows a 'using theme default' indicator when value is undefined", () => {
    const { container } = render(<ColorPicker value={undefined} onChange={() => {}} />);
    expect(container.querySelector('[data-testid="color-picker-default-note"]')).not.toBeNull();
  });

  test("invokes onChange with the new hex on user pick", () => {
    const onChange = vi.fn();
    const { container } = render(<ColorPicker value="#1a2440" onChange={onChange} />);
    const input = container.querySelector('input[type="color"]') as HTMLInputElement;
    // Simulate user picking a new color
    fireEvent.input(input, { target: { value: "#ff0000" } });
    expect(onChange).toHaveBeenCalledWith("#ff0000");
  });

  test("'Reset to default' button fires onChange(undefined)", () => {
    const onChange = vi.fn();
    const { container } = render(<ColorPicker value="#1a2440" onChange={onChange} />);
    const reset = container.querySelector('[data-testid="color-picker-reset"]') as HTMLElement;
    expect(reset).not.toBeNull();
    reset.click();
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});

/**
 * On-color preview chip (Guardrail 2). When `previewOnColor` is set, the
 * picker shows a swatch painted with the chosen colour and sample text in
 * the renderer-derived readable on-colour (`onColorFor`). These cases
 * pin that the sample-text colour matches what the renderer would derive,
 * for both a light pick (→ dark ink) and a dark pick (→ white).
 */
describe("ColorPicker — on-color preview (Guardrail 2)", () => {
  test("does not render the preview chip unless previewOnColor is set", () => {
    const { container } = render(<ColorPicker value="#1a2440" onChange={() => {}} />);
    expect(container.querySelector('[data-testid="color-picker-on-color"]')).toBeNull();
  });

  test("a light accent yields dark sample text (#16181c)", () => {
    // Light yellow → renderer picks dark ink for legibility.
    const value = "#ffe14d";
    expect(onColorFor(value)).toBe("#16181c");
    const { container } = render(
      <ColorPicker value={value} previewOnColor onChange={() => {}} />,
    );
    const chip = container.querySelector('[data-testid="color-picker-on-color"]') as HTMLElement;
    expect(chip).not.toBeNull();
    expect(chip.style.background).toBe(hexToRgb(value));
    expect(chip.style.color).toBe(hexToRgb("#16181c"));
  });

  test("a dark primary yields white sample text (#ffffff)", () => {
    // Deep navy → renderer picks white for legibility.
    const value = "#1a2440";
    expect(onColorFor(value)).toBe("#ffffff");
    const { container } = render(
      <ColorPicker value={value} previewOnColor onChange={() => {}} />,
    );
    const chip = container.querySelector('[data-testid="color-picker-on-color"]') as HTMLElement;
    expect(chip.style.color).toBe(hexToRgb("#ffffff"));
  });

  test("with no override set, shows a neutral default placeholder (no real swatch)", () => {
    const { container } = render(
      <ColorPicker value={undefined} previewOnColor onChange={() => {}} />,
    );
    expect(container.querySelector('[data-testid="color-picker-on-color"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="color-picker-on-color-default"]'),
    ).not.toBeNull();
  });
});
