import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Page } from "@playwright/test";

import { openFirstPage, openSection } from "./builder-helpers.js";

/**
 * Documentation screenshots for the builder redesign (issue #102). Not a
 * regression test: it writes PNGs under docs/screenshots/builder-redesign/,
 * so it only runs on demand:
 *
 *     SOSB_SCREENSHOTS=1 pnpm exec playwright test docs-screenshots.spec.ts
 *
 * Re-run it whenever the shell's look changes and commit the images with
 * the change, so the PR shows what actually shipped.
 */
test.skip(process.env["SOSB_SCREENSHOTS"] !== "1", "docs screenshots run only on demand");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "docs", "screenshots", "builder-redesign");

async function bundleForBrowser(): Promise<string> {
  const result = await esbuild({
    entryPoints: [path.join(__dirname, "screenshots.entry.tsx")],
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

async function mount(page: Page, viewport: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(viewport);
  const bundle = await bundleForBrowser();
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate(() => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbShots.mount(root);
  });
  await expect(page.getByTestId("editor-app")).toBeVisible();
  // Let the Inter @font-face rules and the preview boot settle.
  await page.waitForTimeout(600);
}

async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
}

async function createArticle(
  page: Page,
  title: string,
  state: "published" | "draft",
): Promise<void> {
  await openSection(page, "articles");
  await page.getByTestId("articles-create").click();
  await expect(page.getByTestId("workspace")).toBeVisible();
  await page.getByTestId("workspace-title").fill(title);
  if (state === "published") await page.getByTestId("workspace-state-published").click();
  await page.getByTestId("block-row-select").first().click();
  await page
    .locator('[data-testid="inspector"] textarea')
    .first()
    .fill(
      "Peste **200 de studenți** au participat la gala de final de an. Mulțumim tuturor voluntarilor!\n\n## Ce urmează\n\nÎn octombrie deschidem înscrierile pentru noul an.",
    );
  await page.getByTestId("drill-back").click();
}

test("desktop screenshots", async ({ page }) => {
  await mount(page, { width: 1280, height: 800 });

  await shot(page, "overview");

  await openFirstPage(page);
  await page.getByTestId("block-row-select").first().click();
  await expect(page.getByTestId("inspector")).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, "page-workspace-inspector");

  await createArticle(page, "Gala de final de an", "published");
  await createArticle(page, "Înscrieri pentru noul an", "draft");
  await openSection(page, "articles");
  await page.waitForTimeout(200);
  await shot(page, "articles-list");

  await page.getByTestId("article-open-art_1").click();
  await page.getByTestId("workspace-settings-link").click();
  await expect(page.getByTestId("article-settings-form")).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, "article-settings");

  await page.locator('[data-action="export"]').click();
  await expect(page.getByTestId("export-readiness")).toBeVisible();
  await page.waitForTimeout(200);
  await shot(page, "export-readiness");
  await page.getByTestId("export-cancel-button").click();

  await openSection(page, "theme");
  await page.waitForTimeout(400);
  await shot(page, "theme");
});

test("phone screenshots", async ({ page }) => {
  await mount(page, { width: 390, height: 844 });
  await shot(page, "phone-overview");

  await page.getByTestId("nav-drawer-open").click();
  await expect(page.getByTestId("main-nav")).toBeVisible();
  await shot(page, "phone-nav-drawer");
  await page.getByTestId("nav-drawer-close").click();

  await openFirstPage(page);
  await page.waitForTimeout(300);
  await shot(page, "phone-workspace-edit");

  await page.getByTestId("workspace-tab-preview").click();
  await page.waitForTimeout(400);
  await shot(page, "phone-workspace-preview");

  await page.getByTestId("workspace-tab-edit").click();
  await page.getByTestId("block-row-select").first().click();
  await expect(page.getByTestId("inspector")).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, "phone-inspector");
});
