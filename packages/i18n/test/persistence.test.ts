import { describe, expect, test } from "vitest";
import { MemoryDriver } from "@sosb/vfs";

import { LOCALE_PREFERENCE_PATH, loadStoredLocale, saveLocale } from "../src/index.js";

describe("locale persistence (VFS-backed)", () => {
  const supported = ["en", "ro"] as const;

  test("returns null when no locale has been saved", async () => {
    const vfs = new MemoryDriver();
    expect(await loadStoredLocale(vfs, supported)).toBeNull();
  });

  test("round-trips a saved locale", async () => {
    const vfs = new MemoryDriver();
    await saveLocale(vfs, "ro");
    expect(await loadStoredLocale(vfs, supported)).toBe("ro");
    await saveLocale(vfs, "en");
    expect(await loadStoredLocale(vfs, supported)).toBe("en");
  });

  test("ignores garbage written under the path and returns null", async () => {
    const vfs = new MemoryDriver();
    const enc = new TextEncoder();
    await vfs.write(LOCALE_PREFERENCE_PATH, enc.encode("not-a-valid-locale"));
    expect(await loadStoredLocale(vfs, supported)).toBeNull();
  });

  test("ignores corrupted JSON and returns null", async () => {
    const vfs = new MemoryDriver();
    const enc = new TextEncoder();
    await vfs.write(LOCALE_PREFERENCE_PATH, enc.encode("{not json"));
    expect(await loadStoredLocale(vfs, supported)).toBeNull();
  });
});
