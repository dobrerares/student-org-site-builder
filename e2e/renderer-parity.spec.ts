import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Node-vs-browser parity (binding AC).
 *
 * The renderer's contract is "byte-identical output in Node and browser." We
 * verify that contract end-to-end here.
 *
 * Strategy: rather than importing the renderer's TSX source directly into
 * the Playwright test (Playwright's built-in TS loader does not transform
 * JSX), we bundle the renderer twice — once for the browser, once for
 * Node — using esbuild. We then dynamically import the Node bundle and call
 * its `renderSite`, and inject the browser bundle into a real headless
 * Chromium page and call its `renderSite`. The two strings must be
 * byte-identical.
 *
 * Both bundles are produced from the same source files (and the same
 * `index.tsx` entry), so any code path that accidentally takes a hard
 * dependency on a Node-only built-in or a browser-only API surfaces here.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const requireFromHere = createRequire(import.meta.url);
const fixturePath = path.join(
  repoRoot,
  "packages",
  "renderer",
  "test",
  "fixtures",
  "hero-only.json",
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;

interface RendererModule {
  renderSite: (data: unknown, themeId: string) => string;
}

async function bundleForBrowser(): Promise<string> {
  const entryPath = path.join(__dirname, "renderer-parity.entry.ts");
  const result = await build({
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

async function bundleForNode(): Promise<RendererModule> {
  const entryPath = path.join(repoRoot, "packages", "renderer", "src", "index.tsx");
  const tmpDir = path.join(
    repoRoot,
    "packages",
    "renderer",
    "node_modules",
    ".cache",
    "sosb-renderer-parity",
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
  return requireFromHere(outFile) as RendererModule;
}

test("renderSite produces byte-identical output in Node and headless Chromium", async ({
  page,
}) => {
  const [browserBundle, nodeModule] = await Promise.all([bundleForBrowser(), bundleForNode()]);

  const nodeOutput = nodeModule.renderSite(fixture, "stub");

  await page.setContent("<!doctype html><html><body></body></html>");
  // Bundle the renderer is then attached to window via the parity entry.
  // Both rendered strings come from the same source files; the only
  // difference is the JS engine they execute under.
  await page.addScriptTag({ type: "module", content: browserBundle });

  const browserOutput = await page.evaluate((siteData) => {
    const w = window as unknown as {
      __sosbRenderer: { renderSite: (data: unknown, themeId: string) => string };
    };
    return w.__sosbRenderer.renderSite(siteData, "stub");
  }, fixture);

  expect(browserOutput).toBe(nodeOutput);
  // Sanity: the output must be non-trivial (catches the regression where
  // a missing JSX runtime makes both strings empty).
  expect(nodeOutput.length).toBeGreaterThan(200);
});
