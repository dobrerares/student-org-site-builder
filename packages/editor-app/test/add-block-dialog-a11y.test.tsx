/** @jsxImportSource react */
// @vitest-environment jsdom
/**
 * Accessibility regression: the AddBlockDialog and BlockListEditor produce
 * zero axe-core violations on the rules that matter at this layer.
 *
 * The axe configuration (contrast off, Base UI focus guards excluded) lives
 * in `./helpers/axe.ts` so every editor a11y suite audits the same thing.
 * Structural rules — landmarks, labels, button accessibility, ARIA,
 * keyboard reach — DO run here.
 */
import { describe, test, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { Site } from "@sosb/schema";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { expectNoAxeViolations } from "./helpers/axe.js";
import { AddBlockDialog } from "../src/add-block-dialog.js";
import { BlockListEditor } from "../src/block-list-editor.js";

const baseSite = minimal as unknown as Site;

afterEach(() => cleanup());

describe("AddBlockDialog axe-core accessibility", () => {
  test("the open dialog has zero axe violations", async () => {
    const { container } = render(
      <AddBlockDialog open={true} onPick={() => {}} onClose={() => {}} />,
    );
    await expectNoAxeViolations(container);
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
    await expectNoAxeViolations(container);
  });
});
