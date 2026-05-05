import { describe, expect, test } from "vitest";
import { MemoryDriver } from "@sosb/vfs";

import {
  WIZARD_PROGRESS_PATH,
  loadWizardProgress,
  saveWizardProgress,
  clearWizardProgress,
} from "../src/persistence.js";
import { createInitialState, patch, next, type WizardState } from "../src/state-machine.js";

/**
 * Wizard persistence — covers AC for issue #33:
 *
 *   "State persists across page reloads / app restarts mid-wizard."
 *
 * The persistence module mirrors `@sosb/editor-state`'s autosave model:
 * VFS-backed, caller-injected driver, single file at a stable path. The
 * v1 browser host wires a localStorage-backed VFS; the v1 Electron host
 * wires a real-FS driver. Both will round-trip the same JSON.
 */

const enc = new TextEncoder();

describe("WIZARD_PROGRESS_PATH", () => {
  test("is a stable string the host can rely on", () => {
    expect(WIZARD_PROGRESS_PATH).toBe("wizard/progress.json");
  });
});

describe("loadWizardProgress", () => {
  test("returns null when no saved progress exists (first launch)", async () => {
    const vfs = new MemoryDriver();
    const result = await loadWizardProgress(vfs);
    expect(result).toBeNull();
  });

  test("returns null when the file is malformed JSON (does not throw)", async () => {
    const vfs = new MemoryDriver();
    await vfs.write(WIZARD_PROGRESS_PATH, enc.encode("{not json"));
    const result = await loadWizardProgress(vfs);
    expect(result).toBeNull();
  });

  test("returns null when the file is JSON but not a valid WizardState", async () => {
    const vfs = new MemoryDriver();
    await vfs.write(WIZARD_PROGRESS_PATH, enc.encode(JSON.stringify({ totally: "wrong" })));
    const result = await loadWizardProgress(vfs);
    expect(result).toBeNull();
  });

  test("returns null when the saved 'step' is not one of the six step ids", async () => {
    const vfs = new MemoryDriver();
    await vfs.write(
      WIZARD_PROGRESS_PATH,
      enc.encode(JSON.stringify({ step: "deprecated-step", data: {} })),
    );
    const result = await loadWizardProgress(vfs);
    expect(result).toBeNull();
  });
});

describe("saveWizardProgress + loadWizardProgress round-trip", () => {
  test("save → load round-trips the active step", async () => {
    const vfs = new MemoryDriver();
    let state: WizardState = createInitialState();
    state = patch(state, "basics", { name: "HISTORIPOL" });
    state = next(state);
    expect(state.step).toBe("identity");

    await saveWizardProgress(vfs, state);
    const restored = await loadWizardProgress(vfs);
    expect(restored).not.toBeNull();
    expect(restored!.step).toBe("identity");
  });

  test("save → load round-trips per-step data", async () => {
    const vfs = new MemoryDriver();
    let state: WizardState = createInitialState();
    state = patch(state, "basics", {
      name: "HISTORIPOL",
      tagline: "Studenți care fac istorie.",
      foundedYear: 2024,
    });
    state = next(state);
    state = patch(state, "identity", { themeId: "academic" });

    await saveWizardProgress(vfs, state);
    const restored = await loadWizardProgress(vfs);
    expect(restored).not.toBeNull();
    expect(restored!.data.basics?.name).toBe("HISTORIPOL");
    expect(restored!.data.basics?.foundedYear).toBe(2024);
    expect(restored!.data.identity?.themeId).toBe("academic");
  });

  test("save twice replaces the prior file (last writer wins)", async () => {
    const vfs = new MemoryDriver();
    let state: WizardState = createInitialState();
    state = patch(state, "basics", { name: "First" });
    await saveWizardProgress(vfs, state);

    state = patch(state, "basics", { name: "Second" });
    await saveWizardProgress(vfs, state);

    const restored = await loadWizardProgress(vfs);
    expect(restored?.data.basics?.name).toBe("Second");
  });
});

describe("clearWizardProgress", () => {
  test("removes the saved progress file", async () => {
    const vfs = new MemoryDriver();
    const state = createInitialState();
    await saveWizardProgress(vfs, state);
    expect(await vfs.has(WIZARD_PROGRESS_PATH)).toBe(true);

    await clearWizardProgress(vfs);
    expect(await vfs.has(WIZARD_PROGRESS_PATH)).toBe(false);
  });

  test("clearing when no file exists is a no-op (does not throw)", async () => {
    const vfs = new MemoryDriver();
    await expect(clearWizardProgress(vfs)).resolves.toBeUndefined();
  });

  test("after clearing, loadWizardProgress returns null again", async () => {
    const vfs = new MemoryDriver();
    const state = createInitialState();
    await saveWizardProgress(vfs, state);
    await clearWizardProgress(vfs);

    const restored = await loadWizardProgress(vfs);
    expect(restored).toBeNull();
  });
});

describe("save format — JSON shape", () => {
  test("save writes UTF-8 JSON with a trailing newline (matches editor-state)", async () => {
    const vfs = new MemoryDriver();
    const state = createInitialState();
    await saveWizardProgress(vfs, state);

    const bytes = await vfs.read(WIZARD_PROGRESS_PATH);
    const text = new TextDecoder().decode(bytes);
    expect(text.endsWith("\n")).toBe(true);
    const parsed = JSON.parse(text.trimEnd());
    expect(parsed.step).toBe("basics");
  });
});
