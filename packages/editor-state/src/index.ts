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

import type { Site } from "@sosb/schema";
import type { Vfs } from "@sosb/vfs";

/**
 * Path inside the auto-save VFS where the editor's persisted snapshot lives.
 * Stable across editor versions — `loadAutosave()` reads this same path on
 * boot to restore the snapshot.
 */
export const AUTOSAVE_PATH = "editor/autosave.json" as const;

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
      pendingWrite = writeSnapshot(vfs, snapshot);
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
        pendingWrite = writeSnapshot(vfs, snapshot);
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
async function writeSnapshot(vfs: Vfs, snapshot: Site): Promise<void> {
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
