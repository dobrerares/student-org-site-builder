/**
 * Recent-sites store — VFS-backed list of last-opened sites for the
 * welcome screen.
 *
 * Persistence model mirrors `@sosb/editor-state`'s auto-save: the data
 * lives in a stable VFS path (`RECENT_SITES_PATH`) and the host
 * (`browser-shell` / `electron-shell`) injects the driver. The browser
 * shell will pair this module with a localStorage-backed VFS driver; the
 * Electron shell will pair it with a real-FS driver. Both surface
 * `recordRecentSite` after a successful import / new-site, and
 * `loadRecentSites` on welcome-screen mount.
 *
 * Design notes recorded in ADR 0006.
 *
 * Tracking issue: #32.
 */

import type { Vfs } from "@sosb/vfs";

/**
 * Stable path inside the welcome-VFS where the recents list lives. Stable
 * across editor versions so future hosts (or migration tools) can read it
 * without depending on this module.
 */
export const RECENT_SITES_PATH = "welcome/recent-sites.json" as const;

/**
 * Per the PRD welcome-screen section: "Recent sites list shows last ~5
 * sites." 5 is a UI constant; if the screen design later changes, bump
 * this and the tests will follow.
 */
export const RECENT_SITES_LIMIT = 5 as const;

const RECENT_SITES_INDENT = 2;

const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: false });

/**
 * One row of the recent-sites list.
 *
 * `key` is the host-opaque identifier (an absolute filesystem path on
 * Electron, a VFS path / URL on the browser host). The welcome screen
 * forwards this back to the host's `onOpenRecent` callback when the user
 * clicks; the host knows how to resolve it.
 *
 * `label` is the human-readable display name (typically the org name
 * or the file's basename).
 *
 * `lastModified` is a Unix epoch ms timestamp. Used for display-only.
 *
 * Unknown extra fields are tolerated on read (forward-compat) and
 * dropped on write — this module owns the canonical shape.
 */
export interface RecentSite {
  readonly key: string;
  readonly label: string;
  readonly lastModified: number;
}

/**
 * Read the persisted list, most-recent-first. Returns `[]` for any of:
 *   - the file does not exist yet (first launch)
 *   - the file is malformed (parse error)
 *   - the file's top-level shape is not an array
 *
 * Per-entry validation strips entries whose required fields are missing
 * or wrong-typed; surviving entries pass through with extra fields
 * preserved-but-dropped (we round-trip only the canonical shape on
 * write, so forward-compat fields are accepted on read but not echoed
 * back).
 */
export async function loadRecentSites(vfs: Vfs): Promise<RecentSite[]> {
  if (!(await vfs.has(RECENT_SITES_PATH))) return [];
  let parsed: unknown;
  try {
    const bytes = await vfs.read(RECENT_SITES_PATH);
    parsed = JSON.parse(dec.decode(bytes));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: RecentSite[] = [];
  for (const entry of parsed) {
    if (entry === null || typeof entry !== "object") continue;
    const candidate = entry as Record<string, unknown>;
    const key = candidate["key"];
    const label = candidate["label"];
    const lastModified = candidate["lastModified"];
    if (
      typeof key !== "string" ||
      typeof label !== "string" ||
      typeof lastModified !== "number"
    ) {
      continue;
    }
    out.push({ key, label, lastModified });
  }
  return out;
}

/**
 * Prepend `entry` to the persisted list, dedupe by `key`, and trim to
 * `RECENT_SITES_LIMIT`. Re-recording an existing key bumps it to the
 * top with the freshest label and timestamp — i.e. a re-open shows up
 * once, not twice.
 *
 * The write is a single VFS `write` to `RECENT_SITES_PATH`; concurrent
 * callers race on last-writer-wins, which is acceptable for a UX list
 * that is only ever updated on user action.
 */
export async function recordRecentSite(
  vfs: Vfs,
  entry: RecentSite,
): Promise<void> {
  const existing = await loadRecentSites(vfs);
  const filtered = existing.filter((e) => e.key !== entry.key);
  const next = [entry, ...filtered].slice(0, RECENT_SITES_LIMIT);
  const text = JSON.stringify(next, null, RECENT_SITES_INDENT) + "\n";
  await vfs.write(RECENT_SITES_PATH, enc.encode(text));
}
