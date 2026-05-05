/**
 * Programmatic entry for the archival single-file build.
 *
 * This is the function `pnpm build:archival` invokes via the thin
 * `build-archival.mjs` shim. Living in `scripts/` (not `src/`) keeps it out
 * of the package's published surface — it's tooling, not a runtime API.
 *
 * Pipeline:
 *
 *   1. Bundle the editor app's mount entry for the browser via esbuild.
 *      Output: a single ESM `bundle.js` string and (currently empty) CSS.
 *   2. Build the shell HTML — a hand-written page with a top-level
 *      `<div id="root">`, a bootstrap `<script type="module" src="/bundle.js">`,
 *      and the editor metadata.
 *   3. Run `buildArchival({ html, assets })` to inline the bundle into the
 *      shell.
 *   4. Write `dist/archival/builder.html`.
 *
 * The default mount fixture is the editor's minimal site; production CLIs
 * can override with `MOUNT_DATA_JSON` / `--data` if a future need arises.
 */

import { build as esbuild } from "esbuild";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildArchival } from "../src/archival/build-archival.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Walk up to the @sosb/browser-shell package root (containing package.json
// with name "@sosb/browser-shell"). The runner is referenced both from
// `scripts/run-archival-build.ts` (vitest path) and from a bundled file in
// `scripts/.staging/` (build-archival.mjs path). Resolving via a stable
// anchor lets both invocation paths find the test fixture.
const pkgRoot = findPkgRoot(__dirname);
const repoRoot = path.resolve(pkgRoot, "..", "..");

function findPkgRoot(start: string): string {
  let cur = start;
  for (let i = 0; i < 10; i++) {
    try {
      const p = path.join(cur, "package.json");
      const txt = readFileSync(p, "utf8");
      if (txt.includes('"@sosb/browser-shell"')) return cur;
    } catch {
      // not here, walk up
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  throw new Error(`run-archival-build: cannot locate @sosb/browser-shell root from ${start}`);
}

export interface RunArchivalBuildOptions {
  /** Where to write `builder.html`. Defaults to `<pkg>/dist/archival/`. */
  readonly outDir?: string;
  /**
   * Path to a JSON site fixture used to seed the editor on first launch
   * inside the archival HTML. Defaults to the package's bundled minimal site.
   */
  readonly initialSitePath?: string;
}

export async function runArchivalBuild(
  options: RunArchivalBuildOptions = {},
): Promise<{ outPath: string; bytes: number }> {
  const outDir = options.outDir ?? path.join(pkgRoot, "dist", "archival");
  const initialSitePath =
    options.initialSitePath ?? path.join(pkgRoot, "test", "fixtures", "minimal-site.json");

  const initialSite = JSON.parse(readFileSync(initialSitePath, "utf8")) as Record<string, unknown>;

  // (1) Bundle the archival entry. The entry imports `<EditorApp>` and
  //     mounts it into `#root` with the embedded initial site.
  const entryPath = path.join(pkgRoot, "scripts", "archival-entry.tsx");
  const bundleResult = await esbuild({
    entryPoints: [entryPath],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    jsxImportSource: "preact",
    absWorkingDir: repoRoot,
    minify: true,
    define: {
      __SOSB_INITIAL_SITE_JSON__: JSON.stringify(JSON.stringify(initialSite)),
    },
  });
  const bundleFile = bundleResult.outputFiles[0];
  if (bundleFile === undefined) {
    throw new Error("runArchivalBuild: esbuild produced no output");
  }
  const bundleSource = bundleFile.text;

  // (2) Shell HTML.
  const shellHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Student Org Site Builder — archival edition</title>
<meta name="generator" content="@sosb/browser-shell archival build"/>
<style>
  html,body{margin:0;padding:0;font-family:system-ui,sans-serif;}
  #root{min-height:100vh;}
</style>
</head>
<body>
<div id="root"></div>
<script type="module" src="bundle.js"></script>
</body>
</html>
`;

  // (3) Inline the bundle into the shell.
  const archival = buildArchival({
    html: shellHtml,
    assets: new Map<string, string | Uint8Array>([["bundle.js", bundleSource]]),
  });

  // (4) Write output.
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "builder.html");
  writeFileSync(outPath, archival.html, "utf8");

  console.log(
    `archival build: ${outPath} (${(archival.bytes / 1024).toFixed(1)} KiB / ${archival.bytes} bytes)`,
  );

  return { outPath, bytes: archival.bytes };
}
