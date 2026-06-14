import { unzipSync, zipSync } from "fflate";

import type { Vfs } from "./vfs.js";
import { VfsNotFoundError } from "./errors.js";
import { validatePath, validatePrefix } from "./path.js";

/**
 * Fixed mtime stamped on every entry of every zip we produce. fflate
 * defaults to wall-clock time, which would defeat byte-identical round
 * trips. The contract spec lists the round trip as "byte-identical
 * modulo timestamps"; nailing the mtime to a fixed value lets us drop
 * the "modulo" and assert true equality.
 *
 * The zip format only expresses dates from 1980-01-01 onward, so we
 * pin the value to exactly that — `Date.UTC(1980, 0, 1)`, expressed in
 * Unix-epoch milliseconds, which is what fflate's `mtime: number`
 * accepts. Using a sentinel also makes "this came from a deterministic
 * export" detectable.
 */
export const ZIP_DRIVER_MTIME = Date.UTC(1980, 0, 1);

/**
 * Import-side decompression limits for untrusted zip input. These are
 * deliberately generous for v1 so ordinary exported sites pass while
 * zip-bomb style archives are rejected before unbounded inflation.
 */
export const ZIP_IMPORT_MAX_ENTRIES = 2_000;
export const ZIP_IMPORT_MAX_ENTRY_BYTES = 50 * 1024 * 1024; // 50 MiB per entry
export const ZIP_IMPORT_MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200 MiB declared total

/**
 * ZIP-backed VFS driver. Functionally identical to `MemoryDriver` for
 * read/write/list/delete/copy/has — both keep an in-memory map. The
 * ZipDriver adds two static-shape conversions:
 *
 * - `toZipBytes()` — serialise the current contents to a deterministic
 *   zip byte stream. The same VFS state always produces the same bytes.
 * - `ZipDriver.fromZipBytes(bytes)` — parse a zip byte stream into a
 *   fresh ZipDriver, throwing a typed `Error` whose `message` starts
 *   with `"zip:"` on malformed input. The `@sosb/zip` package wraps
 *   that error in a higher-level `ZipImportError` with a stable code.
 *
 * The conformance suite at `@sosb/vfs/test-conformance` is satisfied by
 * both drivers, so the editor's call sites can substitute either
 * without noticing.
 */
export class ZipDriver implements Vfs {
  private readonly entries = new Map<string, Uint8Array>();

  /**
   * Construct a `ZipDriver` from raw zip bytes. Uses fflate's
   * `unzipSync`. Throws on malformed input.
   *
   * The driver's keys come from zip entry names. Empty-name entries
   * (some tools include a leading `./` entry that fflate normalises to
   * an empty name) and entries that look like directories
   * (trailing `/` with no body) are skipped — directories are implicit
   * in a flat-keyed VFS.
   */
  static fromZipBytes(
    input: Uint8Array,
    limits: { maxEntries?: number; maxEntryBytes?: number; maxTotalBytes?: number } = {},
  ): ZipDriver {
    const maxEntries = limits.maxEntries ?? ZIP_IMPORT_MAX_ENTRIES;
    const maxEntryBytes = limits.maxEntryBytes ?? ZIP_IMPORT_MAX_ENTRY_BYTES;
    const maxTotalBytes = limits.maxTotalBytes ?? ZIP_IMPORT_MAX_TOTAL_BYTES;
    let entryCount = 0;
    let declaredTotalBytes = 0;
    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = unzipSync(input, {
        filter(file) {
          if (file.name.endsWith("/")) return true;
          entryCount += 1;
          if (entryCount > maxEntries) {
            throw new Error("zip: import limits exceeded (entry count)");
          }
          if (file.originalSize > maxEntryBytes) {
            throw new Error("zip: import limits exceeded (entry size)");
          }
          declaredTotalBytes += file.originalSize;
          if (declaredTotalBytes > maxTotalBytes) {
            throw new Error("zip: import limits exceeded (total size)");
          }
          return true;
        },
      });
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith("zip: import limits exceeded")) {
        throw cause;
      }
      const err = new Error("zip: failed to decode zip bytes (input is not a valid zip)");
      (err as Error & { cause?: unknown }).cause = cause;
      throw err;
    }
    const driver = new ZipDriver();
    let actualTotalBytes = 0;
    for (const [rawName, body] of Object.entries(unzipped)) {
      // Normalise the entry name. fflate exposes the raw zip path; we
      // strip a leading `./` and reject anything that escapes the
      // archive root.
      let name = rawName;
      if (name.startsWith("./")) name = name.slice(2);
      if (name === "" || name.endsWith("/")) continue; // directory marker
      if (name.startsWith("/") || name.includes("\\") || name.includes("..")) {
        const err = new Error(
          `zip: malformed entry name "${rawName}" (absolute, backslash, or '..' segment)`,
        );
        throw err;
      }
      if (body.byteLength > maxEntryBytes) {
        throw new Error("zip: import limits exceeded (entry size)");
      }
      actualTotalBytes += body.byteLength;
      if (actualTotalBytes > maxTotalBytes) {
        throw new Error("zip: import limits exceeded (total size)");
      }
      driver.entries.set(name, cloneBytes(body));
    }
    return driver;
  }

  async read(path: string): Promise<Uint8Array> {
    const key = validatePath(path);
    const stored = this.entries.get(key);
    if (stored === undefined) throw new VfsNotFoundError(key);
    return cloneBytes(stored);
  }

  async write(path: string, bytes: Uint8Array): Promise<void> {
    const key = validatePath(path);
    this.entries.set(key, cloneBytes(bytes));
  }

  async list(prefix?: string): Promise<string[]> {
    const validatedPrefix = validatePrefix(prefix);
    const keys: string[] = [];
    for (const key of this.entries.keys()) {
      if (validatedPrefix === "" || key.startsWith(validatedPrefix)) {
        keys.push(key);
      }
    }
    keys.sort();
    return keys;
  }

  async delete(path: string): Promise<void> {
    const key = validatePath(path);
    if (!this.entries.has(key)) throw new VfsNotFoundError(key);
    this.entries.delete(key);
  }

  async copy(from: string, to: string): Promise<void> {
    const src = validatePath(from);
    const dst = validatePath(to);
    const stored = this.entries.get(src);
    if (stored === undefined) throw new VfsNotFoundError(src);
    this.entries.set(dst, cloneBytes(stored));
  }

  async has(path: string): Promise<boolean> {
    const key = validatePath(path);
    return this.entries.has(key);
  }

  /**
   * Serialise the current VFS contents to a deterministic zip byte
   * stream. Entries are written in lexicographic order, every entry
   * carries the fixed `ZIP_DRIVER_MTIME`, and the same VFS state
   * always produces the same bytes — this is the contract the
   * round-trip identity test depends on.
   */
  toZipBytes(): Uint8Array {
    const sortedKeys = Array.from(this.entries.keys()).sort();
    const payload: Record<string, [Uint8Array, { mtime: number }]> = {};
    for (const key of sortedKeys) {
      const stored = this.entries.get(key);
      if (stored === undefined) continue;
      payload[key] = [cloneBytes(stored), { mtime: ZIP_DRIVER_MTIME }];
    }
    return zipSync(payload, { mtime: ZIP_DRIVER_MTIME });
  }
}

function cloneBytes(input: Uint8Array): Uint8Array {
  const copy = new Uint8Array(input.byteLength);
  copy.set(input);
  return copy;
}
