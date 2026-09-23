import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { openFirstPage } from "./builder-helpers.js";

/**
 * Editor-app shell — desktop split view and the phone Edit / Preview switch
 * (binding ACs, updated for issue #102).
 *
 * These specs render the real `<EditorApp>` React component into a real
 * headless Chromium page at two viewport widths and assert the structural
 * shape of the rendered DOM. The builder opens into the content Overview,
 * so each spec opens the first page before looking for a workspace. The unit tests under
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

test("at 1200px viewport, a page opens into the side-by-side split view", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const bundle = await bundleForBrowser();

  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate((siteData) => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbEditor.mount(siteData as never, root);
  }, fixture);

  // The Site opens into the content Overview with the navigation rail.
  await expect(page.getByTestId("overview")).toBeVisible();
  await expect(page.getByTestId("main-nav")).toBeVisible();

  await openFirstPage(page);
  await expect(page.getByTestId("editor-pane")).toBeVisible();
  await expect(page.getByTestId("preview-pane")).toBeVisible();
  await expect(page.getByTestId("layout-tabs")).toHaveCount(0);

  // Top bar is always present.
  await expect(page.getByTestId("top-bar")).toBeVisible();
  await expect(page.locator('[data-action="import"]')).toBeVisible();
  await expect(page.locator('[data-action="export"]')).toBeVisible();
  await expect(page.locator('[data-action="reset"]')).toBeVisible();
});

test("at 600px viewport, a page shows editing and preview one at a time", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  const bundle = await bundleForBrowser();

  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate((siteData) => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbEditor.mount(siteData as never, root);
  }, fixture);

  // The navigation is a drawer at this width; the helper opens it.
  await expect(page.getByTestId("main-nav")).toBeHidden();
  await openFirstPage(page);

  await expect(page.getByTestId("layout-tabs")).toBeVisible();
  await expect(page.getByTestId("workspace-tab-edit")).toHaveText("Edit");
  await expect(page.getByTestId("workspace-tab-preview")).toHaveText("Preview");
  await expect(page.getByTestId("editor-pane")).toBeVisible();
  await expect(page.getByTestId("preview-pane")).toBeHidden();

  await page.getByTestId("workspace-tab-preview").click();
  await expect(page.getByTestId("preview-pane")).toBeVisible();
  await expect(page.getByTestId("editor-pane")).toBeHidden();
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
  await openFirstPage(page);

  const srcdoc = await page.locator('[data-testid="preview-pane"] iframe').getAttribute("srcdoc");
  expect(srcdoc).not.toBeNull();
  expect(srcdoc!.startsWith("<!doctype html>")).toBe(true);
  // Expect the fixture's org name to round-trip into the rendered preview.
  expect(srcdoc!).toContain("Stub Org");
  // `allow-popups` lets the preview's link interceptor open an external link
  // in a new tab instead of navigating the preview away from the editor.
  await expect(page.locator('[data-testid="preview-pane"] iframe')).toHaveAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-popups",
  );
});

test("clicking preview nav moves the preview like the public site and offers Edit this Page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const bundle = await bundleForBrowser();
  const twoPageFixture = structuredClone(fixture);
  twoPageFixture.pages = [
    ...((twoPageFixture.pages as Record<string, unknown>[]) ?? []),
    {
      slug: "despre",
      lang: "ro",
      navLabel: "Despre",
      navOrder: 1,
      showInNav: true,
      blocks: [
        {
          id: "blk_about_hero",
          type: "hero",
          version: 1,
          data: { title: "About page" },
        },
      ],
    },
  ];

  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate((siteData) => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbEditor.mount(siteData as never, root);
  }, twoPageFixture);
  await openFirstPage(page);

  const frame = page.frameLocator('[data-testid="preview-pane"] iframe');
  const aboutLink = frame.getByRole("link", { name: "Despre", exact: true });
  await expect(aboutLink).toHaveCount(1);
  await aboutLink.click();

  // The preview follows the link (issue #102: preview clicks behave like the
  // public website)…
  await expect(page.getByTestId("preview-target-title")).toHaveText("Despre");
  const srcdoc = await page.locator('[data-testid="preview-pane"] iframe').getAttribute("srcdoc");
  expect(srcdoc).toContain("About page");
  // …while the editing pane stays on the page being edited, with a way back.
  await expect(page.getByTestId("workspace-title")).toHaveValue("Acasă");
  await expect(page.getByTestId("preview-return")).toBeVisible();

  // "Edit this Page" makes the previewed page the edited one.
  await page.getByTestId("preview-edit-this").click();
  await expect(page.getByTestId("workspace-title")).toHaveValue("Despre");
  await expect(page.getByTestId("preview-return")).toHaveCount(0);
});

test("preview viewport controls resize the iframe shell", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const bundle = await bundleForBrowser();

  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate((siteData) => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbEditor.mount(siteData as never, root);
  }, fixture);
  await openFirstPage(page);

  const frame = page.getByTestId("preview-frame-shell");
  await expect(frame).toHaveAttribute("data-preview-viewport", "fit");

  await page.locator('[data-testid="viewport-preview-option"][data-viewport="phone"]').click();
  await expect(frame).toHaveAttribute("data-preview-viewport", "phone");

  // The frame is LAID OUT at the true phone viewport, so the previewed page
  // resolves its media queries against 390x844 like a real phone would…
  expect(await frame.evaluate((el) => el.offsetWidth)).toBe(390);
  expect(await frame.evaluate((el) => el.offsetHeight)).toBe(844);

  // …and is then scaled down to fit the pane. Its on-screen box is therefore
  // smaller than its layout size and never overflows the canvas — which is
  // exactly what the unscaled 1440px desktop preset used to do.
  const box = await frame.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(390);
  expect(box!.height).toBeLessThanOrEqual(844);

  const canvas = await page.getByTestId("preview-canvas").boundingBox();
  expect(canvas).not.toBeNull();
  expect(box!.height).toBeLessThanOrEqual(canvas!.height + 1);

  // Aspect ratio is preserved — a uniform scale, not a squash.
  expect(box!.width / box!.height).toBeCloseTo(390 / 844, 2);
});

test("the desktop preset fits inside the preview pane instead of overflowing", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const bundle = await bundleForBrowser();

  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate((siteData) => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbEditor.mount(siteData as never, root);
  }, fixture);
  await openFirstPage(page);

  await page.locator('[data-testid="viewport-preview-option"][data-viewport="desktop"]').click();
  const frame = page.getByTestId("preview-frame-shell");
  await expect(frame).toHaveAttribute("data-preview-viewport", "desktop");

  // 1440 CSS pixels of layout in a pane far narrower than that.
  expect(await frame.evaluate((el) => el.offsetWidth)).toBe(1440);

  const box = (await frame.boundingBox())!;
  const canvas = (await page.getByTestId("preview-canvas").boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(canvas.width + 1);
});
