/**
 * OPFS-backed `Vfs` driver.
 *
 * Uses `navigator.storage.getDirectory()` to store the editor VFS in the
 * origin-private file system. Unsupported browsers should not construct this
 * driver directly; use `openPreferredPersistentVfs(...)` to prefer OPFS and
 * fall back to IndexedDB.
 */

import type { Vfs } from "@sosb/vfs/vfs";
import { VfsNotFoundError } from "@sosb/vfs/errors";
import { validatePath, validatePrefix } from "@sosb/vfs/path";

export interface OpfsDriverOptions {
  /**
   * Test hook / host override. Defaults to `navigator.storage.getDirectory`.
   * The returned directory is treated as the VFS root.
   */
  readonly getDirectory?: () => Promise<FileSystemDirectoryHandle>;
}

export class OpfsDriver implements Vfs {
  readonly #root: FileSystemDirectoryHandle;

  /** @internal Use `openOpfsDriver` to construct. */
  constructor(root: FileSystemDirectoryHandle) {
    this.#root = root;
  }

  async read(path: string): Promise<Uint8Array> {
    const key = validatePath(path);
    const file = await this.#fileHandle(key, false);
    const blob = await file.getFile();
    return new Uint8Array(await blob.arrayBuffer());
  }

  async write(path: string, bytes: Uint8Array): Promise<void> {
    const key = validatePath(path);
    const file = await this.#fileHandle(key, true);
    const writable = await file.createWritable();
    const copy = cloneBytes(bytes);
    await writable.write(copy);
    await writable.close();
  }

  async list(prefix?: string): Promise<string[]> {
    const validatedPrefix = validatePrefix(prefix);
    const out: string[] = [];
    await collectFilePaths(this.#root, "", out);
    const filtered =
      validatedPrefix === "" ? out : out.filter((path) => path.startsWith(validatedPrefix));
    filtered.sort();
    return filtered;
  }

  async delete(path: string): Promise<void> {
    const key = validatePath(path);
    const { dir, leaf } = await this.#parentDirectory(key, false);
    try {
      await dir.removeEntry(leaf);
    } catch {
      throw new VfsNotFoundError(key);
    }
  }

  async copy(from: string, to: string): Promise<void> {
    const src = validatePath(from);
    const dst = validatePath(to);
    const bytes = await this.read(src);
    await this.write(dst, bytes);
  }

  async has(path: string): Promise<boolean> {
    const key = validatePath(path);
    try {
      await this.#fileHandle(key, false);
      return true;
    } catch (err) {
      if (err instanceof VfsNotFoundError) return false;
      throw err;
    }
  }

  async #fileHandle(path: string, create: boolean): Promise<FileSystemFileHandle> {
    const { dir, leaf } = await this.#parentDirectory(path, create);
    try {
      return await dir.getFileHandle(leaf, { create });
    } catch {
      throw new VfsNotFoundError(path);
    }
  }

  async #parentDirectory(
    path: string,
    create: boolean,
  ): Promise<{ dir: FileSystemDirectoryHandle; leaf: string }> {
    const parts = path.split("/");
    const leaf = parts.pop();
    if (leaf === undefined || leaf.length === 0) throw new VfsNotFoundError(path);
    let dir = this.#root;
    for (const part of parts) {
      try {
        dir = await dir.getDirectoryHandle(part, { create });
      } catch {
        throw new VfsNotFoundError(path);
      }
    }
    return { dir, leaf };
  }
}

export async function openOpfsDriver(options: OpfsDriverOptions = {}): Promise<OpfsDriver> {
  const getDirectory = options.getDirectory ?? globalThis.navigator?.storage?.getDirectory;
  if (getDirectory === undefined) {
    throw new Error("OpfsDriver: navigator.storage.getDirectory is unavailable.");
  }
  const root = await getDirectory.call(globalThis.navigator?.storage);
  return new OpfsDriver(root);
}

async function collectFilePaths(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  out: string[],
): Promise<void> {
  const iterable = dir as FileSystemDirectoryHandle & {
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  };
  for await (const [name, handle] of iterable.entries()) {
    const path = prefix === "" ? name : `${prefix}/${name}`;
    if (handle.kind === "file") {
      out.push(path);
    } else if (handle.kind === "directory") {
      await collectFilePaths(handle as FileSystemDirectoryHandle, path, out);
    }
  }
}

function cloneBytes(input: Uint8Array): Uint8Array {
  const copy = new Uint8Array(input.byteLength);
  copy.set(input);
  return copy;
}
