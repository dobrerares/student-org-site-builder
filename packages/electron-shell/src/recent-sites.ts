/**
 * Recent-sites store: a tiny dedup-on-add, FIFO-evicting list of paths.
 *
 * The store interface is intentionally minimal so the same logic runs:
 *
 * - In tests, against an in-memory array.
 * - At runtime, against a JSON file in `app.getPath("userData")` (the
 *   wiring lives in `main.ts`).
 */

/**
 * The maximum number of entries the recent-sites menu shows. Anything
 * older is silently dropped. Five is the lower bound the test asserts; we
 * pick a slightly larger value to give the user some room.
 */
export const RECENT_SITES_LIMIT = 10;

export interface RecentSitesStore {
  /** Read the current list. Returns a copy. */
  read(): readonly string[];
  /** Overwrite the current list. The caller passes the canonical order. */
  write(next: readonly string[]): void;
}

export function loadRecentSites(store: RecentSitesStore): readonly string[] {
  return store.read();
}

export function saveRecentSites(store: RecentSitesStore, next: readonly string[]): void {
  store.write(next);
}

export function addRecentSite(store: RecentSitesStore, path: string): readonly string[] {
  const current = store.read();
  // Dedup: drop any existing copy, then prepend.
  const filtered = current.filter((entry) => entry !== path);
  const next = [path, ...filtered].slice(0, RECENT_SITES_LIMIT);
  store.write(next);
  return next;
}

export function clearRecentSites(store: RecentSitesStore): void {
  store.write([]);
}
