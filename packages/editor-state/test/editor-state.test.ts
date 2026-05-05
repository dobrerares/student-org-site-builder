import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryDriver } from "@sosb/vfs";
import type { Site } from "@sosb/schema";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import {
  AUTOSAVE_PATH,
  createEditorState,
  loadAutosave,
  type EditorState,
} from "../src/index.js";

const baseSite = minimal as unknown as Site;

function clone(site: Site): Site {
  return structuredClone(site);
}

describe("createEditorState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("snapshot returns the initial site by deep-equal", () => {
    const state: EditorState = createEditorState({ initial: clone(baseSite) });
    expect(state.getSnapshot()).toEqual(baseSite);
  });

  test("update produces a new snapshot reflecting the change", () => {
    const state = createEditorState({ initial: clone(baseSite) });

    state.update((draft) => {
      draft.org.name = "Renamed Org";
    });

    expect(state.getSnapshot().org.name).toBe("Renamed Org");
  });

  test("update is immutable: previous snapshot keeps the old value", () => {
    const state = createEditorState({ initial: clone(baseSite) });
    const before = state.getSnapshot();

    state.update((draft) => {
      draft.org.name = "Renamed Org";
    });

    // Caller's earlier reference still sees the original org name.
    expect(before.org.name).toBe("Stub Org");
    expect(state.getSnapshot().org.name).toBe("Renamed Org");
    expect(state.getSnapshot()).not.toBe(before);
  });

  test("subscribers fire synchronously on every update", () => {
    const state = createEditorState({ initial: clone(baseSite) });
    const listener = vi.fn();
    state.subscribe(listener);

    state.update((draft) => {
      draft.org.tagline = "New tagline";
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0].org.tagline).toBe("New tagline");
  });

  test("subscribe returns an unsubscribe function", () => {
    const state = createEditorState({ initial: clone(baseSite) });
    const listener = vi.fn();
    const unsubscribe = state.subscribe(listener);

    unsubscribe();
    state.update((draft) => {
      draft.org.tagline = "Other tagline";
    });

    expect(listener).not.toHaveBeenCalled();
  });

  test("auto-save fires once after debounce window, regardless of edit count", async () => {
    const vfs = new MemoryDriver();
    const state = createEditorState({
      initial: clone(baseSite),
      vfs,
      debounceMs: 100,
    });

    state.update((draft) => {
      draft.org.name = "First";
    });
    state.update((draft) => {
      draft.org.name = "Second";
    });
    state.update((draft) => {
      draft.org.name = "Third";
    });

    // Before the debounce window elapses, no save is committed.
    expect(await vfs.has(AUTOSAVE_PATH)).toBe(false);

    await vi.advanceTimersByTimeAsync(100);

    // After the window, exactly one save is committed with the latest state.
    expect(await vfs.has(AUTOSAVE_PATH)).toBe(true);
    const persisted = await loadAutosave(vfs);
    expect(persisted?.org.name).toBe("Third");
  });

  test("loadAutosave returns null when no auto-save exists yet", async () => {
    const vfs = new MemoryDriver();
    expect(await loadAutosave(vfs)).toBeNull();
  });

  test("auto-save survives a 'reload' (new state restored from VFS)", async () => {
    const vfs = new MemoryDriver();
    const state = createEditorState({
      initial: clone(baseSite),
      vfs,
      debounceMs: 50,
    });

    state.update((draft) => {
      draft.org.name = "Persisted Org";
    });
    await vi.advanceTimersByTimeAsync(50);

    // Simulate a reload: load from VFS, hydrate a fresh EditorState.
    const restored = await loadAutosave(vfs);
    expect(restored).not.toBeNull();
    const second = createEditorState({ initial: restored!, vfs, debounceMs: 50 });
    expect(second.getSnapshot().org.name).toBe("Persisted Org");
  });

  test("flush() forces an immediate save without waiting for the debounce", async () => {
    const vfs = new MemoryDriver();
    const state = createEditorState({
      initial: clone(baseSite),
      vfs,
      debounceMs: 10000,
    });

    state.update((draft) => {
      draft.org.name = "Forced";
    });
    await state.flush();

    const persisted = await loadAutosave(vfs);
    expect(persisted?.org.name).toBe("Forced");
  });

  test("update propagates within the auto-save SLA (<200ms)", async () => {
    const vfs = new MemoryDriver();
    const state = createEditorState({
      initial: clone(baseSite),
      vfs,
      debounceMs: 150,
    });

    state.update((draft) => {
      draft.org.name = "SLA";
    });

    // 200ms later the auto-save MUST be committed (debounce <= 150ms).
    await vi.advanceTimersByTimeAsync(200);
    const persisted = await loadAutosave(vfs);
    expect(persisted?.org.name).toBe("SLA");
  });
});
