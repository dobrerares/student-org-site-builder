/**
 * Tests for history-store persistence: the stack survives auto-save and
 * round-trips through JSON serialization (so a host can write/read it
 * through the VFS).
 *
 * Owned by issue #27.
 */
import { describe, expect, test } from "vitest";

import { MemoryDriver } from "@sosb/vfs";

import {
  createHistoryStore,
  serializeHistory,
  deserializeHistory,
  saveHistory,
  loadHistory,
  HISTORY_PATH,
} from "../src/index.js";

describe("history serialization round-trip", () => {
  test("serializeHistory returns the current stack and cursor", () => {
    const store = createHistoryStore<{ v: number }>({ initial: { v: 0 } });
    store.push({ v: 1 });
    store.push({ v: 2 });
    store.undo(); // cursor at v:1, redo branch contains v:2

    const snapshot = serializeHistory(store);

    expect(snapshot.entries.length).toBe(3);
    expect(snapshot.entries[0]).toEqual({ v: 0 });
    expect(snapshot.entries[2]).toEqual({ v: 2 });
    expect(snapshot.cursor).toBe(1);
  });

  test("deserializeHistory rebuilds a store with identical undo/redo behavior", () => {
    const original = createHistoryStore<{ v: number }>({ initial: { v: 0 } });
    original.push({ v: 1 });
    original.push({ v: 2 });

    const snapshot = serializeHistory(original);
    const restored = deserializeHistory<{ v: number }>(snapshot);

    expect(restored.canUndo()).toBe(true);
    expect(restored.canRedo()).toBe(false);
    expect(restored.undo()).toEqual({ v: 1 });
    expect(restored.undo()).toEqual({ v: 0 });
    expect(restored.canUndo()).toBe(false);
    restored.push({ v: 99 });
    expect(restored.canRedo()).toBe(false);
  });

  test("serialized form is JSON-stringifiable", () => {
    const store = createHistoryStore<{ v: number }>({ initial: { v: 0 } });
    store.push({ v: 1 });
    const snapshot = serializeHistory(store);
    const text = JSON.stringify(snapshot);
    const parsed = JSON.parse(text) as ReturnType<typeof serializeHistory<{ v: number }>>;
    const restored = deserializeHistory<{ v: number }>(parsed);
    expect(restored.canUndo()).toBe(true);
    expect(restored.undo()).toEqual({ v: 0 });
  });

  test("deserializeHistory respects the supplied capacity by enforcing it on push", () => {
    const original = createHistoryStore<{ v: number }>({ initial: { v: 0 } });
    original.push({ v: 1 });
    const snapshot = serializeHistory(original);
    // capacity 2 means once we add a third entry, the oldest is dropped.
    const restored = deserializeHistory<{ v: number }>({ ...snapshot, capacity: 2 });
    restored.push({ v: 2 });
    // Stack was [0, 1], pushed 2 -> capacity-2 keeps last 2 -> [1, 2].
    restored.undo(); // back to v:1
    expect(restored.canUndo()).toBe(false);
  });
});

describe("VFS-backed history persistence", () => {
  test("saveHistory writes to HISTORY_PATH and loadHistory restores", async () => {
    const vfs = new MemoryDriver();
    const store = createHistoryStore<{ v: number }>({ initial: { v: 0 } });
    store.push({ v: 1 });
    store.push({ v: 2 });

    await saveHistory(vfs, store);

    expect(await vfs.has(HISTORY_PATH)).toBe(true);
    const restored = await loadHistory<{ v: number }>(vfs);
    expect(restored).not.toBeNull();
    expect(restored?.canUndo()).toBe(true);
    expect(restored?.undo()).toEqual({ v: 1 });
    expect(restored?.undo()).toEqual({ v: 0 });
  });

  test("loadHistory returns null when no history file exists", async () => {
    const vfs = new MemoryDriver();
    const restored = await loadHistory<{ v: number }>(vfs);
    expect(restored).toBeNull();
  });
});
