/** @jsxImportSource react */
// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { Site } from "@sosb/schema";
import minimalSite from "./fixtures/minimal-site.json" with { type: "json" };
import { RichTextLinkDialog, type RichTextLinkDialogProps } from "../src/rich-text/link-dialog.js";

afterEach(cleanup);

const site = minimalSite as unknown as Site;

function renderDialog(overrides: Partial<RichTextLinkDialogProps> = {}) {
  const props: RichTextLinkDialogProps = {
    open: true,
    site,
    lang: site.defaultLanguage,
    hasSelection: true,
    onClose: vi.fn(),
    onApply: vi.fn(),
    onRemove: vi.fn(),
    onApplySite: vi.fn(),
    ...overrides,
  };
  const view = render(<RichTextLinkDialog {...props} />);
  return { ...view, props };
}

describe("RichTextLinkDialog — nothing to link", () => {
  test("explains, and disables both apply buttons", async () => {
    const { baseElement } = renderDialog({ hasSelection: false });
    await waitFor(() =>
      expect(baseElement.querySelector('[data-testid="rich-text-link-dialog"]')).not.toBeNull(),
    );
    expect(baseElement.querySelector('[data-testid="rich-text-link-no-selection"]')).not.toBeNull();
    // Even with an option chosen, Add link stays off.
    const option = baseElement.querySelector<HTMLButtonElement>(
      '[data-testid^="rich-text-link-option-page:"]',
    );
    expect(option).not.toBeNull();
    fireEvent.click(option!);
    expect(
      baseElement
        .querySelector('[data-testid="rich-text-link-apply-internal"]')
        ?.hasAttribute("disabled"),
    ).toBe(true);
    // The web-address tab's button too (its panel mounts when the tab is active).
    fireEvent.click(baseElement.querySelector('[data-testid="rich-text-link-tab-external"]')!);
    const external = await waitFor(() => {
      const el = baseElement.querySelector('[data-testid="rich-text-link-apply-external"]');
      expect(el).not.toBeNull();
      return el!;
    });
    expect(external.hasAttribute("disabled")).toBe(true);
  });

  test("a double-click on an option applies nothing and stamps no Page id", async () => {
    // Applying with a collapsed caret would only set a stored mark for the
    // next keystroke, while the internal path had already written a Page id
    // and pushed a Site-history entry for an action with no visible result.
    const { baseElement, props } = renderDialog({ hasSelection: false });
    await waitFor(() =>
      expect(baseElement.querySelector('[data-testid="rich-text-link-dialog"]')).not.toBeNull(),
    );
    const option = baseElement.querySelector<HTMLButtonElement>(
      '[data-testid^="rich-text-link-option-page:"]',
    )!;
    fireEvent.doubleClick(option);
    expect(props.onApply).not.toHaveBeenCalled();
    expect(props.onApplySite).not.toHaveBeenCalled();
  });
});

describe("RichTextLinkDialog — with a selection", () => {
  test("choosing a Page stamps its id on the Site before applying the target", async () => {
    const { baseElement, props } = renderDialog();
    await waitFor(() =>
      expect(baseElement.querySelector('[data-testid="rich-text-link-dialog"]')).not.toBeNull(),
    );
    const option = baseElement.querySelector<HTMLButtonElement>(
      '[data-testid^="rich-text-link-option-page:"]',
    )!;
    fireEvent.click(option);
    fireEvent.click(baseElement.querySelector('[data-testid="rich-text-link-apply-internal"]')!);
    expect(props.onApplySite).toHaveBeenCalledTimes(1);
    const stamped = (props.onApplySite as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Site;
    const id = stamped.pages.find((page) => typeof page.id === "string")?.id;
    expect(id).toBeTruthy();
    expect(props.onApply).toHaveBeenCalledWith({ kind: "page", pageId: id });
  });

  test("an unusable web address is refused with an explanation", async () => {
    const { baseElement, props } = renderDialog();
    await waitFor(() =>
      expect(baseElement.querySelector('[data-testid="rich-text-link-dialog"]')).not.toBeNull(),
    );
    fireEvent.click(baseElement.querySelector('[data-testid="rich-text-link-tab-external"]')!);
    const input = await waitFor(() => {
      const el = baseElement.querySelector<HTMLInputElement>('[data-testid="rich-text-link-href"]');
      expect(el).not.toBeNull();
      return el!;
    });
    fireEvent.input(input, { target: { value: "javascript:alert(1)" } });
    fireEvent.click(baseElement.querySelector('[data-testid="rich-text-link-apply-external"]')!);
    expect(baseElement.querySelector('[data-testid="rich-text-link-invalid"]')).not.toBeNull();
    expect(props.onApply).not.toHaveBeenCalled();
  });
});
