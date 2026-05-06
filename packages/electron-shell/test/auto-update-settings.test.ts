import { describe, expect, test } from "vitest";
import {
  DEFAULT_AUTO_UPDATE_SETTINGS,
  loadAutoUpdateSettings,
  saveAutoUpdateSettings,
  declineUpdateVersion,
  isVersionDeclined,
  type AutoUpdateSettings,
  type AutoUpdateSettingsStore,
} from "../src/auto-update-settings.js";

/**
 * AC (issue #36):
 *
 * - Auto-check setting persists across app launches; default is ON.
 * - User-declined updates do NOT auto-install on the next launch.
 *
 * The settings store is a tiny `read` / `write` interface so the same
 * logic runs against an in-memory object in tests and against a JSON file
 * inside `app.getPath("userData")` at runtime — same shape as the
 * recent-sites store.
 */

function memoryStore(initial?: Partial<AutoUpdateSettings>): AutoUpdateSettingsStore {
  let state: AutoUpdateSettings = { ...DEFAULT_AUTO_UPDATE_SETTINGS, ...initial };
  return {
    read: () => ({ ...state, declinedVersions: [...state.declinedVersions] }),
    write: (next) => {
      state = { ...next, declinedVersions: [...next.declinedVersions] };
    },
  };
}

describe("auto-update settings", () => {
  test("DEFAULT_AUTO_UPDATE_SETTINGS has auto-check ON by default", () => {
    expect(DEFAULT_AUTO_UPDATE_SETTINGS.autoCheckEnabled).toBe(true);
  });

  test("DEFAULT_AUTO_UPDATE_SETTINGS has an empty declinedVersions list", () => {
    expect(DEFAULT_AUTO_UPDATE_SETTINGS.declinedVersions).toEqual([]);
  });

  test("loadAutoUpdateSettings returns the persisted settings", () => {
    const store = memoryStore({ autoCheckEnabled: false });
    expect(loadAutoUpdateSettings(store).autoCheckEnabled).toBe(false);
  });

  test("saveAutoUpdateSettings persists changes", () => {
    const store = memoryStore();
    saveAutoUpdateSettings(store, {
      autoCheckEnabled: false,
      declinedVersions: ["1.2.3"],
    });
    const loaded = loadAutoUpdateSettings(store);
    expect(loaded.autoCheckEnabled).toBe(false);
    expect(loaded.declinedVersions).toEqual(["1.2.3"]);
  });

  test("declineUpdateVersion appends to declinedVersions", () => {
    const store = memoryStore();
    declineUpdateVersion(store, "1.2.3");
    expect(loadAutoUpdateSettings(store).declinedVersions).toEqual(["1.2.3"]);
  });

  test("declineUpdateVersion is idempotent (no duplicates)", () => {
    const store = memoryStore();
    declineUpdateVersion(store, "1.2.3");
    declineUpdateVersion(store, "1.2.3");
    expect(loadAutoUpdateSettings(store).declinedVersions).toEqual(["1.2.3"]);
  });

  test("declineUpdateVersion preserves existing entries", () => {
    const store = memoryStore({ declinedVersions: ["1.2.0"] });
    declineUpdateVersion(store, "1.2.3");
    expect(loadAutoUpdateSettings(store).declinedVersions).toEqual(["1.2.0", "1.2.3"]);
  });

  test("isVersionDeclined returns true for declined versions", () => {
    const store = memoryStore({ declinedVersions: ["1.2.3"] });
    expect(isVersionDeclined(store, "1.2.3")).toBe(true);
  });

  test("isVersionDeclined returns false for non-declined versions", () => {
    const store = memoryStore({ declinedVersions: ["1.2.3"] });
    expect(isVersionDeclined(store, "1.2.4")).toBe(false);
  });

  test("isVersionDeclined returns false on a fresh store", () => {
    const store = memoryStore();
    expect(isVersionDeclined(store, "1.2.3")).toBe(false);
  });
});
