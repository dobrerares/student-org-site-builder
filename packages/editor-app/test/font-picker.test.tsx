// @vitest-environment jsdom
/**
 * Tests for the FontPicker component — structural form override for
 * `theme.tokens.fontHeadline` and `theme.tokens.fontBody` (ADR 0043).
 *
 * The picker reads the per-theme curated font list from the theme
 * catalog and exposes a "(use theme default)" option for the
 * `undefined` case. Per ADR 0044, an out-of-catalog value is preserved
 * as a "Custom: <value>" option instead of being silently dropped.
 */
import { describe, expect, test, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";

import { FontPicker } from "../src/font-picker.js";

afterEach(cleanup);

describe("FontPicker", () => {
  test("renders options for the active theme's headline fonts", () => {
    const { container } = render(
      <FontPicker themeId="academic" kind="headline" value={undefined} onChange={() => {}} />,
    );
    const select = container.querySelector('select') as HTMLSelectElement;
    const optionTexts = Array.from(select.options).map((o) => o.text);
    // academic's headline fonts include Source Serif Pro, Lora, Crimson Pro
    expect(optionTexts).toContain("Source Serif Pro");
    expect(optionTexts).toContain("Lora");
  });

  test("includes a '(use theme default)' option that is selected when value is undefined", () => {
    const { container } = render(
      <FontPicker themeId="academic" kind="body" value={undefined} onChange={() => {}} />,
    );
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe(""); // default option uses empty string value
    const defaultOption = Array.from(select.options).find((o) => o.value === "");
    expect(defaultOption?.text).toBe("(use theme default)");
  });

  test("when value matches a catalogued font, that option is selected", () => {
    const { container } = render(
      <FontPicker themeId="academic" kind="headline" value="Lora" onChange={() => {}} />,
    );
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe("Lora");
  });

  test("when value is not in the catalog, it's added as a 'Custom:' option that is selected", () => {
    const { container } = render(
      <FontPicker themeId="academic" kind="headline" value="Comic Sans" onChange={() => {}} />,
    );
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe("Comic Sans");
    const customOption = Array.from(select.options).find((o) => o.value === "Comic Sans");
    expect(customOption?.text).toContain("Custom");
  });

  test("onChange fires undefined when '(use theme default)' is selected", () => {
    const onChange = vi.fn();
    const { container } = render(
      <FontPicker themeId="academic" kind="headline" value="Lora" onChange={onChange} />,
    );
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
