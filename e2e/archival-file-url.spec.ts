import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import { runArchivalBuild } from "../packages/browser-shell/scripts/run-archival-build.js";

/**
 * AC #4 — archival HTML opens and runs in Chromium / Firefox / Safari from
 * `file://`. We test Chromium here (matching the project's Playwright
 * config); Firefox/Safari smoke tests are on the manual QA checklist.
 *
 * Strategy: build the archival HTML, load it via `file://`, and assert the
 * editor's two-pane layout renders. If the bundle had broken under
 * `file://` constraints (eg. fetched a sibling JS file instead of inlining
 * it), the layout selectors would not appear.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const archivalOutDir = path.join(repoRoot, "packages", "browser-shell", "dist", "archival");
const archivalHtml = path.join(archivalOutDir, "builder.html");

test.beforeAll(async () => {
  // Ensure the archival HTML exists. We run the same `runArchivalBuild`
  // CLI the user runs via `pnpm build:archival`.
  if (!existsSync(archivalHtml)) {
    await runArchivalBuild({ outDir: archivalOutDir });
  }
});

test("the archival HTML loads from file:// and opens the editor's two-pane layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 900 });

  // file:// URL — the binding test. Any reference that the bundle didn't
  // inline (a sibling .js, a sibling .css) would 404 under file://.
  const fileUrl = pathToFileURL(archivalHtml).href;
  await page.goto(fileUrl);

  await expect(page.getByTestId("welcome-screen")).toBeVisible();
  await page.getByTestId("welcome-action-blank").click();

  await expect(page.getByTestId("editor-pane")).toBeVisible();
  await expect(page.getByTestId("preview-pane")).toBeVisible();
  await expect(page.getByTestId("top-bar")).toBeVisible();
});

test("the archival HTML's <head> declares no external script src", async () => {
  const html = readFileSync(archivalHtml, "utf8");
  // Allow data: URIs, allow https://, but no relative/absolute path script
  // refs are allowed — the binding test for "self-contained".
  const localScriptRef = /<script[^>]+\bsrc=["'](?!data:|https?:|\/\/)[^"']+["']/i;
  expect(html).not.toMatch(localScriptRef);
});
