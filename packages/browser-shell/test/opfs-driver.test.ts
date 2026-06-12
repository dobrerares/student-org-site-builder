// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, expect, test } from "vitest";

import { runVfsConformance } from "@sosb/vfs/test-conformance";
import { openIndexedDbDriver } from "../src/persistent-vfs/indexed-db-driver.js";
import { openOpfsDriver } from "../src/persistent-vfs/opfs-driver.js";
import { openPreferredPersistentVfs } from "../src/persistent-vfs/preferred.js";

runVfsConformance("OpfsDriver", async () => {
  return openOpfsDriver({ getDirectory: async () => fakeRoot() });
});

describe("openPreferredPersistentVfs", () => {
  test("prefers OPFS when getDirectory succeeds", async () => {
    const vfs = await openPreferredPersistentVfs({
      opfs: { getDirectory: async () => fakeRoot() },
      indexedDb: { databaseName: freshDbName() },
    });
    await vfs.write("a.txt", new TextEncoder().encode("opfs"));
    expect(new TextDecoder().decode(await vfs.read("a.txt"))).toBe("opfs");
  });

  test("falls back to IndexedDB when OPFS is unavailable", async () => {
    const dbName = freshDbName();
    const vfs = await openPreferredPersistentVfs({
      opfs: {
        getDirectory: async () => {
          throw new Error("no opfs");
        },
      },
      indexedDb: { databaseName: dbName },
    });

    await vfs.write("fallback.txt", new TextEncoder().encode("indexeddb"));
    const reopened = await openIndexedDbDriver({ databaseName: dbName });
    expect(new TextDecoder().decode(await reopened.read("fallback.txt"))).toBe("indexeddb");
    reopened.close();
  });
});

let dbCounter = 0;
function freshDbName(): string {
  dbCounter += 1;
  return `sosb-opfs-fallback-${Date.now()}-${dbCounter}`;
}

function fakeRoot(): FileSystemDirectoryHandle {
  return new FakeDirectoryHandle("") as unknown as FileSystemDirectoryHandle;
}

class FakeFileHandle {
  readonly kind = "file";
  readonly name: string;
  bytes = new Uint8Array(0);

  constructor(name: string) {
    this.name = name;
  }

  async getFile(): Promise<File> {
    const bytes = cloneBytes(this.bytes);
    return {
      name: this.name,
      async arrayBuffer(): Promise<ArrayBuffer> {
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      },
    } as unknown as File;
  }

  async createWritable(): Promise<FileSystemWritableFileStream> {
    let pending = new Uint8Array(0);
    return {
      write: async (data: BlobPart): Promise<void> => {
        if (data instanceof Uint8Array) {
          pending = cloneBytes(data);
          return;
        }
        if (data instanceof ArrayBuffer) {
          pending = new Uint8Array(data.slice(0));
          return;
        }
        if (data instanceof Blob) {
          pending = new Uint8Array(await data.arrayBuffer());
          return;
        }
        pending = new TextEncoder().encode(String(data));
      },
      close: async (): Promise<void> => {
        this.bytes = cloneBytes(pending);
      },
      async abort(): Promise<void> {},
      async seek(): Promise<void> {},
      async truncate(): Promise<void> {},
      locked: false,
      getWriter() {
        throw new Error("not implemented");
      },
    } as unknown as FileSystemWritableFileStream;
  }
}

class FakeDirectoryHandle {
  readonly kind = "directory";
  readonly name: string;
  readonly children = new Map<string, FakeDirectoryHandle | FakeFileHandle>();

  constructor(name: string) {
    this.name = name;
  }

  async getDirectoryHandle(
    name: string,
    options?: FileSystemGetDirectoryOptions,
  ): Promise<FileSystemDirectoryHandle> {
    const existing = this.children.get(name);
    if (existing instanceof FakeDirectoryHandle)
      return existing as unknown as FileSystemDirectoryHandle;
    if (existing !== undefined) throw new DOMException("Not a directory", "TypeMismatchError");
    if (options?.create !== true) throw new DOMException("Not found", "NotFoundError");
    const next = new FakeDirectoryHandle(name);
    this.children.set(name, next);
    return next as unknown as FileSystemDirectoryHandle;
  }

  async getFileHandle(
    name: string,
    options?: FileSystemGetFileOptions,
  ): Promise<FileSystemFileHandle> {
    const existing = this.children.get(name);
    if (existing instanceof FakeFileHandle) return existing as unknown as FileSystemFileHandle;
    if (existing !== undefined) throw new DOMException("Not a file", "TypeMismatchError");
    if (options?.create !== true) throw new DOMException("Not found", "NotFoundError");
    const next = new FakeFileHandle(name);
    this.children.set(name, next);
    return next as unknown as FileSystemFileHandle;
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.children.delete(name)) throw new DOMException("Not found", "NotFoundError");
  }

  async *entries(): AsyncIterableIterator<[string, FileSystemHandle]> {
    for (const [name, handle] of this.children) {
      yield [name, handle as unknown as FileSystemHandle];
    }
  }
}

function cloneBytes(input: Uint8Array): Uint8Array {
  const copy = new Uint8Array(input.byteLength);
  copy.set(input);
  return copy;
}
