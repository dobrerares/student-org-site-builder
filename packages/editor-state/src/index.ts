/**
 * `@sosb/editor-state` — live document model with debounced auto-save.
 *
 * The editor's source of truth is a single `Site` object held in memory.
 * Forms (and any future block UI) call `update(updater)` to mutate a draft;
 * subscribers re-render on every change. A debounced auto-save serialises
 * the latest snapshot to a backing VFS at `AUTOSAVE_PATH`. On reload, the
 * editor calls `loadAutosave(vfs)` to restore the last-saved snapshot.
 *
 * The package is intentionally framework-agnostic — it has no Preact
 * dependency. The Preact-specific binding lives in `@sosb/editor-app`.
 *
 * Tracking issue: #7. ADR 0005 records the design.
 */

import type { BlockEnvelope, Site } from "@sosb/schema";
import type { Vfs } from "@sosb/vfs/vfs";

/**
 * Path inside the auto-save VFS where the editor's persisted snapshot lives.
 * Stable across editor versions — `loadAutosave()` reads this same path on
 * boot to restore the snapshot.
 */
export const AUTOSAVE_PATH = "editor/autosave.json" as const;

/**
 * Path inside the editor's VFS where the undo/redo stack is persisted. The
 * format is `SerializedHistory<Site>` JSON. Owned by issue #27.
 */
export const HISTORY_PATH = "editor/history.json" as const;

/**
 * The 2-space JSON indent matches `@sosb/zip`'s export. The editor's
 * persisted snapshots are byte-identical to the zip's `data.json` for the
 * same site, which keeps debugging simple.
 */
const AUTOSAVE_INDENT = 2;

const DEFAULT_DEBOUNCE_MS = 250;

const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: false });

export interface EditorStateOptions {
  /** The initial site loaded into the model. */
  readonly initial: Site;
  /** Optional VFS to auto-save snapshots into. Omit for ephemeral state. */
  readonly vfs?: Vfs;
  /**
   * Debounce window in milliseconds before a serialise-and-write to the
   * backing VFS. Defaults to 250ms. The editor's live-update SLA (200ms
   * to preview) is independent — that path is owned by the preview-bridge
   * subscriber, not by auto-save.
   */
  readonly debounceMs?: number;
}

export interface EditorState {
  /** Read the current snapshot. The returned object is owned by the state. */
  getSnapshot(): Site;
  /** Apply a draft mutation. The updater receives a deep-cloned working copy. */
  update(updater: (draft: Site) => void): void;
  /**
   * Subscribe to snapshot changes. The listener fires synchronously after
   * every successful `update()`. Returns an unsubscribe function.
   */
  subscribe(listener: (snapshot: Site) => void): () => void;
  /**
   * Force a pending auto-save to commit immediately, bypassing the debounce
   * timer. Resolves once the write completes (or no-ops if no VFS was
   * provided or no save is pending).
   */
  flush(): Promise<void>;
}

/**
 * Build an in-memory editor state model around the given site.
 *
 * The contract:
 *   - `getSnapshot()` returns the current site (a stable reference until the
 *     next `update`).
 *   - `update(fn)` deep-clones the snapshot, hands the clone to `fn`, then
 *     stores the mutated clone as the new snapshot. Subscribers fire.
 *   - When `vfs` is supplied, every update schedules a debounced auto-save.
 *     Calls within the debounce window collapse into a single write of the
 *     latest snapshot.
 */
export function createEditorState(options: EditorStateOptions): EditorState {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const vfs = options.vfs;

  let snapshot: Site = options.initial;
  const listeners = new Set<(snapshot: Site) => void>();

  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingWrite: Promise<void> | null = null;

  function notify(): void {
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function scheduleAutosave(): void {
    if (vfs === undefined) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      pendingWrite = saveAutosave(vfs, snapshot);
    }, debounceMs);
  }

  return {
    getSnapshot(): Site {
      return snapshot;
    },

    update(updater: (draft: Site) => void): void {
      const draft = structuredClone(snapshot);
      updater(draft);
      snapshot = draft;
      notify();
      scheduleAutosave();
    },

    subscribe(listener: (snapshot: Site) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async flush(): Promise<void> {
      if (vfs === undefined) return;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
        pendingWrite = saveAutosave(vfs, snapshot);
      }
      if (pendingWrite !== null) {
        await pendingWrite;
        pendingWrite = null;
      }
    },
  };
}

/**
 * Serialise the snapshot at `AUTOSAVE_PATH` in the given VFS. Format
 * matches `@sosb/zip`'s `data.json` (UTF-8, 2-space indent, trailing
 * newline) so the auto-save is byte-identical to the equivalent export.
 */
export async function saveAutosave(vfs: Vfs, snapshot: Site): Promise<void> {
  const text = JSON.stringify(snapshot, null, AUTOSAVE_INDENT) + "\n";
  await vfs.write(AUTOSAVE_PATH, enc.encode(text));
}

