import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Editor-app shell — desktop two-pane and mobile tabs (binding ACs).
 *
 * These specs render the real `<EditorApp>` Preact component into a real
 * headless Chromium page at two viewport widths and assert the structural
 * shape of the rendered DOM. The unit tests under
 * `packages/editor-app/test/layout.test.tsx` cover the same logic against
 * jsdom; this e2e adds the binding "in a real browser" check that the AC
 * implies.
 *
 * Strategy: bundle the editor-app entry for the browser via esbuild and
 * inject the bundle into the page. The page's html sets the viewport via
 * the playwright `setViewportSize` API; the editor reads `window.innerWidth`
 * to pick its layout.
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

test("at 1200px viewport, the editor renders the two-pane layout", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const bundle = await bundleForBrowser();

  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate((siteData) => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbEditor.mount(siteData as never, root);
  }, fixture);

  await expect(page.getByTestId("editor-pane")).toBeVisible();
  await expect(page.getByTestId("preview-pane")).toBeVisible();
  await expect(page.getByTestId("layout-tabs")).toHaveCount(0);

  // Top bar is always present.
  await expect(page.getByTestId("top-bar")).toBeVisible();
  await expect(page.locator('[data-action="import"]')).toBeVisible();
  await expect(page.locator('[data-action="export"]')).toBeVisible();
  await expect(page.locator('[data-action="reset"]')).toBeVisible();
});

test("at 600px viewport, the editor renders Editor | Preview tabs", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  const bundle = await bundleForBrowser();

  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate((siteData) => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbEditor.mount(siteData as never, root);
  }, fixture);

  await expect(page.getByTestId("layout-tabs")).toBeVisible();
  const tabs = page.getByTestId("layout-tab");
  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(0)).toHaveText("Editor");
  await expect(tabs.nth(1)).toHaveText("Preview");
});

test("the iframe preview's srcdoc is a complete HTML document with the org name", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const bundle = await bundleForBrowser();

  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate((siteData) => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbEditor.mount(siteData as never, root);
  }, fixture);

  const srcdoc = await page.locator('[data-testid="preview-pane"] iframe').getAttribute("srcdoc");
  expect(srcdoc).not.toBeNull();
  expect(srcdoc!.startsWith("<!doctype html>")).toBe(true);
  // Expect the fixture's org name to round-trip into the rendered preview.
  expect(srcdoc!).toContain("Stub Org");
});
