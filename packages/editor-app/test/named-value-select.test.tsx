// @vitest-environment jsdom
/**
 * Tests for the NamedValueSelect component — the generic structural
 * override consumed by ThemeForm for `density` and `radius` tokens
 * (ADR 0043). The cases below exercise the tri-state semantics
 * (`string | undefined`) plus the "Custom: <value>" preservation
 * pattern shared with FontPicker (T14).
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/preact";

import { NamedValueSelect } from "../src/named-value-select.js";

afterEach(cleanup);

const DENSITY_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Normal" },
  { value: "comfortable", label: "Comfortable" },
];

describe("NamedValueSelect", () => {
  test("renders one option per provided entry plus '(use theme default)'", () => {
    const { container } = render(
      <NamedValueSelect value={undefined} onChange={() => {}} options={DENSITY_OPTIONS} />,
    );
    const select = container.querySelector('select') as HTMLSelectElement;
    const optionTexts = Array.from(select.options).map((o) => o.text);
    expect(optionTexts).toEqual(["(use theme default)", "Compact", "Normal", "Comfortable"]);
  });

  test("'(use theme default)' is selected when value is undefined", () => {
    const { container } = render(
      <NamedValueSelect value={undefined} onChange={() => {}} options={DENSITY_OPTIONS} />,
    );
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe("");
  });

  test("a named value is selected when it matches an option", () => {
    const { container } = render(
      <NamedValueSelect value="compact" onChange={() => {}} options={DENSITY_OPTIONS} />,
    );
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe("compact");
  });

  test("an unknown value is preserved as a 'Custom:' option", () => {
    const { container } = render(
      <NamedValueSelect value="ultra-tight" onChange={() => {}} options={DENSITY_OPTIONS} />,
    );
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe("ultra-tight");
    const customOption = Array.from(select.options).find((o) => o.value === "ultra-tight");
    expect(customOption?.text).toContain("Custom");
  });

  test("onChange fires undefined when default option is selected", () => {
    const onChange = vi.fn();
    const { container } = render(
      <NamedValueSelect value="compact" onChange={onChange} options={DENSITY_OPTIONS} />,
    );
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
