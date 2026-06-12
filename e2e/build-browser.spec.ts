import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Browser-runnability of `@sosb/build` (binding AC #4).
 *
 * The build pipeline must execute inside the in-browser editor (#7) without
 * adapter shims. We verify that contract end-to-end here.
 *
 * Strategy: bundle `@sosb/build` for both Node and browser via esbuild,
 * dynamically import the Node bundle, inject the browser bundle into a real
 * headless Chromium page, then call `build()` in both environments and
 * compare the emitted dist folder. The browser cannot use `node:fs` or
 * other built-ins, so any latent dependency surfaces here as either an
 * unresolved-import bundling error OR as a runtime failure when the bundle
 * loads.
 *
 * In addition to byte-equality of the produced HTML / robots / sitemap, we
 * also assert the headless-Chromium-produced HTML is a complete document —
 * a sanity check against the regression where a missing JSX runtime makes
 * both strings empty.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const requireFromHere = createRequire(import.meta.url);
const fixturePath = path.join(
  repoRoot,
  "packages",
  "build",
  "test",
  "fixtures",
  "single-page-site.json",
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;

interface BuildModule {
  build: (data: unknown, options?: { siteUrl?: string; themeId?: string }) => Map<string, string>;
}

async function bundleForBrowser(): Promise<string> {
  const entryPath = path.join(__dirname, "build-browser.entry.ts");
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

async function bundleForNode(): Promise<BuildModule> {
  const entryPath = path.join(repoRoot, "packages", "build", "src", "index.ts");
  const tmpDir = path.join(
    repoRoot,
    "packages",
    "renderer",
    "node_modules",
    ".cache",
    "sosb-build-browser",
  );
  mkdirSync(tmpDir, { recursive: true });
  const outFile = path.join(tmpDir, `build-${process.pid}-${Date.now()}.cjs`);
  const result = await esbuild({
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
  return requireFromHere(outFile) as BuildModule;
}

test("build() produces byte-identical dist output in Node and headless Chromium", async ({
  page,
}) => {
  const [browserBundle, nodeModule] = await Promise.all([bundleForBrowser(), bundleForNode()]);

  const nodeDist = nodeModule.build(fixture, { siteUrl: "https://stub.example.org" });
  const nodeEntries = [...nodeDist.entries()].sort(([a], [b]) => a.localeCompare(b));

  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ type: "module", content: browserBundle });

  const browserEntries = await page.evaluate((siteData) => {
    const w = window as unknown as {
      __sosbBuild: {
        build: (
          data: unknown,
          options?: { siteUrl?: string; themeId?: string },
        ) => Map<string, string>;
      };
    };
    const dist = w.__sosbBuild.build(siteData, { siteUrl: "https://stub.example.org" });
    return [...dist.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, fixture);

  expect(browserEntries).toEqual(nodeEntries);

  // Sanity: the browser-emitted HTML is a complete document. Catches the
  // failure mode where a missing JSX runtime collapses everything to empty.
  const browserHtml = browserEntries.find(([k]) => k === "index.html")?.[1];
  expect(browserHtml).toBeDefined();
  expect(browserHtml!.length).toBeGreaterThan(200);
  expect(browserHtml!.startsWith("<!doctype html>")).toBe(true);
});
