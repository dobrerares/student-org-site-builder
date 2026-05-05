import { describe, expect, test } from "vitest";
import {
  RECENT_SITES_LIMIT,
  addRecentSite,
  loadRecentSites,
  saveRecentSites,
  clearRecentSites,
  type RecentSitesStore,
} from "../src/recent-sites.js";

/**
 * AC: the recent-sites menu is populated and persists across launches.
 *
 * The recent-sites *list* is testable without Electron: the only thing
 * Electron contributes is the on-disk JSON file in `app.getPath("userData")`.
 * We inject a `RecentSitesStore` so the same logic is unit-testable in node
 * with an in-memory store, and is wired to a JSON-on-disk store from the
 * main process at runtime.
 *
 * Behaviour:
 *
 * - `loadRecentSites` returns `[]` for a fresh store.
 * - `addRecentSite(path)` adds the path to the front of the list.
 * - Re-adding an existing path moves it to the front (no duplicates).
 * - The list is capped at `RECENT_SITES_LIMIT` entries (FIFO eviction).
 * - `clearRecentSites` empties the list.
 */

function memoryStore(initial: readonly string[] = []): RecentSitesStore {
  let list: readonly string[] = [...initial];
  return {
    read: () => [...list],
    write: (next) => {
      list = [...next];
    },
  };
}

describe("recent-sites store", () => {
  test("fresh store has no recent sites", () => {
    const store = memoryStore();
    expect(loadRecentSites(store)).toEqual([]);
  });

  test("addRecentSite prepends the new path", () => {
    const store = memoryStore();
    addRecentSite(store, "/Users/me/site-a");
    addRecentSite(store, "/Users/me/site-b");
    expect(loadRecentSites(store)).toEqual(["/Users/me/site-b", "/Users/me/site-a"]);
  });

  test("re-adding an existing path moves it to the front (no duplicates)", () => {
    const store = memoryStore();
    addRecentSite(store, "/sites/a");
    addRecentSite(store, "/sites/b");
    addRecentSite(store, "/sites/a"); // duplicate
    expect(loadRecentSites(store)).toEqual(["/sites/a", "/sites/b"]);
  });

  test("the list is capped at RECENT_SITES_LIMIT", () => {
    const store = memoryStore();
    for (let i = 0; i < RECENT_SITES_LIMIT + 5; i++) {
      addRecentSite(store, `/sites/${i}`);
    }
    const list = loadRecentSites(store);
    expect(list.length).toBe(RECENT_SITES_LIMIT);
    // The most-recent are kept; the oldest are evicted.
    expect(list[0]).toBe(`/sites/${RECENT_SITES_LIMIT + 4}`);
    expect(list).not.toContain("/sites/0");
  });

  test("clearRecentSites empties the list", () => {
    const store = memoryStore();
    addRecentSite(store, "/a");
    addRecentSite(store, "/b");
    clearRecentSites(store);
    expect(loadRecentSites(store)).toEqual([]);
  });

  test("saveRecentSites overwrites the list", () => {
    const store = memoryStore(["/old"]);
    saveRecentSites(store, ["/new1", "/new2"]);
    expect(loadRecentSites(store)).toEqual(["/new1", "/new2"]);
  });

  test("RECENT_SITES_LIMIT is at least 5 (so the menu is useful)", () => {
    expect(RECENT_SITES_LIMIT).toBeGreaterThanOrEqual(5);
  });
});
