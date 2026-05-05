import { beforeAll, describe, expect, test } from "vitest";
import { build as esbuild } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * AC #4 — Build runs in a browser environment (no `fs`, no Node-only APIs in
 * this module's runtime path).
 *
 * We verify this two ways:
 *
 *  1. Bundle `@sosb/build` for the browser via esbuild with all Node
 *     built-ins marked external (the default behaviour for `platform:
 *     "browser"` without polyfills) and assert the bundle build succeeds. If
 *     any code path on the runtime path of `build()` imports a Node built-in
 *     (`node:fs`, `node:path`, `node:crypto`, `node:url`, `process`,
 *     `Buffer`, etc.), esbuild's browser platform refuses to inline it and
 *     emits an unresolvable-import error.
 *
 *  2. Scan the resulting bundle text for explicit `node:`-prefixed imports
 *     and a small list of bare Node built-in names (since `module: "ESNext"`
 *     code can also import `"fs"` without the `node:` prefix on Node 20).
 *
 * Test infra (vitest itself, esbuild) IS allowed to use Node — only the
 * production runtime is constrained. The test file uses `node:url` and
 * `node:path` to LOCATE the source, but the bundling target is the source,
 * not this file.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const buildPkgRoot = path.resolve(__dirname, "..");
const buildEntryPoint = path.join(buildPkgRoot, "src", "index.ts");

async function bundleBuildForBrowser(): Promise<string> {
  const result = await esbuild({
    entryPoints: [buildEntryPoint],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    jsxImportSource: "preact",
    absWorkingDir: buildPkgRoot,
  });
  const out = result.outputFiles[0];
  if (out === undefined) throw new Error("esbuild produced no output for @sosb/build");
  return out.text;
}

// Cold esbuild startup on Windows can exceed vitest's default 5s timeout
// when bundling the full @sosb/build → @sosb/renderer → @sosb/schema graph
// (especially as the workspace grows). 30 s is the same generous ceiling
// the e2e Playwright bundling spec uses.
const ESBUILD_TIMEOUT_MS = 30_000;

describe("build — browser-runnability (no Node-only imports on runtime path)", () => {
  // Cache the bundle so each test reuses one build. Bundling pulls the full
  // renderer dependency tree (Preact + DOMPurify) and takes ~2-3s on cold
  // run; running it four separate times exceeded vitest's per-test 5s
  // timeout under parallel load. The bundle output is stable for the
  // suite's lifetime, so caching is correct.
  let bundle = "";
  beforeAll(async () => {
    bundle = await bundleBuildForBrowser();
  }, 30000);

  test("bundles cleanly for the browser without resolution errors", () => {
    // The bundling itself failing — e.g. with "Could not resolve 'node:fs'" — is
    // the primary signal. Reaching this assertion at all means esbuild was
    // happy with every import on the runtime path.
    expect(bundle.length).toBeGreaterThan(0);
  }, ESBUILD_TIMEOUT_MS);

  test("the browser bundle contains no `node:`-prefixed imports", () => {
    expect(bundle).not.toMatch(/\bfrom\s+["']node:/);
    expect(bundle).not.toMatch(/\brequire\(["']node:/);
    expect(bundle).not.toMatch(/\bimport\(["']node:/);
  }, ESBUILD_TIMEOUT_MS);

  test("the browser bundle does not reference Node built-in module names", () => {
    // The forbidden built-ins. We deliberately do NOT include `process` /
    // `Buffer` here because those are global identifiers; checking for `from
    // "process"` etc. as an import specifier is the right grain.
    const forbidden = [
      "fs",
      "fs/promises",
      "path",
      "path/posix",
      "crypto",
      "url",
      "os",
      "stream",
      "buffer",
      "child_process",
      "module",
      "worker_threads",
    ];
    for (const name of forbidden) {
      // Only catch *bare* Node-built-in imports, not inert occurrences of the
      // letters in identifiers / strings.
      const fromPattern = new RegExp(`\\bfrom\\s+["']${escapeRegExp(name)}["']`);
      const requirePattern = new RegExp(`\\brequire\\(["']${escapeRegExp(name)}["']\\)`);
      const dynamicImportPattern = new RegExp(`\\bimport\\(["']${escapeRegExp(name)}["']\\)`);
      expect(bundle, `Node built-in '${name}' imported via 'from'`).not.toMatch(fromPattern);
      expect(bundle, `Node built-in '${name}' required`).not.toMatch(requirePattern);
      expect(bundle, `Node built-in '${name}' dynamic-imported`).not.toMatch(dynamicImportPattern);
    }
  }, ESBUILD_TIMEOUT_MS);

  test("the browser bundle does not reference `process` as a global on the hot path", () => {
    // `process.env.NODE_ENV` style references. We check for unwrapped
    // accesses; esbuild often leaves these alone for browser bundles, which
    // is exactly the failure mode we want to catch.
    expect(bundle).not.toMatch(/\bprocess\.env\b/);
    expect(bundle).not.toMatch(/\bprocess\.platform\b/);
    expect(bundle).not.toMatch(/\bprocess\.cwd\b/);
  }, ESBUILD_TIMEOUT_MS);
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
