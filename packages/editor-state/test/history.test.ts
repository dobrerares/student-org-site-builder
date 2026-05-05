/**
 * Tests for the history store: snapshot-stack-based undo/redo with FIFO
 * eviction. Owned by issue #27.
 *
 * Contract:
 * - `createHistoryStore({ initial, capacity })` produces a store seeded with
 *   the initial snapshot.
 * - `push(snapshot)` records a new snapshot (truncating any redo branch).
 * - `undo()` returns the previous snapshot or `null` when at the bottom.
 * - `redo()` returns the next snapshot or `null` when at the top.
 * - Capacity bounds the stack: when the stack exceeds capacity, the oldest
 *   snapshot is evicted FIFO. Default capacity is 50 per the AC.
 * - `canUndo()` / `canRedo()` reflect availability without mutating state.
 */
import { describe, expect, test } from "vitest";

import { createHistoryStore } from "../src/index.js";

describe("createHistoryStore", () => {
  test("seeded with initial snapshot, cannot undo or redo", () => {
    const store = createHistoryStore({ initial: { v: 0 } });

    expect(store.canUndo()).toBe(false);
    expect(store.canRedo()).toBe(false);
    expect(store.undo()).toBeNull();
    expect(store.redo()).toBeNull();
  });

  test("push records a snapshot and enables undo", () => {
    const store = createHistoryStore({ initial: { v: 0 } });

    store.push({ v: 1 });

    expect(store.canUndo()).toBe(true);
    expect(store.canRedo()).toBe(false);
  });

  test("undo returns the previous snapshot and enables redo", () => {
    const store = createHistoryStore<{ v: number }>({ initial: { v: 0 } });
    store.push({ v: 1 });
    store.push({ v: 2 });

    expect(store.undo()).toEqual({ v: 1 });
    expect(store.canUndo()).toBe(true);
    expect(store.canRedo()).toBe(true);
    expect(store.undo()).toEqual({ v: 0 });
    expect(store.canUndo()).toBe(false);
    expect(store.canRedo()).toBe(true);
  });

  test("redo returns the next snapshot and walks forward", () => {
    const store = createHistoryStore<{ v: number }>({ initial: { v: 0 } });
    store.push({ v: 1 });
    store.push({ v: 2 });
    store.undo();
    store.undo();

    expect(store.redo()).toEqual({ v: 1 });
    expect(store.redo()).toEqual({ v: 2 });
    expect(store.canRedo()).toBe(false);
  });

  test("push after undo truncates the redo branch", () => {
    const store = createHistoryStore<{ v: number }>({ initial: { v: 0 } });
    store.push({ v: 1 });
    store.push({ v: 2 });
    store.undo();
    // Now at v:1 with v:2 in the redo branch.
    store.push({ v: 99 });

    expect(store.canRedo()).toBe(false);
    expect(store.undo()).toEqual({ v: 1 });
    expect(store.undo()).toEqual({ v: 0 });
  });

  test("capacity bounds the stack via FIFO eviction of oldest snapshots", () => {
    // capacity 3 means the stack holds 3 entries total (current + history).
    const store = createHistoryStore<{ v: number }>({
      initial: { v: 0 },
      capacity: 3,
    });
    store.push({ v: 1 });
    store.push({ v: 2 });
    // Stack is [0, 1, 2]; current = 2.
    store.push({ v: 3 });
    // Adding v:3 evicts v:0; stack becomes [1, 2, 3]; current = 3.

    expect(store.undo()).toEqual({ v: 2 });
    expect(store.undo()).toEqual({ v: 1 });
    // We hit the bottom — v:0 was evicted.
    expect(store.canUndo()).toBe(false);
    expect(store.undo()).toBeNull();
  });

  test("capacity defaults to 50 when not supplied", () => {
    const store = createHistoryStore<{ v: number }>({ initial: { v: 0 } });
    // Push 60 entries; oldest 10 should be evicted, leaving 49 undoable.
    for (let i = 1; i <= 60; i++) {
      store.push({ v: i });
    }
    let undos = 0;
    while (store.canUndo()) {
      store.undo();
      undos++;
    }
    expect(undos).toBe(49);
  });

  test("snapshots are stored as supplied references", () => {
    const initial = { v: 0 };
    const next = { v: 1 };
    const store = createHistoryStore<{ v: number }>({ initial });
    store.push(next);

    // The store does not deep-clone; callers own the cloning policy. This
    // matches `createEditorState`'s deep-clone-on-update pattern, where the
    // pushed object is already a fresh snapshot.
    const popped = store.undo();
    expect(popped).toBe(initial);
  });
});
