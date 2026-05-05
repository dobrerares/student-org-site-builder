import { describe, expect, test } from "vitest";

import { HASH_PREFIX_LENGTH, sha256HexPrefix } from "../src/hash.js";

describe("sha256HexPrefix", () => {
  // Reference values from `printf "abc" | sha256sum`.
  const ABC_FULL = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

  test("returns the canonical leading hex prefix of SHA-256(input)", async () => {
    const bytes = new TextEncoder().encode("abc");
    const prefix = await sha256HexPrefix(bytes);
    expect(prefix).toBe(ABC_FULL.slice(0, HASH_PREFIX_LENGTH));
  });

  test("prefix length is exactly HASH_PREFIX_LENGTH characters of lowercase hex", async () => {
    const bytes = new TextEncoder().encode("abc");
    const prefix = await sha256HexPrefix(bytes);
    expect(prefix).toMatch(/^[0-9a-f]+$/);
    expect(prefix.length).toBe(HASH_PREFIX_LENGTH);
  });

  test("identical input bytes produce identical prefixes (content addressing)", async () => {
    const a = new Uint8Array([1, 2, 3, 4, 5]);
    const b = new Uint8Array([1, 2, 3, 4, 5]);
    const ha = await sha256HexPrefix(a);
    const hb = await sha256HexPrefix(b);
    expect(ha).toBe(hb);
  });

  test("a single-byte difference flips many prefix bits", async () => {
    const a = new Uint8Array([1, 2, 3, 4, 5]);
    const b = new Uint8Array([1, 2, 3, 4, 6]);
    const ha = await sha256HexPrefix(a);
    const hb = await sha256HexPrefix(b);
    expect(ha).not.toBe(hb);
  });

  test("works on empty input", async () => {
    const empty = new Uint8Array(0);
    const prefix = await sha256HexPrefix(empty);
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(prefix).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".slice(
        0,
        HASH_PREFIX_LENGTH,
      ),
    );
  });

  test("HASH_PREFIX_LENGTH is in the documented v1 range (12-32 hex chars)", () => {
    // ADR pins 16 hex chars (64 bits of entropy). Range check guards
    // against accidental shrink / expansion.
    expect(HASH_PREFIX_LENGTH).toBeGreaterThanOrEqual(12);
    expect(HASH_PREFIX_LENGTH).toBeLessThanOrEqual(32);
  });
});