/**
 * Read back the most recent auto-saved snapshot from the given VFS.
 *
 * Returns `null` when no snapshot exists yet (first-launch case). Throws
 * on malformed JSON; callers can treat that as a corrupt-state warning.
 *
 * The returned object is the parsed JSON — no schema validation is applied
 * here. Callers that want a hard schema gate should run `@sosb/schema`'s
 * `validate()` afterwards. (For the editor's own boot path this is the
 * editor's responsibility, not this module's.)
 */
export async function loadAutosave(vfs: Vfs): Promise<Site | null> {
  if (!(await vfs.has(AUTOSAVE_PATH))) return null;
  const bytes = await vfs.read(AUTOSAVE_PATH);
  const text = dec.decode(bytes);
  return JSON.parse(text) as Site;
}

/**
 * Default depth of the undo stack. Per issue #27's AC: bounded with FIFO
 * eviction of the oldest snapshot once the cap is reached.
 */
export const DEFAULT_HISTORY_CAPACITY = 50 as const;

export interface HistoryStoreOptions<T> {
  /** Snapshot the store starts at. Cannot be undone past. */
  readonly initial: T;
  /**
   * Maximum number of snapshots retained (current + history). Once exceeded,
   * the oldest snapshot is dropped to bound memory. Defaults to 50.
   */
  readonly capacity?: number;
}

export interface HistoryStore<T> {
  /** Record a new snapshot. Truncates any redo-branch entries. */
  push(snapshot: T): void;
  /** Step back one snapshot. Returns the new current snapshot or `null`. */
  undo(): T | null;
  /** Step forward one snapshot. Returns the new current snapshot or `null`. */
  redo(): T | null;
  /** Whether at least one prior snapshot is available. */
  canUndo(): boolean;
  /** Whether at least one forward snapshot is available. */
  canRedo(): boolean;
  /** Internal: read the live entries (used by `serializeHistory`). */
  _entries(): readonly T[];
  /** Internal: read the live cursor (used by `serializeHistory`). */
  _cursor(): number;
  /** Internal: read the configured capacity (used by `serializeHistory`). */
  _capacity(): number;
}

/**
 * Plain-data form of a history store, suitable for persistence to a VFS.
 *
 * The shape is intentionally JSON-friendly (no class instances, no
 * functions) so a host can `JSON.stringify` it and write it next to the
 * `editor/autosave.json` file. Restoring is `deserializeHistory` of the
 * parsed object.
 */
export interface SerializedHistory<T> {
  readonly entries: readonly T[];
  readonly cursor: number;
  readonly capacity?: number;
}

/**
 * Insert `block` at the end of the named page's block list.
 *
 * Returns a deep-cloned site so the caller can hand it straight to the
 * history store. Throws when no page on the site matches `pageSlug`.
 */
export function addBlockToPage(site: Site, pageSlug: string, block: BlockEnvelope): Site {
  const next = structuredClone(site);
  const page = next.pages.find((p) => p.slug === pageSlug);
  if (page === undefined) {
    throw new Error(`addBlockToPage: no page with slug "${pageSlug}"`);
  }
  page.blocks.push(block);
  return next;
}

/**
 * Remove the block whose `id` matches `blockId` from the named page.
 *
 * Returns a deep-cloned site. Throws when no block with that id is on the
 * page (the caller likely has stale state and should refresh).
 */
export function removeBlockFromPage(site: Site, pageSlug: string, blockId: string): Site {
  const next = structuredClone(site);
  const page = next.pages.find((p) => p.slug === pageSlug);
  if (page === undefined) {
    throw new Error(`removeBlockFromPage: no page with slug "${pageSlug}"`);
  }
  const idx = page.blocks.findIndex((b) => b.id === blockId);
  if (idx === -1) {
    throw new Error(`removeBlockFromPage: block "${blockId}" not on page "${pageSlug}"`);
  }
  page.blocks.splice(idx, 1);
  return next;
}

/**
 * Move a block on a page from index `from` to index `to`.
 *
 * Indices follow array semantics: `to` is the destination index *after* the
 * block has been removed from `from`. A `to` index past the end of the array
 * is clamped to the array's last position. Throws when `from` is out of
 * bounds. Returns a deep-cloned site.
 */
export function moveBlockInPage(site: Site, pageSlug: string, from: number, to: number): Site {
  const next = structuredClone(site);
  const page = next.pages.find((p) => p.slug === pageSlug);
  if (page === undefined) {
    throw new Error(`moveBlockInPage: no page with slug "${pageSlug}"`);
  }
  if (from < 0 || from >= page.blocks.length) {
    throw new Error(
      `moveBlockInPage: from index ${from} out of bounds on page "${pageSlug}" (length ${page.blocks.length})`,
    );
  }
  const [block] = page.blocks.splice(from, 1);
  if (block === undefined) {
    // unreachable given the bounds check above
    throw new Error("moveBlockInPage: splice returned undefined");
  }
  const clampedTo = Math.max(0, Math.min(to, page.blocks.length));
  page.blocks.splice(clampedTo, 0, block);
  return next;
}

