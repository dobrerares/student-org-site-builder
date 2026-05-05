// @vitest-environment jsdom
/**
 * Accessibility regression: the AddBlockDialog and BlockListEditor produce
 * zero axe-core violations on the rules that matter at this layer.
 *
 * Visual contrast is intentionally disabled here (jsdom doesn't compute
 * styles, so contrast checks are unreliable; the renderer's accessibility
 * test follows the same convention). Structural a11y rules — landmarks,
 * labels, button accessibility, ARIA, keyboard reach — DO run here.
 */
import { describe, expect, test, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/preact";
import axe from "axe-core";
import type { Site } from "@sosb/schema";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { AddBlockDialog } from "../src/add-block-dialog.js";
import { BlockListEditor } from "../src/block-list-editor.js";

const baseSite = minimal as unknown as Site;

afterEach(() => cleanup());

async function runAxe(node: HTMLElement): Promise<axe.AxeResults> {
  return axe.run(node, {
    rules: {
      "color-contrast": { enabled: false },
    },
  });
}

describe("AddBlockDialog axe-core accessibility", () => {
  test("the open dialog has zero axe violations", async () => {
    const { container } = render(
      <AddBlockDialog open={true} onPick={() => {}} onClose={() => {}} />,
    );
    const results = await runAxe(container as HTMLElement);
    expect(results.violations).toEqual([]);
  });
});

describe("BlockListEditor axe-core accessibility", () => {
  test("a populated block list has zero axe violations", async () => {
    const site = structuredClone(baseSite);
    const page = site.pages[0];
    if (page === undefined) throw new Error("fixture missing first page");
    page.blocks = [
      { id: "blk_a", type: "hero", version: 1, data: { title: "A" } },
      { id: "blk_b", type: "hero", version: 1, data: { title: "B" } },
    ];
    const { container } = render(
      <BlockListEditor
        site={site}
        pageSlug={page.slug}
        onMove={() => {}}
        onRemove={() => {}}
        onAddBlock={() => {}}
      />,
    );
    const results = await runAxe(container as HTMLElement);
    expect(results.violations).toEqual([]);
  });
});
