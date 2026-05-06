// @vitest-environment jsdom
/**
 * Tests for the "Add Block" dialog.
 *
 * The dialog must:
 * - List every entry from the dynamic `buildBlockCatalog()` output (no
 *   hard-coded type list).
 * - Group entries under category headings (mandatory / optional / advanced).
 * - Show a search box that filters entries by label or description.
 * - Call `onPick(type)` with the registry key when an entry is activated.
 * - Render only when `open` is true; close via the Escape key invokes
 *   `onClose`.
 */
import { describe, expect, test, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import { KnownBlockSchemas } from "@sosb/schema";

import { AddBlockDialog } from "../src/add-block-dialog.js";

describe("AddBlockDialog", () => {
  afterEach(() => cleanup());

  test("renders nothing when `open` is false", () => {
    const { container } = render(
      <AddBlockDialog open={false} onPick={() => {}} onClose={() => {}} />,
    );
    expect(container.querySelector('[data-testid="add-block-dialog"]')).toBeNull();
  });

  test("renders one entry per known block type from the schema registry", () => {
    const { container } = render(
      <AddBlockDialog open={true} onPick={() => {}} onClose={() => {}} />,
    );
    const entries = container.querySelectorAll('[data-testid="add-block-entry"]');
    expect(entries.length).toBe(Object.keys(KnownBlockSchemas).length);
  });

  test("groups entries under category headings", () => {
    const { container } = render(
      <AddBlockDialog open={true} onPick={() => {}} onClose={() => {}} />,
    );
    const groups = container.querySelectorAll('[data-testid="add-block-group"]');
    // The catalog always emits 3 groups even if some are empty; the dialog
    // shows only the non-empty ones.
    expect(groups.length).toBeGreaterThanOrEqual(1);
    // Mandatory exists because `hero` is mandatory.
    expect(
      container.querySelector('[data-testid="add-block-group"][data-category="mandatory"]'),
    ).not.toBeNull();
  });

  test("clicking an entry calls onPick with the registry key", () => {
    const onPick = vi.fn();
    const { container } = render(<AddBlockDialog open={true} onPick={onPick} onClose={() => {}} />);
    const heroEntry = container.querySelector(
      '[data-testid="add-block-entry"][data-block-type="hero"]',
    );
    expect(heroEntry).not.toBeNull();
    if (heroEntry !== null) {
      fireEvent.click(heroEntry);
    }
    expect(onPick).toHaveBeenCalledWith("hero");
  });

  test("typing in the search box filters out non-matching entries", () => {
    const { container } = render(
      <AddBlockDialog open={true} onPick={() => {}} onClose={() => {}} />,
    );
    const search = container.querySelector(
      '[data-testid="add-block-search"]',
    ) as HTMLInputElement | null;
    expect(search).not.toBeNull();
    if (search === null) return;
    fireEvent.input(search, { target: { value: "totally not a block name" } });
    const entries = container.querySelectorAll('[data-testid="add-block-entry"]');
    expect(entries.length).toBe(0);
  });

  test("search matches against the entry's label as well", () => {
    const { container } = render(
      <AddBlockDialog open={true} onPick={() => {}} onClose={() => {}} />,
    );
    const search = container.querySelector(
      '[data-testid="add-block-search"]',
    ) as HTMLInputElement | null;
    if (search === null) throw new Error("search missing");
    fireEvent.input(search, { target: { value: "hero" } });
    const entries = container.querySelectorAll('[data-testid="add-block-entry"]');
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  test("Escape key invokes onClose", () => {
    const onClose = vi.fn();
    const { container } = render(
      <AddBlockDialog open={true} onPick={() => {}} onClose={onClose} />,
    );
    const dialog = container.querySelector('[data-testid="add-block-dialog"]');
    expect(dialog).not.toBeNull();
    if (dialog === null) return;
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("dialog uses role=dialog with aria-modal and an accessible label", () => {
    const { container } = render(
      <AddBlockDialog open={true} onPick={() => {}} onClose={() => {}} />,
    );
    const dialog = container.querySelector('[data-testid="add-block-dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-label")).toBeTruthy();
  });
});
