/**
 * Node-only entry point: load a Theme package from a plain directory.
 *
 * ADR 0050 accepts a directory as an equivalent form of a Theme package so
 * that a developer can iterate without re-zipping on every CSS tweak, and so
 * that a package can live in this repo as reviewable source (see
 * `examples/themes/practice/`) rather than an opaque binary.
 *
 * Kept in its own module because it imports `node:fs`: the browser build of
 * `@sosb/theme-package` must not pull that in.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { loadThemePackage, type LoadedThemePackage } from "./load.js";
import { initThemeSandbox } from "./sandbox.js";

/** Files we never treat as part of a package, whatever the directory holds. */
const IGNORED = new Set([".DS_Store", "Thumbs.db", "node_modules", ".git"]);

function collect(root: string, dir: string, into: Map<string, Uint8Array>): void {
  for (const entry of readdirSync(dir).sort()) {
    if (IGNORED.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collect(root, full, into);
      continue;
    }
    if (!stat.isFile()) continue;
    // Normalise to forward slashes: package paths are archive paths, and a
    // Theme authored on Windows must produce the same bundle as on Linux.
    const rel = relative(root, full).split(sep).join("/");
    into.set(rel, new Uint8Array(readFileSync(full)));
  }
}

/**
 * Read every file under `dir` and load it as a Theme package. Documentation
 * files that happen to sit alongside the manifest (a README, a LICENSE) are
 * included verbatim, so re-exporting the directory keeps them.
 */
export function loadThemePackageFromDirectory(dir: string): LoadedThemePackage {
  const files = new Map<string, Uint8Array>();
  collect(dir, dir, files);
  return loadThemePackage(files);
}

/**
 * As `loadThemePackageFromDirectory`, but starts the Theme sandbox first.
 *
 * The synchronous form is kept because most callers — the golden tests, the
 * CSS checks — load declarative packages and reading a directory synchronously
 * is the simplest thing that works. A package with a `render.js` needs the
 * WASM engine instantiated, which is a promise exactly once per process, so a
 * caller that might meet one uses this instead of remembering to
 * `await initThemeSandbox()` by hand.
 */
export async function loadThemePackageFromDirectoryAsync(dir: string): Promise<LoadedThemePackage> {
  await initThemeSandbox();
  return loadThemePackageFromDirectory(dir);
}
