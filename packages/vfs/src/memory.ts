import type { Vfs } from "./vfs.js";
import { VfsNotFoundError } from "./errors.js";
import { validatePath, validatePrefix } from "./path.js";

/**
 * In-memory VFS driver. Used by tests and by the editor's in-memory
 * document model. Backed by a `Map<string, Uint8Array>`; every entry
 * stores a defensive copy of the bytes, so mutating the buffer the
 * caller passed to `write()` (or the buffer returned from `read()`)
 * does not corrupt the stored data.
 */
export class MemoryDriver implements Vfs {
  private readonly entries = new Map<string, Uint8Array>();

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
    // Self-copy: store a fresh copy so the source/destination buffers
    // remain independent.
    this.entries.set(dst, cloneBytes(stored));
  }

  async has(path: string): Promise<boolean> {
    const key = validatePath(path);
    return this.entries.has(key);
  }
}

function cloneBytes(input: Uint8Array): Uint8Array {
  const copy = new Uint8Array(input.byteLength);
  copy.set(input);
  return copy;
}
