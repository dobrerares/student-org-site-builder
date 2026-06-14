import type { DistFolder } from "../../src/index.js";

/**
 * Read a known-text artefact (HTML / XML / JSON / robots.txt) out of a
 * `DistFolder` and narrow it to `string`.
 *
 * Since PR-F2b the dist Map is `Map<string, string | Uint8Array>` (binary
 * woff2 fonts ride the same lane as text), so `dist.get(path)` is
 * `string | Uint8Array | undefined`. Tests that assert on text artefacts use
 * this helper to assert presence and string-ness in one place rather than
 * scattering casts across every call site. Throws if the entry is missing or
 * is binary, which is a real test bug rather than a type-erasure.
 */
export function textOf(dist: DistFolder, path: string): string {
  const value = dist.get(path);
  if (value === undefined) {
    throw new Error(`dist has no entry at '${path}'`);
  }
  if (typeof value !== "string") {
    throw new Error(`dist entry '${path}' is binary (Uint8Array), expected text`);
  }
  return value;
}
