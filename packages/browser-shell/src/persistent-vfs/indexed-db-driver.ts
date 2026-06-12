/**
 * IndexedDB-backed `Vfs` driver.
 *
 * The browser shell wires this driver into `createEditorState({ vfs })` so
 * the editor's auto-saved snapshot survives page reloads. The driver is a
 * drop-in substitute for `MemoryDriver` — same `Vfs` surface, same
 * conformance contract.
 *
 * Storage model: a single object store keyed by path, with a
 * `Uint8Array`-shaped value. We store every entry as a fresh copy of the
 * caller's bytes so post-write mutation of the caller's buffer does not
 * leak into the stored data (the conformance suite asserts this).
 *
 * The driver requires `globalThis.indexedDB`. In tests we use
 * `fake-indexeddb/auto`. In production browsers it's the standard global.
 *
 * The driver does not own its database name — callers pass a stable name
 * (e.g. `"sosb:editor"` for v1) so multiple browser tabs of the same origin
 * see each other's writes.
 */

import type { Vfs } from "@sosb/vfs/vfs";
import { VfsNotFoundError } from "@sosb/vfs/errors";
import { validatePath, validatePrefix } from "@sosb/vfs/path";

/** Default object-store name. Stable across the v1.x series. */
const STORE = "vfs";
/** Object store schema version. Bump only on incompatible store changes. */
const DB_VERSION = 1;
/** Default database name when callers do not provide one. */
export const DEFAULT_DATABASE_NAME = "sosb:editor" as const;

export interface IndexedDbDriverOptions {
  /**
   * Database name. Multiple drivers opened against the same name share
   * storage; tabs of the same origin pointing at the same name see each
   * other's writes.
   */
  readonly databaseName?: string;
  /**
   * Object-store name inside the database. Defaults to `"vfs"`. Exposed for
   * tests; production callers should not override this.
   */
  readonly storeName?: string;
  /**
   * Optional override for the IndexedDB factory. Defaults to
   * `globalThis.indexedDB`. Tests inject a mock.
   */
  readonly indexedDB?: IDBFactory;
}

/**
 * `IndexedDbDriver` — IndexedDB-backed implementation of the `Vfs`
 * interface. Construct via `openIndexedDbDriver(opts)`; the constructor is
 * private to the module to ensure the database is open before any CRUD call
 * runs.
 */
export class IndexedDbDriver implements Vfs {
  readonly #db: IDBDatabase;
  readonly #storeName: string;

  /** @internal Use `openIndexedDbDriver` to construct. */
  constructor(db: IDBDatabase, storeName: string) {
    this.#db = db;
    this.#storeName = storeName;
  }

  async read(path: string): Promise<Uint8Array> {
    const key = validatePath(path);
    const bytes = await this.#runReadOnly((store) => store.get(key));
    if (bytes === undefined) throw new VfsNotFoundError(key);
    // Return a fresh copy so caller mutation does not corrupt the next read.
    return cloneBytes(bytes);
  }

  async write(path: string, bytes: Uint8Array): Promise<void> {
    const key = validatePath(path);
    // Defensive copy: mutate-after-write must not leak into stored bytes.
    const copy = cloneBytes(bytes);
    await this.#runReadWrite((store) => store.put(copy, key));
  }

  async list(prefix?: string): Promise<string[]> {
    const validatedPrefix = validatePrefix(prefix);
    const keys = await this.#runReadOnly((store) => store.getAllKeys());
    const out: string[] = [];
    for (const k of keys) {
      if (typeof k !== "string") continue;
      if (validatedPrefix === "" || k.startsWith(validatedPrefix)) {
        out.push(k);
      }
    }
    out.sort();
    return out;
  }

  async delete(path: string): Promise<void> {
    const key = validatePath(path);
    const exists = await this.#runReadOnly((store) => store.getKey(key));
    if (exists === undefined) throw new VfsNotFoundError(key);
    await this.#runReadWrite((store) => store.delete(key));
  }

  async copy(from: string, to: string): Promise<void> {
    const src = validatePath(from);
    const dst = validatePath(to);
    const bytes = await this.#runReadOnly((store) => store.get(src));
    if (bytes === undefined) throw new VfsNotFoundError(src);
    // Self-copy: store a fresh copy so source/destination buffers stay
    // independent (mirrors `MemoryDriver`).
    const copy = cloneBytes(bytes);
    await this.#runReadWrite((store) => store.put(copy, dst));
  }

  async has(path: string): Promise<boolean> {
    const key = validatePath(path);
    const found = await this.#runReadOnly((store) => store.getKey(key));
    return found !== undefined;
  }

  /**
   * Close the underlying database connection. Idempotent. After `close()`
   * any subsequent CRUD call rejects.
   *
   * Closing matters in tests (each test opens a fresh DB and we want the
   * connection released) and lets long-lived browser tabs re-open the DB
   * after a host-driven version bump.
   */
  close(): void {
    this.#db.close();
  }

  // -----------------------------------------------------------------
  // private helpers
  // -----------------------------------------------------------------

  #runReadOnly<T>(work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return this.#runTx("readonly", work);
  }

  #runReadWrite<T>(work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return this.#runTx("readwrite", work);
  }

  #runTx<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const tx = this.#db.transaction(this.#storeName, mode);
      const store = tx.objectStore(this.#storeName);
      const req = work(store);
      req.onsuccess = (): void => {
        resolve(req.result);
      };
      req.onerror = (): void => {
        reject(req.error ?? new Error("IndexedDB request failed"));
      };
      tx.onerror = (): void => {
        reject(tx.error ?? new Error("IndexedDB transaction failed"));
      };
      tx.onabort = (): void => {
        reject(tx.error ?? new Error("IndexedDB transaction aborted"));
      };
    });
  }
}

/**
 * Open (or create) the IndexedDB database and return a ready-to-use driver.
 *
 * Idempotent: opening the same database name multiple times is safe — each
 * call yields a fresh `IndexedDbDriver` instance bound to the same store.
 */
export function openIndexedDbDriver(
  options: IndexedDbDriverOptions = {},
): Promise<IndexedDbDriver> {
  const databaseName = options.databaseName ?? DEFAULT_DATABASE_NAME;
  const storeName = options.storeName ?? STORE;
  const factory = options.indexedDB ?? globalThis.indexedDB;
  if (factory === undefined) {
    throw new Error(
      "IndexedDbDriver: globalThis.indexedDB is unavailable. " +
        "Pass options.indexedDB explicitly (e.g. fake-indexeddb in tests).",
    );
  }
  return new Promise<IndexedDbDriver>((resolve, reject) => {
    const request = factory.open(databaseName, DB_VERSION);
    request.onupgradeneeded = (): void => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };
    request.onsuccess = (): void => {
      resolve(new IndexedDbDriver(request.result, storeName));
    };
    request.onerror = (): void => {
      reject(request.error ?? new Error("IndexedDB open failed"));
    };
    request.onblocked = (): void => {
      reject(new Error(`IndexedDB open blocked for database ${databaseName}`));
    };
  });
}

function cloneBytes(input: Uint8Array): Uint8Array {
  const copy = new Uint8Array(input.byteLength);
  copy.set(input);
  return copy;
}