/**
 * Build a snapshot-stack-based undo/redo history store.
 *
 * The store is generic over the snapshot type so it stays decoupled from
 * `Site`. The editor wires the store up against `Site` in
 * `@sosb/editor-app`.
 *
 * Snapshots are stored by reference; the caller is expected to push fresh
 * (already-cloned) objects, the same convention `createEditorState.update`
 * uses internally.
 */
export function createHistoryStore<T>(options: HistoryStoreOptions<T>): HistoryStore<T> {
  const capacity = options.capacity ?? DEFAULT_HISTORY_CAPACITY;
  if (capacity < 1) {
    throw new Error(`createHistoryStore: capacity must be >= 1, got ${capacity}`);
  }

  const stack: T[] = [options.initial];
  // `cursor` is the index of the current snapshot in `stack`.
  let cursor = 0;

  return {
    push(snapshot: T): void {
      // Truncate the redo branch.
      if (cursor < stack.length - 1) {
        stack.length = cursor + 1;
      }
      stack.push(snapshot);
      cursor = stack.length - 1;
      // Bound capacity by FIFO-evicting the oldest.
      while (stack.length > capacity) {
        stack.shift();
        cursor--;
      }
    },
    undo(): T | null {
      if (cursor <= 0) return null;
      cursor--;
      return stack[cursor] ?? null;
    },
    redo(): T | null {
      if (cursor >= stack.length - 1) return null;
      cursor++;
      return stack[cursor] ?? null;
    },
    canUndo(): boolean {
      return cursor > 0;
    },
    canRedo(): boolean {
      return cursor < stack.length - 1;
    },
    _entries(): readonly T[] {
      return stack;
    },
    _cursor(): number {
      return cursor;
    },
    _capacity(): number {
      return capacity;
    },
  };
}

/**
 * Snapshot a history store to a plain JSON-serialisable shape.
 *
 * The returned object copies the entries array (so subsequent mutations on
 * the live store do not bleed into the snapshot). The capacity field is
 * preserved so a restore round-trips the bound.
 */
export function serializeHistory<T>(store: HistoryStore<T>): SerializedHistory<T> {
  return {
    entries: [...store._entries()],
    cursor: store._cursor(),
    capacity: store._capacity(),
  };
}

/**
 * Rebuild a history store from a `SerializedHistory<T>` snapshot.
 *
 * The first entry is treated as the seed (its index 0 is the bottom of the
 * undo stack); subsequent entries are pushed in order, with the cursor
 * restored at the end. The optional `capacity` override allows the caller
 * to change the cap without reseeding the stack.
 */
export function deserializeHistory<T>(snapshot: SerializedHistory<T>): HistoryStore<T> {
  if (snapshot.entries.length === 0) {
    throw new Error("deserializeHistory: cannot restore from empty entries");
  }
  const initial = snapshot.entries[0];
  if (initial === undefined) {
    // unreachable given the length check above
    throw new Error("deserializeHistory: missing initial entry");
  }
  const store = createHistoryStore<T>(
    snapshot.capacity === undefined ? { initial } : { initial, capacity: snapshot.capacity },
  );
  for (let i = 1; i < snapshot.entries.length; i++) {
    const entry = snapshot.entries[i];
    if (entry !== undefined) store.push(entry);
  }
  // Walk the cursor back to where the original was pointing. Simpler than
  // exposing a setter, and the resulting state is observationally identical.
  const liveLen = store._entries().length;
  const desiredCursor = Math.min(snapshot.cursor, liveLen - 1);
  const stepsBack = liveLen - 1 - desiredCursor;
  for (let i = 0; i < stepsBack; i++) {
    store.undo();
  }
  return store;
}

/**
 * Persist the history stack to a VFS at `HISTORY_PATH`.
 *
 * Format: 2-space JSON, UTF-8, trailing newline — matches the autosave
 * format so the bytes are inspectable side-by-side.
 */
export async function saveHistory<T>(vfs: Vfs, store: HistoryStore<T>): Promise<void> {
  const text = JSON.stringify(serializeHistory(store), null, AUTOSAVE_INDENT) + "\n";
  await vfs.write(HISTORY_PATH, enc.encode(text));
}

/**
 * Load a previously-persisted history stack from a VFS. Returns `null` when
 * no history has been written yet (first launch).
 */
export async function loadHistory<T>(vfs: Vfs): Promise<HistoryStore<T> | null> {
  if (!(await vfs.has(HISTORY_PATH))) return null;
  const bytes = await vfs.read(HISTORY_PATH);
  const text = dec.decode(bytes);
  const parsed = JSON.parse(text) as SerializedHistory<T>;
  return deserializeHistory<T>(parsed);
}
