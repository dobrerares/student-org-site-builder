// @vitest-environment jsdom
/**
 * Integration tests covering EditorApp's full block-library-picker +
 * DnD reorder + undo/redo flow.
 *
 * These tests render the real `<EditorApp>` and exercise it the way a user
 * would: open the picker, pick a block, reorder via the move buttons, undo,
 * redo, and verify the keyboard shortcut paths (Ctrl+Z, Ctrl+Shift+Z).
 */
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import type { Site } from "@sosb/schema";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { EditorApp } from "../src/editor-app.js";

const baseSite = minimal as unknown as Site;

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}

describe("EditorApp — block library picker", () => {
  beforeEach(() => setViewportWidth(1200));
  afterEach(() => cleanup());

  test("clicking 'Add block' opens the picker dialog", () => {
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);

    expect(container.querySelector('[data-testid="add-block-dialog"]')).toBeNull();

    const addBtn = container.querySelector('[data-testid="block-add"]') as HTMLButtonElement | null;
    expect(addBtn).not.toBeNull();
    if (addBtn !== null) fireEvent.click(addBtn);

    expect(container.querySelector('[data-testid="add-block-dialog"]')).not.toBeNull();
  });

  test("picking 'hero' from the dialog appends a hero block to the active page", () => {
    const initial = structuredClone(baseSite);
    const { container } = render(<EditorApp initial={initial} />);

    const beforeRows = container.querySelectorAll('[data-testid="block-row"]').length;

    fireEvent.click(container.querySelector('[data-testid="block-add"]') as HTMLElement);
    fireEvent.click(
      container.querySelector(
        '[data-testid="add-block-entry"][data-block-type="hero"]',
      ) as HTMLElement,
    );

    const afterRows = container.querySelectorAll('[data-testid="block-row"]').length;
    expect(afterRows).toBe(beforeRows + 1);
    // The dialog auto-closes after picking.
    expect(container.querySelector('[data-testid="add-block-dialog"]')).toBeNull();
  });
});

