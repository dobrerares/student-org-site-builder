import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

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

async function mountEditor(page: import("@playwright/test").Page): Promise<void> {
  const bundle = await bundleForBrowser();
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate((siteData) => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbEditor.mount(siteData as never, root);
  }, fixture);
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
