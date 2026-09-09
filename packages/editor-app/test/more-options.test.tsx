// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/preact";

import { MoreOptions } from "../src/more-options.js";

describe("MoreOptions", () => {
  afterEach(cleanup);

  test("collapsed: names what is inside and does not mount the panel", () => {
    const { container } = render(
      <MoreOptions open={false} onToggle={() => {}} labels={["Page link name", "Search engines"]}>
        <input data-testid="child" />
      </MoreOptions>,
    );
    const toggle = container.querySelector('[data-testid="advanced-toggle"]');
    expect(toggle).not.toBeNull();
    expect(toggle!.getAttribute("aria-expanded")).toBe("false");
    expect(toggle!.textContent ?? "").toContain("More options");
    expect(toggle!.textContent ?? "").toContain("Page link name and Search engines");
    expect(container.querySelector('[data-testid="child"]')).toBeNull();
  });

  test("clicking the header reports the flipped state", () => {
    const onToggle = vi.fn<(next: boolean) => void>();
    const { container } = render(<MoreOptions open={false} onToggle={onToggle} labels={["A"]} />);
    fireEvent.click(container.querySelector('[data-testid="advanced-toggle"]')!);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  test("open: mounts the panel and wires aria-controls to it", () => {
    const { container } = render(
      <MoreOptions open={true} onToggle={() => {}} labels={["A"]}>
        <input data-testid="child" />
      </MoreOptions>,
    );
    const toggle = container.querySelector('[data-testid="advanced-toggle"]')!;
    const panel = container.querySelector('[data-testid="more-options-panel"]')!;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.querySelector('[data-testid="child"]')).not.toBeNull();
    expect(toggle.textContent ?? "").toContain("Hide more options");
  });
});