describe("EditorApp — undo/redo", () => {
  beforeEach(() => setViewportWidth(1200));
  afterEach(() => cleanup());

  test("Undo button is disabled at boot and enables after an edit", () => {
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);

    const undoBtn = container.querySelector(
      '[data-testid="undo-button"]',
    ) as HTMLButtonElement | null;
    expect(undoBtn).not.toBeNull();
    expect(undoBtn?.disabled).toBe(true);

    // Add a hero block.
    fireEvent.click(container.querySelector('[data-testid="block-add"]') as HTMLElement);
    fireEvent.click(
      container.querySelector(
        '[data-testid="add-block-entry"][data-block-type="hero"]',
      ) as HTMLElement,
    );

    expect(undoBtn?.disabled).toBe(false);
  });

  test("clicking Undo restores the previous block list", () => {
    const initial = structuredClone(baseSite);
    const { container } = render(<EditorApp initial={initial} />);

    const beforeRows = container.querySelectorAll('[data-testid="block-row"]').length;

    fireEvent.click(container.querySelector('[data-testid="block-add"]') as HTMLElement);
    fireEvent.click(
      container.querySelector(
        '[data-testid="add-block-entry"][data-block-type="hero"]',
      ) as HTMLElement,
    );

    expect(container.querySelectorAll('[data-testid="block-row"]').length).toBe(beforeRows + 1);

    fireEvent.click(container.querySelector('[data-testid="undo-button"]') as HTMLElement);

    expect(container.querySelectorAll('[data-testid="block-row"]').length).toBe(beforeRows);
  });

  test("Redo restores an undone change and disables once it's at the top", () => {
    const initial = structuredClone(baseSite);
    const { container } = render(<EditorApp initial={initial} />);

    fireEvent.click(container.querySelector('[data-testid="block-add"]') as HTMLElement);
    fireEvent.click(
      container.querySelector(
        '[data-testid="add-block-entry"][data-block-type="hero"]',
      ) as HTMLElement,
    );
    const afterAdd = container.querySelectorAll('[data-testid="block-row"]').length;

    fireEvent.click(container.querySelector('[data-testid="undo-button"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-testid="redo-button"]') as HTMLElement);
    expect(container.querySelectorAll('[data-testid="block-row"]').length).toBe(afterAdd);

    const redoBtn = container.querySelector(
      '[data-testid="redo-button"]',
    ) as HTMLButtonElement | null;
    expect(redoBtn?.disabled).toBe(true);
  });

  test("Ctrl+Z undoes the last change", () => {
    const initial = structuredClone(baseSite);
    const { container } = render(<EditorApp initial={initial} />);

    const beforeRows = container.querySelectorAll('[data-testid="block-row"]').length;

    fireEvent.click(container.querySelector('[data-testid="block-add"]') as HTMLElement);
    fireEvent.click(
      container.querySelector(
        '[data-testid="add-block-entry"][data-block-type="hero"]',
      ) as HTMLElement,
    );

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });

    expect(container.querySelectorAll('[data-testid="block-row"]').length).toBe(beforeRows);
  });

  test("Ctrl+Shift+Z redoes the last undo", () => {
    const initial = structuredClone(baseSite);
    const { container } = render(<EditorApp initial={initial} />);

    fireEvent.click(container.querySelector('[data-testid="block-add"]') as HTMLElement);
    fireEvent.click(
      container.querySelector(
        '[data-testid="add-block-entry"][data-block-type="hero"]',
      ) as HTMLElement,
    );
    const afterAdd = container.querySelectorAll('[data-testid="block-row"]').length;

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });

    expect(container.querySelectorAll('[data-testid="block-row"]').length).toBe(afterAdd);
  });

  test("Cmd+Z (metaKey) undoes the last change on Mac", () => {
    const initial = structuredClone(baseSite);
    const { container } = render(<EditorApp initial={initial} />);

    const beforeRows = container.querySelectorAll('[data-testid="block-row"]').length;

    fireEvent.click(container.querySelector('[data-testid="block-add"]') as HTMLElement);
    fireEvent.click(
      container.querySelector(
        '[data-testid="add-block-entry"][data-block-type="hero"]',
      ) as HTMLElement,
    );

    fireEvent.keyDown(window, { key: "z", metaKey: true });

    expect(container.querySelectorAll('[data-testid="block-row"]').length).toBe(beforeRows);
  });

  test("'Move down' on the first row reorders blocks and is undoable", () => {
    const initial = structuredClone(baseSite);
    const page = initial.pages[0];
    if (page === undefined) throw new Error("fixture missing first page");
    page.blocks = [
      { id: "blk_a", type: "hero", version: 1, data: { title: "A" } },
      { id: "blk_b", type: "hero", version: 1, data: { title: "B" } },
    ];
    const { container } = render(<EditorApp initial={initial} />);

    const idsBefore = Array.from(container.querySelectorAll('[data-testid="block-row"]')).map(
      (row) => (row as HTMLElement).getAttribute("data-block-id"),
    );
    expect(idsBefore).toEqual(["blk_a", "blk_b"]);

    const firstMoveDown = container.querySelectorAll(
      '[data-testid="block-move-down"]',
    )[0] as HTMLButtonElement;
    fireEvent.click(firstMoveDown);

    const idsAfter = Array.from(container.querySelectorAll('[data-testid="block-row"]')).map(
      (row) => (row as HTMLElement).getAttribute("data-block-id"),
    );
    expect(idsAfter).toEqual(["blk_b", "blk_a"]);

    fireEvent.click(container.querySelector('[data-testid="undo-button"]') as HTMLElement);
    const idsUndone = Array.from(container.querySelectorAll('[data-testid="block-row"]')).map(
      (row) => (row as HTMLElement).getAttribute("data-block-id"),
    );
    expect(idsUndone).toEqual(["blk_a", "blk_b"]);
  });

  test("Removing a block is undoable", () => {
    const initial = structuredClone(baseSite);
    const { container } = render(<EditorApp initial={initial} />);

    const before = container.querySelectorAll('[data-testid="block-row"]').length;
    expect(before).toBe(1);

    fireEvent.click(container.querySelector('[data-testid="block-remove"]') as HTMLElement);
    expect(container.querySelectorAll('[data-testid="block-row"]').length).toBe(0);

    fireEvent.click(container.querySelector('[data-testid="undo-button"]') as HTMLElement);
    expect(container.querySelectorAll('[data-testid="block-row"]').length).toBe(1);
  });
});
