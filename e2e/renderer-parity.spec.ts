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

/**
 * The same parity guarantee for a Site rendered under a Theme package
 * (ADR 0050 / ADR 0052).
 *
 * Worth its own case: a packaged Theme runs CSS `url()` rewriting and the
 * bundle font emitter, neither of which the built-in path touches, and both
 * of which are string manipulation that could plausibly differ between JS
 * engines. ADR 0046 requires identical page HTML across browser preview and
 * Electron/export for the same Site *and Theme*.
 */
test("renderSite is byte-identical across engines under a packaged Theme", async ({ page }) => {
  const [browserBundle, nodeModule] = await Promise.all([bundleForBrowser(), bundleForNode()]);

  const themed = structuredClone(fixture) as Record<string, unknown>;
  themed.theme = { id: "org.example.parity", shellVariant: "compact" };
  const firstPage = (themed.pages as { blocks: Record<string, unknown>[] }[])[0];
  if (firstPage !== undefined && firstPage.blocks[0] !== undefined) {
    firstPage.blocks[0].variant = "split";
  }

  const bundle = (nodeModule as unknown as { PARITY_THEME_BUNDLE?: unknown }).PARITY_THEME_BUNDLE;
  // The Node bundle is the renderer itself, not the e2e entry, so rebuild the
  // same bundle here rather than importing it across the boundary.
  const nodeBundle = bundle ?? nodeThemeBundle();
  const nodeOutput = (
    nodeModule as unknown as {
      renderSite: (d: unknown, id: string, o: unknown) => string;
    }
  ).renderSite(themed, "org.example.parity", { theme: nodeBundle });

  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ type: "module", content: browserBundle });

  const browserOutput = await page.evaluate((siteData) => {
    const w = window as unknown as {
      __sosbRenderer: {
        renderSite: (data: unknown, themeId: string, opts: unknown) => string;
        themeBundle: { id: string };
      };
    };
    const theme = w.__sosbRenderer.themeBundle;
    return w.__sosbRenderer.renderSite(siteData, theme.id, { theme });
  }, themed);

  expect(browserOutput).toBe(nodeOutput);
  // Sanity: the packaged-Theme code paths really did run.
  expect(nodeOutput).toContain('url("assets/theme/org.example.parity/assets/bg.svg")');
  expect(nodeOutput).toContain('font-family:"Parity Display"');
  expect(nodeOutput).toContain('data-variant="split"');
  expect(nodeOutput).toContain('data-shell-variant="compact"');
});

/**
 * The Node-side twin of the entry's `PARITY_THEME_BUNDLE`. Kept in lockstep
 * with `renderer-parity.entry.ts` — if the two drift, the parity assertion
 * fails, which is the correct outcome.
 */
function nodeThemeBundle(): unknown {
  return {
    id: "org.example.parity",
    name: "Parity",
    version: "1.0.0",
    origin: "package",
    css: `[data-block="hero"]{background-image:url(assets/bg.svg);}`,
    baselineTokens: [["--color-primary", "#123456"]],
    supports: { colors: true, fonts: false, density: true, radius: true },
    blockVariants: { hero: [{ id: "split", label: "Split" }] },
    shellVariants: [{ id: "compact", label: "Compact" }],
    fontSource: {
      kind: "bundle",
      faces: [{ family: "Parity Display", weight: 700, style: "normal", file: "fonts/d.woff2" }],
      bytes: new Map([["fonts/d.woff2", new Uint8Array([1, 2, 3])]]),
    },
    assets: new Map([["assets/bg.svg", new Uint8Array([4, 5, 6])]]),
  };
}
