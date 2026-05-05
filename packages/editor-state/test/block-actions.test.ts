/**
 * Tests for block-list manipulation helpers used by the editor's block list
 * UI. Each helper returns a *new* site with the requested change so the
 * caller can hand it straight to the history store.
 *
 * Owned by issue #27.
 */
import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { addBlockToPage, moveBlockInPage, removeBlockFromPage } from "../src/index.js";

const baseSite = minimal as unknown as Site;

function clone(site: Site): Site {
  return structuredClone(site);
}

describe("addBlockToPage", () => {
  test("appends a block to the page's block list and returns a new site", () => {
    const original = clone(baseSite);
    const block = {
      id: "blk_new",
      type: "hero",
      version: 1,
      data: { title: "New" },
    };

    const next = addBlockToPage(original, "acasa", block);

    expect(next).not.toBe(original);
    expect(original.pages[0]?.blocks.length).toBe(1);
    expect(next.pages[0]?.blocks.length).toBe(2);
    expect(next.pages[0]?.blocks[1]).toEqual(block);
  });

  test("throws when the page slug is unknown", () => {
    const original = clone(baseSite);
    expect(() =>
      addBlockToPage(original, "no-such-page", {
        id: "x",
        type: "hero",
        version: 1,
        data: { title: "x" },
      }),
    ).toThrow(/no-such-page/);
  });
});

describe("removeBlockFromPage", () => {
  test("removes the block matching the id and returns a new site", () => {
    const original = clone(baseSite);

    const next = removeBlockFromPage(original, "acasa", "blk_home_hero");

    expect(next).not.toBe(original);
    expect(original.pages[0]?.blocks.length).toBe(1);
    expect(next.pages[0]?.blocks.length).toBe(0);
  });

  test("throws when the block id is not on the page", () => {
    const original = clone(baseSite);
    expect(() => removeBlockFromPage(original, "acasa", "missing")).toThrow(/missing/);
  });
});

describe("moveBlockInPage", () => {
  function siteWithThreeBlocks(): Site {
    const site = clone(baseSite);
    const page = site.pages[0];
    if (page === undefined) throw new Error("fixture has no first page");
    page.blocks = [
      { id: "blk_a", type: "hero", version: 1, data: { title: "A" } },
      { id: "blk_b", type: "hero", version: 1, data: { title: "B" } },
      { id: "blk_c", type: "hero", version: 1, data: { title: "C" } },
    ];
    return site;
  }

  test("moves a block down by one", () => {
    const next = moveBlockInPage(siteWithThreeBlocks(), "acasa", 0, 1);
    expect(next.pages[0]?.blocks.map((b) => b.id)).toEqual(["blk_b", "blk_a", "blk_c"]);
  });

  test("moves a block up by one", () => {
    const next = moveBlockInPage(siteWithThreeBlocks(), "acasa", 2, 1);
    expect(next.pages[0]?.blocks.map((b) => b.id)).toEqual(["blk_a", "blk_c", "blk_b"]);
  });

  test("returns the same arrangement when from === to", () => {
    const original = siteWithThreeBlocks();
    const next = moveBlockInPage(original, "acasa", 1, 1);
    expect(next.pages[0]?.blocks.map((b) => b.id)).toEqual(["blk_a", "blk_b", "blk_c"]);
  });

  test("clamps a too-large `to` to the end of the array", () => {
    const next = moveBlockInPage(siteWithThreeBlocks(), "acasa", 0, 99);
    expect(next.pages[0]?.blocks.map((b) => b.id)).toEqual(["blk_b", "blk_c", "blk_a"]);
  });

  test("throws on negative or out-of-bounds `from`", () => {
    expect(() => moveBlockInPage(siteWithThreeBlocks(), "acasa", -1, 0)).toThrow();
    expect(() => moveBlockInPage(siteWithThreeBlocks(), "acasa", 99, 0)).toThrow();
  });
});
