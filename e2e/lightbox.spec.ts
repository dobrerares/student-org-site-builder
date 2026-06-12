import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);

/**
 * Real-Chromium e2e for the imageGallery lightbox (issue #14).
 *
 * The vitest+jsdom suite (`packages/renderer/test/lightbox-jsdom.test.ts`)
 * covers the keyboard / focus-trap behaviour deterministically; this spec
 * verifies the same flow in real Chromium where the AC's "axe-core clean
 * in open state" is testable with computed styles, real focus-visibility,
 * and real layout. JSDOM cannot honour those.
 *
 * Mirrors `renderer-parity.spec.ts`: bundle the renderer for Node, render
 * the fixture HTML, set it on the page, then drive interactions.
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
  "image-gallery-only.json",
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;

interface RendererModule {
  renderSite: (data: unknown, themeId: string) => string;
}

async function bundleForNode(): Promise<RendererModule> {
  const entryPath = path.join(repoRoot, "packages", "renderer", "src", "index.tsx");
  const tmpDir = path.join(
    repoRoot,
    "packages",
    "renderer",
    "node_modules",
    ".cache",
    "sosb-renderer-lightbox",
  );
  mkdirSync(tmpDir, { recursive: true });
  const outFile = path.join(tmpDir, `renderer-${process.pid}-${Date.now()}.cjs`);
  const result = await build({
    entryPoints: [entryPath],
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
    target: "es2022",
    jsx: "automatic",
    jsxImportSource: "preact",
    absWorkingDir: repoRoot,
    external: ["jsdom"],
  });
  const out = result.outputFiles[0];
  if (out === undefined) throw new Error("esbuild produced no node output");
  writeFileSync(outFile, out.text);
  return require(outFile) as RendererModule;
}

test.describe("imageGallery lightbox — real-browser behaviour", () => {
  test("clicking a trigger opens the dialog with the correct image", async ({ page }) => {
    const renderer = await bundleForNode();
    const html = renderer.renderSite(fixture, "stub");
    await page.setContent(html, { waitUntil: "load" });

    // The closed dialog is hidden.
    await expect(page.locator("[data-sosb-lightbox]")).toBeHidden();

    await page.locator("[data-sosb-lightbox-open]").first().click();

    await expect(page.locator("[data-sosb-lightbox]")).toBeVisible();
    const dialogImg = page.locator("[data-sosb-lightbox] img");
    await expect(dialogImg).toHaveAttribute("src", "assets/8e3a7f9b1c0d2e4f.jpg");
    await expect(dialogImg).toHaveAttribute("alt", "Studenți la o conferință de toamnă");
  });

  test("Escape closes the dialog and returns focus to the trigger", async ({ page }) => {
    const renderer = await bundleForNode();
    const html = renderer.renderSite(fixture, "stub");
    await page.setContent(html, { waitUntil: "load" });

    const firstTrigger = page.locator("[data-sosb-lightbox-open]").first();
    await firstTrigger.focus();
    await firstTrigger.click();

    await expect(page.locator("[data-sosb-lightbox]")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("[data-sosb-lightbox]")).toBeHidden();
    await expect(firstTrigger).toBeFocused();
  });

  test("ArrowRight navigates to the next image and wraps", async ({ page }) => {
    const renderer = await bundleForNode();
    const html = renderer.renderSite(fixture, "stub");
    await page.setContent(html, { waitUntil: "load" });

    await page.locator("[data-sosb-lightbox-open]").first().click();
    const dialogImg = page.locator("[data-sosb-lightbox] img");
    await expect(dialogImg).toHaveAttribute("alt", "Studenți la o conferință de toamnă");

    await page.keyboard.press("ArrowRight");
    await expect(dialogImg).toHaveAttribute("alt", "Diacritic test: ăîâșț");

    await page.keyboard.press("ArrowRight");
    await expect(dialogImg).toHaveAttribute("alt", "Studenți la o conferință de toamnă");
  });

  test("axe-core scan of the open lightbox produces zero violations", async ({ page }) => {
    const renderer = await bundleForNode();
    const html = renderer.renderSite(fixture, "stub");
    await page.setContent(html, { waitUntil: "load" });

    await page.locator("[data-sosb-lightbox-open]").first().click();
    await expect(page.locator("[data-sosb-lightbox]")).toBeVisible();

    // Inject axe-core from its UMD bundle into the page and run a scan.
    // axe-core is a workspace dep of @sosb/renderer; resolve relative to its
    // package.json so module resolution finds the dependency.
    const axePath = require.resolve("axe-core/axe.min.js", {
      paths: [path.join(repoRoot, "packages", "renderer")],
    });
    await page.addScriptTag({ path: axePath });

    interface AxeRunResult {
      violations: { id: string; nodes: unknown[] }[];
    }
    const result = await page.evaluate(async () => {
      const w = window as unknown as {
        axe: { run: (ctx?: unknown, opts?: unknown) => Promise<unknown> };
      };
      return (await w.axe.run(document, {
        rules: { "color-contrast": { enabled: false } },
      })) as AxeRunResult;
    });

    expect(result.violations).toEqual([]);
  });
});
