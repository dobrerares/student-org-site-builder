/** @jsxImportSource react */
// @vitest-environment jsdom
/**
 * Integration tests covering EditorApp's full block-library-picker +
 * DnD reorder + undo/redo flow.
 *
 * These tests render the real `<EditorApp>` and exercise it the way a user
 * would: open the home page, open the picker, pick a block, reorder via the
 * move buttons, undo, redo, and verify the keyboard shortcut paths (Ctrl+Z,
 * Ctrl+Shift+Z).
 */
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import type { Site } from "@sosb/schema";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { openPage, setViewportWidth } from "./helpers/nav.js";
import { EditorApp } from "../src/editor-app.js";

const baseSite = minimal as unknown as Site;

function mount(site: Site = structuredClone(baseSite)): HTMLElement {
  const { container } = render(<EditorApp initial={site} />);
  openPage(container, 0);
  return container;
}

function rowCount(container: HTMLElement): number {
  return container.querySelectorAll('[data-testid="block-row"]').length;
}

function addHero(container: HTMLElement): void {
  fireEvent.click(container.querySelector('[data-testid="block-add"]') as HTMLElement);
  fireEvent.click(
    container.querySelector(
      '[data-testid="add-block-entry"][data-block-type="hero"]',
    ) as HTMLElement,
  );
}

describe("EditorApp — block library picker", () => {
  beforeEach(() => setViewportWidth(1200));
  afterEach(() => cleanup());

  test("clicking 'Add block' opens the picker dialog", () => {
    const container = mount();
    expect(container.querySelector('[data-testid="add-block-dialog"]')).toBeNull();

    fireEvent.click(container.querySelector('[data-testid="block-add"]') as HTMLElement);

    expect(container.querySelector('[data-testid="add-block-dialog"]')).not.toBeNull();
  });

  test("picking 'hero' from the dialog appends a hero block to the open page", () => {
    const container = mount();
    const before = rowCount(container);

    addHero(container);

    expect(rowCount(container)).toBe(before + 1);
    expect(container.querySelector('[data-testid="add-block-dialog"]')).toBeNull();
  });
});

describe("EditorApp — undo/redo", () => {
  beforeEach(() => setViewportWidth(1200));
  afterEach(() => cleanup());

  test("Undo button is disabled at boot and enables after an edit", () => {
    const container = mount();
    const undoBtn = container.querySelector<HTMLButtonElement>('[data-testid="undo-button"]');
    expect(undoBtn?.disabled).toBe(true);

    addHero(container);

    expect(undoBtn?.disabled).toBe(false);
  });

  test("clicking Undo restores the previous block list", () => {
    const container = mount();
    const before = rowCount(container);
    addHero(container);
    expect(rowCount(container)).toBe(before + 1);

    fireEvent.click(container.querySelector('[data-testid="undo-button"]') as HTMLElement);

    expect(rowCount(container)).toBe(before);
  });

  test("Redo restores an undone change and disables once it's at the top", () => {
    const container = mount();
    addHero(container);
    const afterAdd = rowCount(container);

    fireEvent.click(container.querySelector('[data-testid="undo-button"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-testid="redo-button"]') as HTMLElement);
    expect(rowCount(container)).toBe(afterAdd);

    const redoBtn = container.querySelector<HTMLButtonElement>('[data-testid="redo-button"]');
    expect(redoBtn?.disabled).toBe(true);
  });

  test("Ctrl+Z undoes the last change", () => {
    const container = mount();
    const before = rowCount(container);
    addHero(container);

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });

    expect(rowCount(container)).toBe(before);
  });

  test("Ctrl+Shift+Z redoes the last undo", () => {
    const container = mount();
    addHero(container);
    const afterAdd = rowCount(container);

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });

    expect(rowCount(container)).toBe(afterAdd);
  });

  test("Cmd+Z (metaKey) undoes the last change on Mac", () => {
    const container = mount();
    const before = rowCount(container);
    addHero(container);

    fireEvent.keyDown(window, { key: "z", metaKey: true });

    expect(rowCount(container)).toBe(before);
  });

  test("'Move down' on the first row reorders blocks and is undoable", () => {
    const initial = structuredClone(baseSite);
    const page = initial.pages[0];
    if (page === undefined) throw new Error("fixture missing first page");
    page.blocks = [
      { id: "blk_a", type: "hero", version: 1, data: { title: "A" } },
      { id: "blk_b", type: "hero", version: 1, data: { title: "B" } },
    ];
    const container = mount(initial);
    const ids = (): (string | null)[] =>
      Array.from(container.querySelectorAll('[data-testid="block-row"]')).map((row) =>
        (row as HTMLElement).getAttribute("data-block-id"),
      );
    expect(ids()).toEqual(["blk_a", "blk_b"]);

    fireEvent.click(
      container.querySelectorAll('[data-testid="block-move-down"]')[0] as HTMLButtonElement,
    );
    expect(ids()).toEqual(["blk_b", "blk_a"]);

    fireEvent.click(container.querySelector('[data-testid="undo-button"]') as HTMLElement);
    expect(ids()).toEqual(["blk_a", "blk_b"]);
  });

  test("Removing a block is undoable", () => {
    const container = mount();
    expect(rowCount(container)).toBe(1);

    fireEvent.click(container.querySelector('[data-testid="block-remove"]') as HTMLElement);
    expect(rowCount(container)).toBe(0);

    fireEvent.click(container.querySelector('[data-testid="undo-button"]') as HTMLElement);
    expect(rowCount(container)).toBe(1);
  });
});
