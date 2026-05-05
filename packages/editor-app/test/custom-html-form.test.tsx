// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/preact";
import type { CustomHtmlBlock } from "@sosb/schema";

import { CustomHtmlBlockForm } from "../src/custom-html-form.js";

/**
 * AC #4 + the danger-UI half of #2/#3: the customHTML editor form must
 *
 *  - render a `<textarea>` for the html string,
 *  - render a sanitization toggle (checkbox), checked by default,
 *  - show a persistent warning surface when the toggle is OFF,
 *  - explain the trade-offs in inline copy.
 *
 * The form is NOT invoked from the spine-form auto-generator (block forms
 * are explicitly carved out by ADR 0005); this test exercises the form
 * component in isolation, the same pattern other block-form issues will
 * follow.
 */
describe("CustomHtmlBlockForm", () => {
  afterEach(() => {
    cleanup();
  });

  function makeBlock(overrides: Partial<CustomHtmlBlock["data"]> = {}): CustomHtmlBlock {
    return {
      id: "blk_test",
      type: "customHTML",
      version: 1,
      data: {
        html: "<p>hello</p>",
        sanitize: true,
        ...overrides,
      },
    } as CustomHtmlBlock;
  }

  test("renders a textarea bound to the html field", () => {
    const { container } = render(<CustomHtmlBlockForm block={makeBlock()} onChange={() => {}} />);
    const textarea = container.querySelector<HTMLTextAreaElement>('[data-field="data.html"]');
    expect(textarea).not.toBeNull();
    expect(textarea!.value).toBe("<p>hello</p>");
  });

  test("renders a sanitize checkbox bound to data.sanitize, checked by default", () => {
    const { container } = render(
      <CustomHtmlBlockForm block={makeBlock({ sanitize: true })} onChange={() => {}} />,
    );
    const checkbox = container.querySelector<HTMLInputElement>('[data-field="data.sanitize"]');
    expect(checkbox).not.toBeNull();
    expect(checkbox!.type).toBe("checkbox");
    expect(checkbox!.checked).toBe(true);
  });

  test("does NOT show the persistent danger warning when sanitize is on", () => {
    const { container } = render(
      <CustomHtmlBlockForm block={makeBlock({ sanitize: true })} onChange={() => {}} />,
    );
    expect(container.querySelector('[data-testid="custom-html-danger"]')).toBeNull();
  });

  test("shows a persistent danger warning when sanitize is off", () => {
    const { container } = render(
      <CustomHtmlBlockForm block={makeBlock({ sanitize: false })} onChange={() => {}} />,
    );
    const warning = container.querySelector('[data-testid="custom-html-danger"]');
    expect(warning).not.toBeNull();
  });

  test("danger warning has role=alert for assistive tech", () => {
    const { container } = render(
      <CustomHtmlBlockForm block={makeBlock({ sanitize: false })} onChange={() => {}} />,
    );
    const warning = container.querySelector('[data-testid="custom-html-danger"]');
    expect(warning).not.toBeNull();
    expect(warning!.getAttribute("role")).toBe("alert");
  });

  test("editing the html textarea fires onChange with the new html", () => {
    let received: CustomHtmlBlock | null = null;
    const { container } = render(
      <CustomHtmlBlockForm
        block={makeBlock()}
        onChange={(b) => {
          received = b;
        }}
      />,
    );
    const textarea = container.querySelector<HTMLTextAreaElement>('[data-field="data.html"]');
    fireEvent.input(textarea!, { target: { value: "<p>changed</p>" } });
    expect(received).not.toBeNull();
    expect(received!.data.html).toBe("<p>changed</p>");
    // sanitize stays unchanged
    expect(received!.data.sanitize).toBe(true);
  });

  test("toggling sanitize off fires onChange with sanitize:false", () => {
    let received: CustomHtmlBlock | null = null;
    const { container } = render(
      <CustomHtmlBlockForm
        block={makeBlock({ sanitize: true })}
        onChange={(b) => {
          received = b;
        }}
      />,
    );
    const checkbox = container.querySelector<HTMLInputElement>('[data-field="data.sanitize"]');
    fireEvent.click(checkbox!);
    expect(received).not.toBeNull();
    expect(received!.data.sanitize).toBe(false);
  });

  test("includes copy explaining the trade-offs of disabling sanitization", () => {
    const { container } = render(
      <CustomHtmlBlockForm block={makeBlock({ sanitize: false })} onChange={() => {}} />,
    );
    // Look for an info paragraph mentioning "scripts" or "trusted" in the
    // form — the precise wording is owned by the editor; the contract is that
    // *some* explanatory copy is present.
    const text = container.textContent ?? "";
    expect(text.toLowerCase()).toMatch(/sanitiz|trust|risk|raw/);
  });

  test("block list entry markup carries an advanced/danger marker", () => {
    // The form renders a header/badge identifying the block as advanced. We
    // assert the marker is in the block-list label (data-testid surface).
    const { container } = render(<CustomHtmlBlockForm block={makeBlock()} onChange={() => {}} />);
    const advancedMarker = container.querySelector('[data-testid="custom-html-advanced-marker"]');
    expect(advancedMarker).not.toBeNull();
  });
});
