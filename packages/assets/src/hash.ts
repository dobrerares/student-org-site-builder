/**
 * SHA-256 prefix hashing for content-addressed asset paths.
 *
 * The PRD pins content-addressing using a SHA-256 prefix (e.g.
 * `assets/8e3a7f.jpg`). This module implements the prefix derivation.
 *
 * The prefix length (`HASH_PREFIX_LENGTH`) is documented in
 * `docs/adr/0004-asset-pipeline-browser.md`. We use 16 lowercase hex
 * characters = 64 bits of entropy. By the birthday bound, collision
 * probability stays below 1 in a million up to ~6 million distinct
 * assets per site, which is many orders of magnitude beyond the v1 use
 * case (a student-org site with at most a few hundred images). If a
 * future site genuinely outgrows 64 bits we can extend the prefix
 * without breaking backward compatibility — the file extension already
 * disambiguates within a hash bucket and the metadata sidecar lets us
 * detect collisions explicitly.
 *
 * Implementation uses `crypto.subtle.digest('SHA-256', ...)` from the
 * Web Crypto API. This API is available unmodified in the browser and
 * in Node ≥20 (`globalThis.crypto.subtle`), so the runtime path is the
 * same in both environments. No `node:crypto` import — the browser
 * bundle stays clean.
 */

export const HASH_PREFIX_LENGTH = 16;

/**
 * Compute the lowercase hexadecimal prefix of SHA-256(input).
 *
 * Returns a string of exactly `HASH_PREFIX_LENGTH` characters from the
 * set `[0-9a-f]`. Identical inputs always produce identical prefixes
 * (content-addressing contract).
 */
export async function sha256HexPrefix(input: Uint8Array): Promise<string> {
  // `crypto.subtle.digest` rejects on a `BufferSource` whose buffer is
  // detached / shared, so accept a `Uint8Array` and pass `.buffer`.
  // We slice to ensure no offset weirdness on subarray views.
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input.slice().buffer);
  return bufferToHexPrefix(new Uint8Array(digest), HASH_PREFIX_LENGTH);
}

function bufferToHexPrefix(bytes: Uint8Array, charCount: number): string {
  // Two hex chars per byte; only stringify enough bytes to cover the prefix.
  const byteCount = Math.ceil(charCount / 2);
  let out = "";
  for (let i = 0; i < byteCount; i++) {
    const b = bytes[i];
    if (b === undefined) break;
    out += b.toString(16).padStart(2, "0");
  }
  return out.slice(0, charCount);
}
