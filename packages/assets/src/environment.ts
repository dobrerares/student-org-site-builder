/**
 * Environment-aware processor selection.
 *
 * `getDefaultProcessor()` returns the right `ImageProcessor` for the
 * current runtime:
 *
 *  - Node (or Electron main process): the production Sharp-backed
 *    `MultiVariantImageProcessor`. Returned via dynamic `import()` so
 *    a browser-side static analyser never tries to resolve sharp's
 *    native binaries.
 *  - Browser (incl. Electron renderer with `sandbox: true`): the
 *    `CanvasImageProcessor`. No variant support -- use `uploadAsset`.
 *
 * The detection is deliberately conservative: we look for `process.versions.node`
 * AND ensure we're NOT in a renderer-style globalThis. Electron renderers
 * expose both `window` and `process`, so we additionally check `window`.
 *
 * Why the dynamic import? Static `import "sharp"` from a file that ends
 * up in a browser bundle blows up at bundle time even if the import is
 * conditional (Vite/Rollup walk imports eagerly). Sharp also pulls in
 * `node:fs` and `node:path` via its loader, which Vite refuses by
 * default. Putting it behind `await import()` keeps browser bundles
 * clean and lets Vite tree-shake the Node path entirely.
 */

import { CanvasImageProcessor } from "./canvas-processor.js";
import type { ImageProcessor, MultiVariantImageProcessor } from "./processor.js";

/**
 * Returns true if the current runtime is plain Node OR the Electron
 * main process. Returns false in any browser-like environment (web
 * SPA, Electron renderer with sandbox, web worker).
 */
export function isNodeEnvironment(): boolean {
  // Renderer-side Electron exposes both `window` and a sanitised `process`,
  // so check window first.
  if (typeof globalThis !== "undefined" && "window" in globalThis) return false;
  // Plain Node / Electron main has process.versions.node populated.
  const proc = (globalThis as unknown as { process?: { versions?: Record<string, string> } })
    .process;
  return typeof proc?.versions?.node === "string";
}

/**
 * Pick the right processor for the current runtime.
 *
 * - Node / Electron main -> Sharp (multi-variant capable).
 * - Browser / renderer  -> Canvas (single-output only).
 *
 * Callers wanting to branch on capability should test
 * `"encodeVariants" in processor` rather than relying on `instanceof`.
 */
export async function getDefaultProcessor(): Promise<ImageProcessor | MultiVariantImageProcessor> {
  if (isNodeEnvironment()) {
    // Dynamic import so the browser bundle never tries to resolve sharp.
    const mod = await import("./sharp-processor.js");
    return mod.createSharpImageProcessor();
  }
  return CanvasImageProcessor;
}
