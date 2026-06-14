// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/preact";

import { AdvancedToggle } from "../src/advanced-toggle.js";

/**
 * AdvancedToggle — per-form expert-options checkbox (ADR 0043).
 *
 * Three tests:
 *  1. Renders an unchecked checkbox when `value={false}`.
 *  2. Clicking the checkbox fires `onChange` with the flipped value.
 *  3. The control is reachable by accessible name — either via the
 *     `aria-label` on the input or the visible "Show expert options" text.
 */
describe("AdvancedToggle", () => {
  afterEach(cleanup);

  test("renders an unchecked checkbox by default when value=false", () => {
    const { container } = render(<AdvancedToggle value={false} onChange={() => {}} />);
    const toggle = container.querySelector<HTMLLabelElement>('[data-testid="advanced-toggle"]');
    expect(toggle).not.toBeNull();
    const checkbox = toggle!.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    expect(checkbox!.checked).toBe(false);
  });

  test("clicking the toggle fires onChange with the new value", () => {
    const onChange = vi.fn<(next: boolean) => void>();
    const { container } = render(<AdvancedToggle value={false} onChange={onChange} />);
    const checkbox = container.querySelector<HTMLInputElement>(
      '[data-testid="advanced-toggle"] input[type="checkbox"]',
    );
    expect(checkbox).not.toBeNull();

    // Simulate the user toggling the checkbox on. `fireEvent.click` on a
    // checkbox flips its `checked` state before dispatching `change`.
    fireEvent.click(checkbox!);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test("the toggle is accessible via aria-label or visible 'Show expert options' text", () => {
    const { container } = render(<AdvancedToggle value={false} onChange={() => {}} />);
    const checkbox = container.querySelector<HTMLInputElement>(
      '[data-testid="advanced-toggle"] input[type="checkbox"]',
    );
    expect(checkbox).not.toBeNull();
    // The control must be reachable by either accessible-name source.
    const ariaLabel = checkbox!.getAttribute("aria-label");
    const visibleText = container.textContent ?? "";
    const accessibleByLabel = ariaLabel === "Show expert options";
    const accessibleByText = visibleText.includes("Show expert options");
    expect(accessibleByLabel || accessibleByText).toBe(true);
  });
});
