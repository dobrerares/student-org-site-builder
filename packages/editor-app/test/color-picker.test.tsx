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

import { ColorPicker } from "../src/color-picker.js";

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
