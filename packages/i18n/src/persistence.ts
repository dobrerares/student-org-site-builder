/**
 * Locale persistence.
 *
 * The user's language override (chosen via the editor's settings toggle) is
 * stored alongside the editor's auto-save in the same VFS the editor app
 * already uses (see ADR 0005). Storing it here keeps the editor's state-
 * portability promise: a backed-up VFS contains both the site and the user's
 * UI preference, so reopening on a different machine restores both.
 *
 * Format: a single-property JSON file at LOCALE_PREFERENCE_PATH:
 * `{"locale":"ro"}`. Trailing newline matches the rest of the editor's
 * VFS-written JSON for diff-friendly snapshots.
 */
import type { Vfs } from "@sosb/vfs";

import type { Locale } from "./types.js";

export const LOCALE_PREFERENCE_PATH = "editor/locale.json" as const;

const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: false });

interface StoredLocale {
  readonly locale: string;
}

export async function saveLocale(vfs: Vfs, locale: Locale): Promise<void> {
  const payload: StoredLocale = { locale };
  await vfs.write(LOCALE_PREFERENCE_PATH, enc.encode(JSON.stringify(payload, null, 2) + "\n"));
}

/**
 * Read the persisted locale. Returns `null` when:
 *   - no file exists yet (first-launch),
 *   - the file is corrupt JSON,
 *   - the recorded locale is not in `supported` (e.g. legacy data, or a
 *     downgrade from a future version with more locales).
 *
 * Returning `null` rather than throwing lets the caller transparently fall
 * back to browser-language detection without surfacing a scary error.
 */
export async function loadStoredLocale<L extends string = Locale>(
  vfs: Vfs,
  supported: readonly L[],
): Promise<L | null> {
  if (!(await vfs.has(LOCALE_PREFERENCE_PATH))) return null;
  const bytes = await vfs.read(LOCALE_PREFERENCE_PATH);
  const text = dec.decode(bytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { locale?: unknown }).locale !== "string"
  ) {
    return null;
  }
  const candidate = (parsed as StoredLocale).locale;
  if (!supported.includes(candidate as L)) return null;
  return candidate as L;
}
