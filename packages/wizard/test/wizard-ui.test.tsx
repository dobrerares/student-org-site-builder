// @vitest-environment jsdom
import { describe, expect, test, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";

import { Wizard } from "../src/wizard.js";

/**
 * Wizard Preact shell — renders all six steps with appropriate forms,
 * Back/Next preserves state, "Skip" available on optional steps, "Cancel"
 * on every step, "Create" on confirm fires onComplete with a valid Site.
 *
 * The shell is the visible side of the state machine — the same
 * deterministic transitions the unit tests cover, here exercised through
 * actual button clicks. (We do NOT re-test the full transition matrix
 * here — see state-machine.test.ts for that.)
 */

afterEach(() => {
  cleanup();
});

describe("Wizard — six steps render", () => {
  test("renders the 'basics' step on first mount", () => {
    const { container } = render(<Wizard />);
    expect(container.querySelector('[data-wizard-step="basics"]')).not.toBeNull();
  });

  test("declares all six step ids in the step indicator", () => {
    const { container } = render(<Wizard />);
    const indicators = container.querySelectorAll("[data-wizard-step-indicator]");
    const ids = Array.from(indicators).map((el) => el.getAttribute("data-wizard-step-indicator"));
    expect(new Set(ids)).toEqual(
      new Set(["basics", "identity", "sections", "content", "languages", "confirm"]),
    );
  });

  test("renders an 'org name' input on the basics step", () => {
    const { container } = render(<Wizard />);
    const input = container.querySelector('[data-field="basics.name"]');
    expect(input).not.toBeNull();
  });

  test("sections step uses non-technical labels", () => {
    const { container } = render(<Wizard />);
    const input = container.querySelector('[data-field="basics.name"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "Org" } });
    fireEvent.click(container.querySelector('[data-action="next"]')!);
    fireEvent.click(container.querySelector('[data-action="skip"]')!);

    const step = container.querySelector('[data-testid="sections-step"]');
    expect(step?.textContent).toContain("Top page header");
    expect(step?.textContent).toContain("About text");
    expect(step?.textContent).not.toContain("Hero");
    expect(step?.textContent).not.toContain("rich text");
  });
});

describe("Wizard — Back/Next navigation", () => {
  test("Next is disabled on basics until org name is entered", () => {
    const { container } = render(<Wizard />);
    const nextButton = container.querySelector('[data-action="next"]') as HTMLButtonElement | null;
    expect(nextButton).not.toBeNull();
    expect(nextButton!.disabled).toBe(true);
  });

  test("Next becomes enabled once org name is entered, advances to identity", () => {
    const { container } = render(<Wizard />);
    const input = container.querySelector('[data-field="basics.name"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    fireEvent.input(input!, { target: { value: "HISTORIPOL" } });

    const nextButton = container.querySelector('[data-action="next"]') as HTMLButtonElement;
    expect(nextButton.disabled).toBe(false);
    fireEvent.click(nextButton);

    expect(container.querySelector('[data-wizard-step="identity"]')).not.toBeNull();
  });

  test("Back returns to the previous step preserving entered data", () => {
    const { container } = render(<Wizard />);
    const input = container.querySelector('[data-field="basics.name"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "HISTORIPOL" } });
    fireEvent.click(container.querySelector('[data-action="next"]')!);

    expect(container.querySelector('[data-wizard-step="identity"]')).not.toBeNull();

    fireEvent.click(container.querySelector('[data-action="back"]')!);
    expect(container.querySelector('[data-wizard-step="basics"]')).not.toBeNull();
    const restored = container.querySelector('[data-field="basics.name"]') as HTMLInputElement;
    expect(restored.value).toBe("HISTORIPOL");
  });

  test("Back is disabled on the first step (basics)", () => {
    const { container } = render(<Wizard />);
    const back = container.querySelector('[data-action="back"]') as HTMLButtonElement;
    expect(back.disabled).toBe(true);
  });
});

describe("Wizard — 'Skip' on optional steps", () => {
  test("Skip is rendered on identity, sections, content, languages — not on basics or confirm", () => {
    const { container } = render(<Wizard />);
    // basics: no skip
    expect(container.querySelector('[data-action="skip"]')).toBeNull();

    // advance to identity
    const input = container.querySelector('[data-field="basics.name"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "Org" } });
    fireEvent.click(container.querySelector('[data-action="next"]')!);
    expect(container.querySelector('[data-action="skip"]')).not.toBeNull();
  });

  test("clicking Skip on identity advances to sections", () => {
    const { container } = render(<Wizard />);
    const input = container.querySelector('[data-field="basics.name"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "Org" } });
    fireEvent.click(container.querySelector('[data-action="next"]')!);

    const skip = container.querySelector('[data-action="skip"]')!;
    fireEvent.click(skip);
    expect(container.querySelector('[data-wizard-step="sections"]')).not.toBeNull();
  });
});

describe("Wizard — Cancel", () => {
  test("Cancel button fires onCancel callback", () => {
    const onCancel = vi.fn();
    const { container } = render(<Wizard onCancel={onCancel} />);
    const button = container.querySelector('[data-action="cancel"]') as HTMLButtonElement;
    expect(button).not.toBeNull();
    fireEvent.click(button);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("Cancel is available on every step", () => {
    const { container } = render(<Wizard />);
    const input = container.querySelector('[data-field="basics.name"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "Org" } });

    expect(container.querySelector('[data-action="cancel"]')).not.toBeNull();

    // advance: identity
    fireEvent.click(container.querySelector('[data-action="next"]')!);
    expect(container.querySelector('[data-action="cancel"]')).not.toBeNull();

    // skip several
    fireEvent.click(container.querySelector('[data-action="skip"]')!); // sections
    expect(container.querySelector('[data-action="cancel"]')).not.toBeNull();
  });
});

describe("Wizard — confirm step + onComplete", () => {
  function advanceToConfirm(container: Element): void {
    const input = container.querySelector('[data-field="basics.name"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "HISTORIPOL" } });
    fireEvent.click(container.querySelector('[data-action="next"]')!); // identity
    fireEvent.click(container.querySelector('[data-action="skip"]')!); // sections
    fireEvent.click(container.querySelector('[data-action="skip"]')!); // content
    fireEvent.click(container.querySelector('[data-action="skip"]')!); // languages
    fireEvent.click(container.querySelector('[data-action="skip"]')!); // confirm
  }

  test("the confirm step renders with a 'Create' button", () => {
    const { container } = render(<Wizard />);
    advanceToConfirm(container);
    expect(container.querySelector('[data-wizard-step="confirm"]')).not.toBeNull();
    expect(container.querySelector('[data-action="create"]')).not.toBeNull();
  });

  test("the confirm step shows a preview summary (org name, theme, languages)", () => {
    const { container } = render(<Wizard />);
    advanceToConfirm(container);
    const summary = container.querySelector('[data-testid="confirm-summary"]');
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toContain("HISTORIPOL");
    expect(summary?.textContent).toContain("Minimal");
    expect(summary?.textContent).toContain("Română");
    expect(summary?.textContent).toContain("Top page header");
    expect(summary?.textContent).not.toContain("richText");
  });

  test("clicking Create fires onComplete with a valid Site object", () => {
    const onComplete = vi.fn();
    const { container } = render(<Wizard onComplete={onComplete} />);
    advanceToConfirm(container);

    const create = container.querySelector('[data-action="create"]')!;
    fireEvent.click(create);
    expect(onComplete).toHaveBeenCalledTimes(1);
    const site = onComplete.mock.calls[0]?.[0];
    expect(site).toBeDefined();
    expect(site.org.name).toBe("HISTORIPOL");
    expect(Array.isArray(site.pages)).toBe(true);
    expect(site.pages.length).toBeGreaterThan(0);
  });
});

describe("Wizard — initial state", () => {
  test("accepts an `initial` prop to resume from a persisted state", () => {
    const { container } = render(
      <Wizard
        initial={{
          step: "identity",
          data: { basics: { name: "Resumed Org" } },
        }}
      />,
    );
    expect(container.querySelector('[data-wizard-step="identity"]')).not.toBeNull();

    fireEvent.click(container.querySelector('[data-action="back"]')!);
    const restored = container.querySelector('[data-field="basics.name"]') as HTMLInputElement;
    expect(restored.value).toBe("Resumed Org");
  });
});

describe("Wizard — onProgress callback", () => {
  test("fires onProgress on every state transition (so the host can persist)", () => {
    const onProgress = vi.fn();
    const { container } = render(<Wizard onProgress={onProgress} />);
    const input = container.querySelector('[data-field="basics.name"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "Org" } });

    // After the input change, onProgress has been called.
    expect(onProgress).toHaveBeenCalled();
    const lastCallArg = onProgress.mock.calls[onProgress.mock.calls.length - 1]?.[0];
    expect(lastCallArg.data.basics?.name).toBe("Org");
  });
});
