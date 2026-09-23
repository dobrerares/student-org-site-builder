import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { openFirstPage } from "./builder-helpers.js";

/**
 * Block library picker + DnD reorder + undo/redo — e2e (#27).
 *
 * The unit tests at `packages/editor-app/test/editor-app-history.test.tsx`
 * exercise the same flows in jsdom. This spec adds the binding "in a real
 * browser" check that the AC implies and walks the full picker → reorder
 * → undo → redo loop using real DOM events.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const fixturePath = path.join(
  repoRoot,
  "packages",
  "editor-app",
  "test",
  "fixtures",
  "minimal-site.json",
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;

async function bundleForBrowser(): Promise<string> {
  const entryPath = path.join(__dirname, "editor-app.entry.tsx");
  const result = await esbuild({
    entryPoints: [entryPath],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    jsxImportSource: "preact",
    absWorkingDir: repoRoot,
  });
  const out = result.outputFiles[0];
  if (out === undefined) throw new Error("esbuild produced no browser output");
  return out.text;
}

async function mountEditor(
  page: import("@playwright/test").Page,
  viewport: { width: number; height: number } = { width: 1200, height: 900 },
): Promise<void> {
  const bundle = await bundleForBrowser();
  await page.setViewportSize(viewport);
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate((siteData) => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbEditor.mount(siteData as never, root);
  }, fixture);
  // Blocks live in a page's workspace (issue #102); the builder opens on the
  // Overview.
  await openFirstPage(page);
}

test("the Add Block dialog opens and lists at least the hero block", async ({ page }) => {
  await mountEditor(page);

  await expect(page.getByTestId("add-block-dialog")).toHaveCount(0);
  await page.getByTestId("block-add").click();
  await expect(page.getByTestId("add-block-dialog")).toBeVisible();

  // The dialog must list at least the `hero` entry (today's only known block).
  const heroEntry = page.locator('[data-testid="add-block-entry"][data-block-type="hero"]');
  await expect(heroEntry).toBeVisible();
  await expect(page.getByTestId("add-block-search")).toBeVisible();
});

/**
 * Narrow viewports dock the dialog to the bottom of the screen rather than
 * centring it — a thumb reaches the bottom of a phone, not the middle.
 *
 * This used to fall out of the backdrop being a grid container with
 * `align-items: end`. Since the dialog moved onto Base UI the popup is a
 * sibling of the backdrop and positions itself, so the behaviour is now
 * stated explicitly in the editor stylesheet and needs a test that would
 * notice it disappearing again.
 */
test("at a phone viewport the Add Block dialog docks to the bottom of the screen", async ({
  page,
}) => {
  await mountEditor(page, { width: 390, height: 780 });

  await page.getByTestId("block-add").click();
  const dialog = page.getByTestId("add-block-dialog");
  await expect(dialog).toBeVisible();

  const box = (await dialog.boundingBox())!;
  const viewport = page.viewportSize()!;

  // Bottom-docked: its lower edge sits near the bottom of the viewport, and
  // it does not float in the vertical middle.
  expect(viewport.height - (box.y + box.height)).toBeLessThanOrEqual(24);
  expect(box.y + box.height).toBeGreaterThan(viewport.height * 0.75);

  // Full-bleed apart from a small gutter, rather than a centred card.
  expect(box.x).toBeLessThanOrEqual(24);
  expect(box.width).toBeGreaterThan(viewport.width - 48);

  // And it is actually on screen — the Tailwind centring translate must be
  // cancelled, or the sheet hangs half its height below the fold.
  expect(box.y).toBeGreaterThanOrEqual(0);
});

test("at a desktop viewport the Add Block dialog is centred", async ({ page }) => {
  await mountEditor(page, { width: 1200, height: 900 });

  await page.getByTestId("block-add").click();
  const dialog = page.getByTestId("add-block-dialog");
  await expect(dialog).toBeVisible();
  // The pop-in animation ends on an 8px vertical offset; measure after it
  // settles or the assertion is a race.
  await dialog.evaluate(async (el) => {
    await Promise.all(el.getAnimations().map((animation) => animation.finished));
  });

  const box = (await dialog.boundingBox())!;
  const viewport = page.viewportSize()!;

  const centreX = box.x + box.width / 2;
  const centreY = box.y + box.height / 2;
  expect(Math.abs(centreX - viewport.width / 2)).toBeLessThanOrEqual(2);
  expect(Math.abs(centreY - viewport.height / 2)).toBeLessThanOrEqual(2);
});

test("picking a block from the dialog appends a row and closes the picker", async ({ page }) => {
  await mountEditor(page);

  const initialRows = await page.getByTestId("block-row").count();
  await page.getByTestId("block-add").click();
  await page.locator('[data-testid="add-block-entry"][data-block-type="hero"]').click();

  await expect(page.getByTestId("add-block-dialog")).toHaveCount(0);
  await expect(page.getByTestId("block-row")).toHaveCount(initialRows + 1);
});

test("'move down' on the first row reorders blocks and Ctrl+Z undoes the move", async ({
  page,
}) => {
  await mountEditor(page);

  // Seed the page with two blocks so reorder is meaningful.
  await page.getByTestId("block-add").click();
  await page.locator('[data-testid="add-block-entry"][data-block-type="hero"]').click();

  // Now there should be 2 blocks (the fixture starts with 1).
  await expect(page.getByTestId("block-row")).toHaveCount(2);
  const idsBefore = await page
    .getByTestId("block-row")
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-block-id")));

  // Click move-down on the first row.
  await page.getByTestId("block-row").first().locator('[data-testid="block-move-down"]').click();

  const idsAfter = await page
    .getByTestId("block-row")
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-block-id")));
  expect(idsAfter).toEqual([idsBefore[1], idsBefore[0]]);

  // Ctrl+Z to undo the reorder.
  await page.keyboard.press("Control+z");
  const idsUndone = await page
    .getByTestId("block-row")
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-block-id")));
  expect(idsUndone).toEqual(idsBefore);
});

test("HTML5 drag-and-drop from row 0 to row 1 reorders blocks", async ({ page }) => {
  await mountEditor(page);
  // Add a second block so we have something to drag past.
  await page.getByTestId("block-add").click();
  await page.locator('[data-testid="add-block-entry"][data-block-type="hero"]').click();
  await expect(page.getByTestId("block-row")).toHaveCount(2);

  const idsBefore = await page
    .getByTestId("block-row")
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-block-id")));

  const sourceHandle = page
    .getByTestId("block-row")
    .first()
    .locator('[data-testid="block-drag-handle"]');
  const target = page.getByTestId("block-row").nth(1);
  await sourceHandle.dragTo(target);

  const idsAfter = await page
    .getByTestId("block-row")
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-block-id")));
  expect(idsAfter).toEqual([idsBefore[1], idsBefore[0]]);
});
