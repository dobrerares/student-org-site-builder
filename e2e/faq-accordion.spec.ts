import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * FAQ accordion — end-to-end (binding AC for #18).
 *
 * The block ships native `<details>`/`<summary>` markup that works without
 * JS, plus a small (≤2 kb minified) vanilla-JS enhancement for smooth
 * open/close transitions and idempotent re-runs. This e2e exercises the
 * full path in a real headless Chromium:
 *
 *  1. Bundle the renderer (and `FAQ_ACCORDION_SCRIPT_SOURCE` constant) for
 *     the browser via esbuild.
 *  2. Render the FAQ fixture into a real page.
 *  3. Inject the enhancement script.
 *  4. Click each summary; assert the open state toggles.
 *  5. Re-inject the script; assert the sentinel attribute does not change
 *     and clicks still toggle (idempotency contract).
 *
 * The renderer-parity spec (`renderer-parity.spec.ts`) already proves
 * Node ≡ browser byte-equality on the FAQ fixture indirectly (it shares
 * the renderer). This file is concerned with the *interactive* contract.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const fixturePath = path.join(
  repoRoot,
  "packages",
  "renderer",
  "test",
  "fixtures",
  "faq-only.json",
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;

interface RendererModule {
  renderSite: (data: unknown, themeId: string) => string;
  FAQ_ACCORDION_SCRIPT_SOURCE: string;
}

async function bundleRendererForBrowser(): Promise<string> {
  const entryPath = path.join(__dirname, "renderer-parity.entry.ts");
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

test("FAQ accordion: clicking a summary toggles its details element open/closed", async ({
  page,
}) => {
  const browserBundle = await bundleRendererForBrowser();

  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ type: "module", content: browserBundle });

  const [renderedHtml, scriptSource] = await page.evaluate((siteData) => {
    const w = window as unknown as { __sosbRenderer: RendererModule };
    return [
      w.__sosbRenderer.renderSite(siteData, "stub"),
      w.__sosbRenderer.FAQ_ACCORDION_SCRIPT_SOURCE,
    ] as const;
  }, fixture);
  // Replace the page content with the rendered FAQ document, then inject
  // the enhancement script so it runs in document context.
  await page.setContent(renderedHtml);
  await page.addScriptTag({ content: scriptSource });

  // Native <details> work without JS too; assert the firstOpen=true item is
  // open, the rest closed.
  const itemCount = await page.locator(".faq__item").count();
  expect(itemCount).toBe(3);

  const firstOpenInitial = await page.locator(".faq__item").nth(0).evaluate(
    (el) => (el as HTMLDetailsElement).open,
  );
  expect(firstOpenInitial).toBe(true);

  const secondOpenInitial = await page.locator(".faq__item").nth(1).evaluate(
    (el) => (el as HTMLDetailsElement).open,
  );
  expect(secondOpenInitial).toBe(false);

  // Click the second summary; the details should open.
  await page.locator(".faq__item").nth(1).locator("summary").click();
  await page.waitForFunction(
    () =>
      (document.querySelectorAll(".faq__item")[1] as HTMLDetailsElement).open === true,
    null,
    { timeout: 1000 },
  );
  const secondOpenAfter = await page.locator(".faq__item").nth(1).evaluate(
    (el) => (el as HTMLDetailsElement).open,
  );
  expect(secondOpenAfter).toBe(true);

  // The first item starts open; click it to close.
  await page.locator(".faq__item").nth(0).locator("summary").click();
  await page.waitForFunction(
    () =>
      (document.querySelectorAll(".faq__item")[0] as HTMLDetailsElement).open === false,
    null,
    { timeout: 1000 },
  );
  const firstOpenAfter = await page.locator(".faq__item").nth(0).evaluate(
    (el) => (el as HTMLDetailsElement).open,
  );
  expect(firstOpenAfter).toBe(false);
});

test("FAQ accordion: each item carries the data-faq-enhanced sentinel after script runs", async ({
  page,
}) => {
  const browserBundle = await bundleRendererForBrowser();
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ type: "module", content: browserBundle });

  const [renderedHtml, scriptSource] = await page.evaluate((siteData) => {
    const w = window as unknown as { __sosbRenderer: RendererModule };
    return [
      w.__sosbRenderer.renderSite(siteData, "stub"),
      w.__sosbRenderer.FAQ_ACCORDION_SCRIPT_SOURCE,
    ] as const;
  }, fixture);
  await page.setContent(renderedHtml);
  await page.addScriptTag({ content: scriptSource });

  const sentinels = await page
    .locator(".faq__item")
    .evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).getAttribute("data-faq-enhanced")),
    );
  expect(sentinels).toEqual(["1", "1", "1"]);

  // Re-inject the script; sentinel should remain "1" and click should still
  // toggle. This is the idempotency contract.
  await page.addScriptTag({ content: scriptSource });
  const sentinelsAgain = await page
    .locator(".faq__item")
    .evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).getAttribute("data-faq-enhanced")),
    );
  expect(sentinelsAgain).toEqual(["1", "1", "1"]);

  // Click still toggles after re-injection.
  await page.locator(".faq__item").nth(2).locator("summary").click();
  await page.waitForFunction(
    () =>
      (document.querySelectorAll(".faq__item")[2] as HTMLDetailsElement).open === true,
    null,
    { timeout: 1000 },
  );
});

test("FAQ accordion: keyboard activation (Enter/Space on summary) toggles", async ({ page }) => {
  const browserBundle = await bundleRendererForBrowser();
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ type: "module", content: browserBundle });

  const [renderedHtml, scriptSource] = await page.evaluate((siteData) => {
    const w = window as unknown as { __sosbRenderer: RendererModule };
    return [
      w.__sosbRenderer.renderSite(siteData, "stub"),
      w.__sosbRenderer.FAQ_ACCORDION_SCRIPT_SOURCE,
    ] as const;
  }, fixture);
  await page.setContent(renderedHtml);
  await page.addScriptTag({ content: scriptSource });

  // Focus the second summary via Tab navigation; first details is open with
  // its summary in the tab order, second's summary follows.
  const secondSummary = page.locator(".faq__item").nth(1).locator("summary");
  await secondSummary.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () =>
      (document.querySelectorAll(".faq__item")[1] as HTMLDetailsElement).open === true,
    null,
    { timeout: 1000 },
  );
  const open = await page
    .locator(".faq__item")
    .nth(1)
    .evaluate((el) => (el as HTMLDetailsElement).open);
  expect(open).toBe(true);
});
