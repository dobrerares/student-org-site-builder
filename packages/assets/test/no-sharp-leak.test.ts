/**
 * The Electron-side Sharp processor is a Node-only module. Its imports
 * must NEVER leak into a browser-runtime code path -- if they do, the
 * editor SPA breaks at bundle time.
 *
 * The seam is:
 *
 *   - `uploadAsset` + `CanvasImageProcessor` -> browser path (#8).
 *   - `uploadAssetWithVariants` + `createSharpImageProcessor` -> Node path (#37).
 *
 * The `getDefaultProcessor()` selector dynamic-imports `./sharp-processor.js`
 * only when `isNodeEnvironment()` returns true; the browser path goes
 * straight to `CanvasImageProcessor` without ever touching sharp.
 *
 * This test bundles `@sosb/assets` for the browser via esbuild and
 * asserts the resulting bytes contain no `sharp` import or `node:`
 * built-in. The dynamic import in `environment.ts` shows up in the
 * bundle as a deferred `import("./sharp-processor.js")` -- esbuild's
 * `splitting: true` would emit a separate chunk; we use
 * `splitting: false` and `external: ["./sharp-processor.js"]` to
 * mirror what the editor's bundler does in v1.
 */

import { describe, expect, test } from "vitest";
import { build as esbuild } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "..");
const entry = path.join(pkgRoot, "src", "index.ts");

async function bundleForBrowser(): Promise<string> {
  const result = await esbuild({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
    absWorkingDir: pkgRoot,
    // The dynamic import inside `environment.ts` resolves to
    // `./sharp-processor.js` at runtime; we mark it external so the
    // browser bundle lazy-loads it only in Node and the static bundle
    // never inlines sharp.
    external: ["sharp"],
  });
  const out = result.outputFiles[0];
  if (!out) throw new Error("esbuild produced no output");
  return out.text;
}

// Each subtest re-runs esbuild; under heavy parallel load the default
// 5s vitest timeout can overshoot. 30s is plenty of headroom.
const ESBUILD_TIMEOUT_MS = 30_000;

describe("@sosb/assets browser bundle does not pull in sharp / node built-ins", () => {
  test(
    "bundles cleanly for the browser",
    async () => {
      const bundle = await bundleForBrowser();
      expect(bundle.length).toBeGreaterThan(0);
    },
    ESBUILD_TIMEOUT_MS,
  );

  test(
    "does not statically import sharp",
    async () => {
      const bundle = await bundleForBrowser();
      // Static `from "sharp"` or top-level `import "sharp"` imports.
      expect(bundle).not.toMatch(/\bfrom\s+["']sharp["']/);
      expect(bundle).not.toMatch(/\brequire\(["']sharp["']\)/);
    },
    ESBUILD_TIMEOUT_MS,
  );

  test(
    "does not statically reference `node:` modules",
    async () => {
      const bundle = await bundleForBrowser();
      expect(bundle).not.toMatch(/\bfrom\s+["']node:/);
      expect(bundle).not.toMatch(/\brequire\(["']node:/);
    },
    ESBUILD_TIMEOUT_MS,
  );

  test(
    "the dynamic sharp-processor import is preserved as a runtime branch",
    async () => {
      const bundle = await bundleForBrowser();
      // `getDefaultProcessor` should keep its dynamic import; the actual
      // chunk path varies by bundler but the literal string identifier
      // for the sharp-processor module survives in the bundle so a Node
      // runtime can resolve it. We accept either the resolved relative
      // module specifier or any inlined sharp-processor symbol.
      expect(bundle).toMatch(/sharp-processor/i);
    },
    ESBUILD_TIMEOUT_MS,
  );
});
