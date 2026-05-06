// CI-side helper: build the Lighthouse fixture site and materialise its dist
// Map to disk for Lighthouse CI to crawl. NOT browser-pure code -- this is a
// Node script run only by GitHub Actions, so it uses `node:fs`, `node:path`,
// and esbuild's Node API. The build pipeline itself stays browser-pure per
// ADR 0004; this script merely loads it from CI.
//
// Why bundle through esbuild here instead of using `tsx`? The renderer is
// `.tsx` and uses Preact's automatic JSX runtime; tsx (the loader) doesn't
// pick up the per-package tsconfig's `jsxImportSource` for transitively
// imported files. esbuild does, since it's the same bundler the package's
// own browser-runnability test uses (see packages/build/test/no-node-imports.test.ts).
//
// Usage:
//   node scripts/build-lighthouse-fixture.mjs <out-dir>

import { build as esbuild } from "esbuild";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

const outDir = resolve(process.cwd(), process.argv[2] ?? "lighthouse-dist");

// Bundle @sosb/build with the renderer inlined. Using `platform: "node"`
// here (NOT "browser") because this script runs in Node CI; the bundle is
// thrown away after one use, so we don't need to re-verify browser-purity
// (the test suite already does that on every PR).
//
// Bundle output lives under packages/renderer/node_modules/.cache (NOT
// os.tmpdir()) so Node's bare-specifier resolution can walk up and find
// `jsdom` (marked external below) via the renderer package's symlink.
// jsdom is only declared in @sosb/renderer's package.json, so pnpm does
// not hoist it to <repoRoot>/node_modules; it is reachable only from
// inside packages/renderer's tree. A bundle in os.tmpdir() or the repo
// root has no jsdom ancestor and external imports would
// ERR_MODULE_NOT_FOUND at runtime.
const buildEntryPoint = join(repoRoot, "packages", "build", "src", "index.ts");
const bundleDir = join(repoRoot, "packages", "renderer", "node_modules", ".cache", "sosb-build");
mkdirSync(bundleDir, { recursive: true });
const bundlePath = join(bundleDir, `bundle-${Date.now()}.mjs`);
await esbuild({
  entryPoints: [buildEntryPoint],
  bundle: true,
  outfile: bundlePath,
  format: "esm",
  platform: "node",
  target: "node20",
  jsx: "automatic",
  jsxImportSource: "preact",
  absWorkingDir: repoRoot,
  // jsdom is a CJS module reached transitively via @sosb/renderer's
  // sanitize.node.ts entry. esbuild can't statically resolve jsdom's
  // internal `require(...)` calls and emits a throwing stub. Mark it
  // external so Node resolves it from node_modules at runtime instead.
  external: ["jsdom"],
});

const { build } = await import(pathToFileURL(bundlePath).href);

const fixturePath = join(
  repoRoot,
  "packages",
  "build",
  "test",
  "fixtures",
  "lighthouse-fixture.json",
);
const site = JSON.parse(readFileSync(fixturePath, "utf8"));

const dist = build(site, {
  siteUrl: "http://localhost:8080",
  errorOnBudget: true,
});

mkdirSync(outDir, { recursive: true });
for (const [path, contents] of dist) {
  const fullPath = join(outDir, path);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, contents);
}
const reportRaw = dist.get("_lighthouse-budget.json");
const report = reportRaw ? JSON.parse(reportRaw) : { status: "unknown" };
console.log(
  `[build-lighthouse-fixture] wrote ${dist.size} files to ${outDir} (budget: ${report.status})`,
);
