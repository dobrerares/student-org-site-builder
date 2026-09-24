import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

/**
 * Node-vs-browser parity for a Theme package with an executable design
 * (ADR 0046: "identical page HTML across browser preview and Electron/export";
 * ADR 0054 for the mechanism).
 *
 * The declarative half of this guarantee is covered by `renderer-parity.spec.ts`
 * with an inline bundle. A `render.js` adds a JavaScript engine to the path,
 * and an engine is exactly the kind of thing that could behave differently in
 * Node and in Chromium — so the example Theme is loaded and rendered in both,
 * through the real loader and the real sandbox, and the two strings must be
 * byte-identical.
 *
 * It doubles as the embedding proof: the browser bundle is injected inline,
 * so the QuickJS wasm has to instantiate from bytes carried in the script
 * with no separate file to fetch — the constraint the single-file archival
 * editor imposes.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const EXAMPLE_DIR = path.join(repoRoot, "examples", "themes", "practice");
const SAMPLE_SITE = path.join(
  repoRoot,
  "packages",
  "themes",
  "src",
  "templates",
  "asociatia-studenteasca-demo",
  "data.json",
);

interface ThemeRenderModule {
  initThemeSandbox: () => Promise<void>;
  loadThemePackage: (files: Map<string, Uint8Array>) => {
    bundle: { id: string; render?: { dispose(): void } };
  };
  renderSite: (site: unknown, themeId: string, opts: Record<string, unknown>) => string;
}

/** The example package as `path -> base64`, so it can cross into the page. */
function readPackage(): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (name === "screenshots" || name === "README.md") continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else
        out[path.relative(EXAMPLE_DIR, full).split(path.sep).join("/")] =
          readFileSync(full).toString("base64");
    }
  };
  walk(EXAMPLE_DIR);
  return out;
}

async function bundleForBrowser(): Promise<string> {
  const result = await esbuild({
    entryPoints: [path.join(__dirname, "theme-render-parity.entry.ts")],
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

async function bundleForNode(): Promise<ThemeRenderModule> {
  const result = await esbuild({
    entryPoints: [path.join(__dirname, "theme-render-parity.entry.ts")],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "es2022",
    jsx: "automatic",
    jsxImportSource: "preact",
    absWorkingDir: repoRoot,
    // See a11y.spec.ts: jsdom is CJS with dynamic requires; leave it to Node.
    external: ["jsdom"],
  });
  const out = result.outputFiles[0];
  if (out === undefined) throw new Error("esbuild produced no node output");
  // Under packages/renderer so the external jsdom resolves (see a11y.spec.ts).
  const tmpDir = path.join(
    repoRoot,
    "packages",
    "renderer",
    "node_modules",
    ".cache",
    "sosb-theme-render-parity",
  );
  mkdirSync(tmpDir, { recursive: true });
  const outFile = path.join(tmpDir, `bundle-${process.pid}-${Date.now()}.mjs`);
  writeFileSync(
    outFile,
    out.text.replace(/\bwindow\.__sosbThemeRender\s*=/, "globalThis.__sosbThemeRender ="),
  );
  try {
    await import(pathToFileURL(outFile).href);
  } finally {
    // The bundle embeds the QuickJS wasm (~1 MB per run); once imported the
    // file has done its job and should not accumulate in the cache dir.
    rmSync(outFile, { force: true });
  }
  return (globalThis as unknown as { __sosbThemeRender: ThemeRenderModule }).__sosbThemeRender;
}

function siteFor(themeId: string): Record<string, unknown> {
  const site = JSON.parse(readFileSync(SAMPLE_SITE, "utf8")) as Record<string, unknown> & {
    pages: { blocks: { type: string; variant?: string }[] }[];
  };
  site.theme = { id: themeId, shellVariant: "compact" };
  const hero = site.pages[0]?.blocks[0];
  if (hero !== undefined && hero.type === "hero") hero.variant = "spotlight";
  return site;
}

test("a Theme with render.js renders byte-identical HTML in Node and headless Chromium", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const files = readPackage();
  expect(Object.keys(files)).toContain("render.js");
  expect(Object.keys(files)).toContain("public.js");

  const [browserBundle, nodeModule] = await Promise.all([bundleForBrowser(), bundleForNode()]);

  // Node side: the real loader, the real sandbox.
  await nodeModule.initThemeSandbox();
  const nodeFiles = new Map(
    Object.entries(files).map(([p, b64]) => [p, new Uint8Array(Buffer.from(b64, "base64"))]),
  );
  const { bundle } = nodeModule.loadThemePackage(nodeFiles);
  const site = siteFor(bundle.id);
  const nodeHtml = [0, 1].map((pageIndex) =>
    nodeModule.renderSite(site, bundle.id, { pageIndex, theme: bundle, includePublicScript: true }),
  );
  bundle.render?.dispose();

  // Browser side: the same bytes, injected inline — no separate .wasm file.
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ type: "module", content: browserBundle });
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { __sosbThemeRender?: unknown }).__sosbThemeRender === "object",
  );

  const browserHtml = await page.evaluate(
    async ({ files, site }) => {
      const w = window as unknown as { __sosbThemeRender: ThemeRenderModule };
      await w.__sosbThemeRender.initThemeSandbox();
      const map = new Map<string, Uint8Array>();
      for (const [p, b64] of Object.entries(files)) {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        map.set(p, bytes);
      }
      const { bundle } = w.__sosbThemeRender.loadThemePackage(map);
      const out = [0, 1].map((pageIndex) =>
        w.__sosbThemeRender.renderSite(site, bundle.id, {
          pageIndex,
          theme: bundle,
          includePublicScript: true,
        }),
      );
      bundle.render?.dispose();
      return out;
    },
    { files, site },
  );

  expect(browserHtml).toEqual(nodeHtml);
  // Sanity: the executable shell and the public script are actually in there.
  expect(nodeHtml[0]).toContain('class="site-nav__wordmark"');
  expect(nodeHtml[0]).toContain('data-variant="spotlight"');
  expect(nodeHtml[0]).toContain("assets/theme/org.example.practice/public.js");
  expect(nodeHtml[1]).toContain('data-shell-variant="compact"');
});
