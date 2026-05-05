/**
 * The abstract VFS interface. Every driver — `MemoryDriver`, `ZipDriver`,
 * and the future IndexedDB / OPFS / Electron-FS drivers — implements
 * exactly this surface. Six methods, all on a single type, all `async`
 * even where a driver could be synchronous (so call sites stay
 * driver-agnostic).
 *
 * Path policy is documented in `./path.ts`. Errors are documented in
 * `./errors.ts`.
 */

export interface Vfs {
  /**
   * Read the bytes at `path`. Throws `VfsNotFoundError` if the path is
   * absent and `VfsInvalidPathError` if the path is malformed.
   */
  read(path: string): Promise<Uint8Array>;

  /**
   * Write the given bytes to `path`, replacing any existing content.
   * Creates intermediate directories implicitly — a VFS is a flat map
   * keyed by path, not a tree.
   *
   * Drivers MUST store a copy of the input bytes, not retain a reference
   * to the caller's buffer. The conformance suite asserts this by mutating
   * the buffer after `write()` returns.
   */
  write(path: string, bytes: Uint8Array): Promise<void>;

  /**
   * List all paths whose prefix matches the given string, sorted
   * lexicographically. With no prefix (or an empty prefix), returns every
   * path in the VFS.
   *
   * The sort is part of the contract — zip outputs depend on stable
   * ordering for byte-identical round-trip.
   */
  list(prefix?: string): Promise<string[]>;

  /**
   * Delete the path. Throws `VfsNotFoundError` if absent.
   */
  delete(path: string): Promise<void>;

  /**
   * Copy bytes from `from` to `to`. Throws `VfsNotFoundError` if `from` is
   * absent. Overwrites `to` if it exists. Source and destination must be
   * different paths (drivers MAY no-op when they are equal, but the
   * conformance suite asserts the safer behaviour: `from === to` succeeds
   * without corrupting the data).
   */
  copy(from: string, to: string): Promise<void>;

  /**
   * Cheap existence check. Useful for branching without paying the cost of
   * a full `read()`.
   */
  has(path: string): Promise<boolean>;
}
