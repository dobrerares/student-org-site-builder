// @vitest-environment jsdom
/**
 * Tests for the per-page block list editor.
 *
 * The editor renders the page's blocks as a sortable list. Each row shows:
 * - The block's label (drawn from the catalog), e.g. "Hero".
 * - A drag handle (the only thing the user can grab — body drags are ignored
 *   per the AC).
 * - "Move up" / "Move down" buttons (the keyboard-accessible alternative to
 *   drag-and-drop reordering).
 * - A "Remove" button.
 *
 * The list also has an "Add Block" button that opens the picker.
 */
import { describe, expect, test, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import type { Site, BlockEnvelope } from "@sosb/schema";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { BlockListEditor } from "../src/block-list-editor.js";

const baseSite = minimal as unknown as Site;

function siteWithThree(): Site {
  const site = structuredClone(baseSite);
  const page = site.pages[0];
  if (page === undefined) throw new Error("fixture has no first page");
  page.blocks = [
    { id: "blk_a", type: "hero", version: 1, data: { title: "A" } },
    { id: "blk_b", type: "hero", version: 1, data: { title: "B" } },
    { id: "blk_c", type: "hero", version: 1, data: { title: "C" } },
  ] satisfies BlockEnvelope[];
  return site;
}

describe("BlockListEditor", () => {
  afterEach(() => cleanup());

  test("renders one row per block on the page", () => {
    const { container } = render(
      <BlockListEditor
        site={siteWithThree()}
        pageSlug="acasa"
        onMove={() => {}}
        onRemove={() => {}}
        onAddBlock={() => {}}
      />,
    );
    const rows = container.querySelectorAll('[data-testid="block-row"]');
    expect(rows.length).toBe(3);
  });

  test("each row carries a drag handle and the surrounding row is not draggable", () => {
    const { container } = render(
      <BlockListEditor
        site={siteWithThree()}
        pageSlug="acasa"
        onMove={() => {}}
        onRemove={() => {}}
        onAddBlock={() => {}}
      />,
    );
    const rows = container.querySelectorAll('[data-testid="block-row"]');
    for (const row of rows) {
      // The whole row must NOT be draggable — drag is initiated only via
      // the explicit handle, per the PRD.
      expect((row as HTMLElement).getAttribute("draggable")).not.toBe("true");
      const handle = row.querySelector('[data-testid="block-drag-handle"]');
      expect(handle).not.toBeNull();
      expect(handle?.getAttribute("draggable")).toBe("true");
    }
  });

  test("clicking 'move down' on the first row calls onMove(0, 1)", () => {
    const onMove = vi.fn();
    const { container } = render(
      <BlockListEditor
        site={siteWithThree()}
        pageSlug="acasa"
        onMove={onMove}
        onRemove={() => {}}
        onAddBlock={() => {}}
      />,
    );
    const rows = container.querySelectorAll('[data-testid="block-row"]');
    const moveDown = rows[0]?.querySelector(
      '[data-testid="block-move-down"]',
    ) as HTMLButtonElement | null;
    expect(moveDown).not.toBeNull();
    if (moveDown !== null) {
      fireEvent.click(moveDown);
    }
    expect(onMove).toHaveBeenCalledWith(0, 1);
  });

  test("clicking 'move up' on the last row calls onMove(2, 1)", () => {
    const onMove = vi.fn();
    const { container } = render(
      <BlockListEditor
        site={siteWithThree()}
        pageSlug="acasa"
        onMove={onMove}
        onRemove={() => {}}
        onAddBlock={() => {}}
      />,
    );
    const rows = container.querySelectorAll('[data-testid="block-row"]');
    const moveUp = rows[2]?.querySelector(
      '[data-testid="block-move-up"]',
    ) as HTMLButtonElement | null;
    if (moveUp !== null) {
      fireEvent.click(moveUp);
    }
    expect(onMove).toHaveBeenCalledWith(2, 1);
  });

  test("the first row's 'move up' is disabled and the last row's 'move down' is disabled", () => {
    const { container } = render(
      <BlockListEditor
        site={siteWithThree()}
        pageSlug="acasa"
        onMove={() => {}}
        onRemove={() => {}}
        onAddBlock={() => {}}
      />,
    );
    const rows = container.querySelectorAll('[data-testid="block-row"]');
    const firstUp = rows[0]?.querySelector(
      '[data-testid="block-move-up"]',
    ) as HTMLButtonElement | null;
    const lastDown = rows[2]?.querySelector(
      '[data-testid="block-move-down"]',
    ) as HTMLButtonElement | null;
    expect(firstUp?.disabled).toBe(true);
    expect(lastDown?.disabled).toBe(true);
  });

  test("clicking remove on a row calls onRemove(blockId)", () => {
    const onRemove = vi.fn();
    const { container } = render(
      <BlockListEditor
        site={siteWithThree()}
        pageSlug="acasa"
        onMove={() => {}}
        onRemove={onRemove}
        onAddBlock={() => {}}
      />,
    );
    const remove = container.querySelectorAll('[data-testid="block-remove"]')[1] as
      | HTMLButtonElement
      | undefined;
    if (remove !== undefined) {
      fireEvent.click(remove);
    }
    expect(onRemove).toHaveBeenCalledWith("blk_b");
  });

  test("'Add Block' button calls onAddBlock", () => {
    const onAddBlock = vi.fn();
    const { container } = render(
      <BlockListEditor
        site={siteWithThree()}
        pageSlug="acasa"
        onMove={() => {}}
        onRemove={() => {}}
        onAddBlock={onAddBlock}
      />,
    );
    const add = container.querySelector('[data-testid="block-add"]') as HTMLButtonElement | null;
    expect(add).not.toBeNull();
    if (add !== null) {
      fireEvent.click(add);
    }
    expect(onAddBlock).toHaveBeenCalledTimes(1);
  });

  test("simulated drag-drop from row 0 to row 2 calls onMove(0, 2)", () => {
    const onMove = vi.fn();
    const { container } = render(
      <BlockListEditor
        site={siteWithThree()}
        pageSlug="acasa"
        onMove={onMove}
        onRemove={() => {}}
        onAddBlock={() => {}}
      />,
    );
    const rows = container.querySelectorAll('[data-testid="block-row"]');
    const sourceHandle = rows[0]?.querySelector(
      '[data-testid="block-drag-handle"]',
    ) as HTMLElement | null;
    const target = rows[2] as HTMLElement | undefined;
    expect(sourceHandle).not.toBeNull();
    expect(target).not.toBeUndefined();
    if (sourceHandle === null || target === undefined) return;

    // jsdom's DataTransfer is best-effort. Use a plain object to track the
    // drag's payload.
    const dataTransfer: Record<string, string> = {};
    fireEvent.dragStart(sourceHandle, {
      dataTransfer: {
        setData: (k: string, v: string) => {
          dataTransfer[k] = v;
        },
        effectAllowed: "move",
      } as unknown as DataTransfer,
    });
    fireEvent.dragOver(target, {
      dataTransfer: {
        getData: (k: string) => dataTransfer[k],
      } as unknown as DataTransfer,
    });
    fireEvent.drop(target, {
      dataTransfer: {
        getData: (k: string) => dataTransfer[k],
      } as unknown as DataTransfer,
    });
    expect(onMove).toHaveBeenCalledWith(0, 2);
  });
});
