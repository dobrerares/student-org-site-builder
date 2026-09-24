#!/usr/bin/env node
/**
 * Regenerate `examples/themes/practice/screenshots/`.
 *
 * Builds the HISTORIPOL sample Site under the example Theme with the real
 * pipeline (`@sosb/theme-package` → `@sosb/build`), writes the dist folder to
 * a temporary directory, and captures the home and about pages at a desktop
 * and a phone width with headless Chromium.
 *
 *   node scripts/practice-theme-screenshots.mjs
 *
 * Set `SOSB_CHROMIUM=/path/to/chrome` to use a specific browser binary
 * (useful where the Playwright-pinned build cannot be downloaded).
 *
 * The screenshots are a picture of the *built* Site, so they show what the
 * public script does after it runs (the sticky header, the phone menu button)
 * — the editor's static preview would not.
 */
import { build as esbuild } from "esbuild";
import { chromium } from "@playwright/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exampleDir = path.join(repoRoot, "examples", "themes", "practice");
const outDir = path.join(exampleDir, "screenshots");

// A tiny runner, bundled in memory so the workspace's TypeScript can be
// imported without a TS loader. Written under packages/renderer so Node's
// resolution finds the external jsdom (see e2e/a11y.spec.ts for the reason).
const runnerSource = `
  import { readFileSync } from "node:fs";
  import { loadThemePackageFromDirectoryAsync } from "${path.join(repoRoot, "packages/theme-package/src/node.ts")}";
  import { build } from "${path.join(repoRoot, "packages/build/src/index.ts")}";
  export async function run(exampleDir, dataPath) {
    const { bundle } = await loadThemePackageFromDirectoryAsync(exampleDir);
    const site = JSON.parse(readFileSync(dataPath, "utf8"));
    site.theme = { id: bundle.id, version: bundle.version, shellVariant: "standard" };
    const hero = site.pages[0]?.blocks[0];
    if (hero && hero.type === "hero") hero.variant = "spotlight";
    const dist = build(site, { themes: [bundle], skipValidation: true });
    bundle.render?.dispose();
    return dist;
  }
`;
const stagingDir = path.join(
  repoRoot,
  "packages",
  "renderer",
  "node_modules",
  ".cache",
  "sosb-practice-screenshots",
);
mkdirSync(stagingDir, { recursive: true });
const runnerFile = path.join(stagingDir, `runner-${process.pid}.mjs`);
const bundled = await esbuild({
  stdin: { contents: runnerSource, resolveDir: repoRoot, loader: "js" },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  target: "es2022",
  jsx: "automatic",
  jsxImportSource: "preact",
  absWorkingDir: repoRoot,
  external: ["jsdom"],
});
writeFileSync(runnerFile, bundled.outputFiles[0].text);
const { run } = await import(pathToFileURL(runnerFile).href);

const dist = await run(
  exampleDir,
  path.join(
    repoRoot,
    "packages",
    "themes",
    "src",
    "templates",
    "asociatia-studenteasca-demo",
    "data.json",
  ),
);

const siteDir = mkdtempSync(path.join(tmpdir(), "sosb-practice-"));
for (const [relPath, value] of dist) {
  const target = path.join(siteDir, relPath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value);
}

const pages = [
  ["home", "index.html"],
  ["about", "despre/index.html"],
];
const viewports = [
  ["desktop", { width: 1440, height: 900 }],
  ["phone", { width: 390, height: 844 }],
];

const browser = await chromium.launch({
  ...(process.env.SOSB_CHROMIUM ? { executablePath: process.env.SOSB_CHROMIUM } : {}),
});
try {
  mkdirSync(outDir, { recursive: true });
  for (const [pageName, file] of pages) {
    for (const [viewportName, viewport] of viewports) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(path.join(siteDir, file)).href, { waitUntil: "load" });
      // Let the deferred public script run and fonts settle.
      await page.waitForTimeout(300);
      const target = path.join(outDir, `${pageName}-${viewportName}.png`);
      await page.screenshot({ path: target, fullPage: true });
      console.log(`wrote ${path.relative(repoRoot, target)}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  rmSync(siteDir, { recursive: true, force: true });
  rmSync(runnerFile, { force: true });
}
