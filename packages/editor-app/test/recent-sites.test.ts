import { describe, expect, test } from "vitest";
import { MemoryDriver } from "@sosb/vfs";

import {
  loadRecentSites,
  recordRecentSite,
  RECENT_SITES_PATH,
  RECENT_SITES_LIMIT,
  type RecentSite,
} from "../src/recent-sites.js";

/**
 * AC: Recent sites list populated and clickable.
 *
 * The recent-sites store is intentionally VFS-backed (mirroring
 * `@sosb/editor-state`'s `AUTOSAVE_PATH`). Persistence across reload is the
 * caller's responsibility — the editor host (`browser-shell` / `electron-shell`)
 * picks the driver. Tests use `MemoryDriver`, the same driver that auto-save
 * uses in unit tests.
 *
 * Contract:
 *   - `loadRecentSites(vfs)` returns the persisted list, most-recent-first,
 *     `[]` if none persisted yet.
 *   - `recordRecentSite(vfs, entry)` prepends the entry, deduplicates by
 *     `key` (so re-opening a site bumps it to the top rather than adding a
 *     second row), and trims to RECENT_SITES_LIMIT.
 *   - File format is JSON at the stable path `RECENT_SITES_PATH` —
 *     stable so a future host can read it without depending on this module.
 */
describe("recent-sites VFS-backed store", () => {
  test("loadRecentSites returns [] for a fresh VFS", async () => {
    const vfs = new MemoryDriver();
    expect(await loadRecentSites(vfs)).toEqual([]);
  });

  test("recordRecentSite persists at the documented path", async () => {
    const vfs = new MemoryDriver();
    await recordRecentSite(vfs, {
      key: "site-a",
      label: "Site A",
      lastModified: 1000,
    });
    expect(await vfs.has(RECENT_SITES_PATH)).toBe(true);
  });

  test("recordRecentSite then loadRecentSites round-trips a single entry", async () => {
    const vfs = new MemoryDriver();
    const entry: RecentSite = {
      key: "site-a",
      label: "Site A",
      lastModified: 1000,
    };
    await recordRecentSite(vfs, entry);
    const loaded = await loadRecentSites(vfs);
    expect(loaded).toEqual([entry]);
  });

  test("recordRecentSite prepends most-recent first", async () => {
    const vfs = new MemoryDriver();
    await recordRecentSite(vfs, { key: "a", label: "A", lastModified: 1 });
    await recordRecentSite(vfs, { key: "b", label: "B", lastModified: 2 });
    await recordRecentSite(vfs, { key: "c", label: "C", lastModified: 3 });
    const loaded = await loadRecentSites(vfs);
    expect(loaded.map((e) => e.key)).toEqual(["c", "b", "a"]);
  });

  test("recordRecentSite deduplicates by key (re-open bumps to top)", async () => {
    const vfs = new MemoryDriver();
    await recordRecentSite(vfs, { key: "a", label: "A v1", lastModified: 1 });
    await recordRecentSite(vfs, { key: "b", label: "B", lastModified: 2 });
    await recordRecentSite(vfs, { key: "a", label: "A v2", lastModified: 3 });
    const loaded = await loadRecentSites(vfs);
    expect(loaded.map((e) => e.key)).toEqual(["a", "b"]);
    // Re-record carries the freshest label + timestamp.
    expect(loaded[0]).toEqual({ key: "a", label: "A v2", lastModified: 3 });
  });

  test("recordRecentSite trims to RECENT_SITES_LIMIT", async () => {
    const vfs = new MemoryDriver();
    // Push LIMIT + 3 entries; only the last LIMIT survive.
    const total = RECENT_SITES_LIMIT + 3;
    for (let i = 0; i < total; i += 1) {
      await recordRecentSite(vfs, {
        key: `s${i}`,
        label: `S${i}`,
        lastModified: i,
      });
    }
    const loaded = await loadRecentSites(vfs);
    expect(loaded).toHaveLength(RECENT_SITES_LIMIT);
    // Most recently recorded sit at the front.
    expect(loaded[0]?.key).toBe(`s${total - 1}`);
    expect(loaded[loaded.length - 1]?.key).toBe(
      `s${total - RECENT_SITES_LIMIT}`,
    );
  });

  test("loadRecentSites returns [] when the file is malformed", async () => {
    const vfs = new MemoryDriver();
    // Write garbage into the recents path — the loader should not throw.
    await vfs.write(RECENT_SITES_PATH, new TextEncoder().encode("{not json"));
    expect(await loadRecentSites(vfs)).toEqual([]);
  });

  test("loadRecentSites tolerates unknown extra fields per entry", async () => {
    const vfs = new MemoryDriver();
    const payload = JSON.stringify([
      {
        key: "a",
        label: "A",
        lastModified: 1,
        // Forward-compat: a future field this version doesn't know about.
        extraFutureField: "from-the-future",
      },
    ]);
    await vfs.write(RECENT_SITES_PATH, new TextEncoder().encode(payload));
    const loaded = await loadRecentSites(vfs);
    expect(loaded[0]?.key).toBe("a");
    expect(loaded[0]?.label).toBe("A");
  });
});
