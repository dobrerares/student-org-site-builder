/**
 * Auto-update settings store.
 *
 * Persists two pieces of state across app launches:
 *
 * - `autoCheckEnabled` — the user's "automatically check for updates"
 *   preference. Default is ON. Surfaced in Settings as a checkbox.
 * - `declinedVersions` — versions the user clicked "Later" on. The
 *   orchestrator skips notifying the renderer about these on the next
 *   launch (PRD AC: "User-declined update does not auto-install on next
 *   launch"). The list grows append-only; pruning happens implicitly when
 *   we move past those versions on a future release.
 *
 * The store interface mirrors `recent-sites.ts` — caller chooses the
 * persistence layer (in-memory for tests, JSON-on-disk at runtime under
 * `app.getPath("userData")/auto-update-settings.json`).
 */

export interface AutoUpdateSettings {
  /** Whether the app should check for updates automatically. */
  readonly autoCheckEnabled: boolean;
  /** Versions the user explicitly clicked "Later" on. */
  readonly declinedVersions: readonly string[];
}

export const DEFAULT_AUTO_UPDATE_SETTINGS: AutoUpdateSettings = {
  autoCheckEnabled: true,
  declinedVersions: [],
};

export interface AutoUpdateSettingsStore {
  /** Read the persisted settings (returns defaults if nothing saved). */
  read(): AutoUpdateSettings;
  /** Overwrite the persisted settings. */
  write(next: AutoUpdateSettings): void;
}

export function loadAutoUpdateSettings(store: AutoUpdateSettingsStore): AutoUpdateSettings {
  return store.read();
}

export function saveAutoUpdateSettings(
  store: AutoUpdateSettingsStore,
  next: AutoUpdateSettings,
): void {
  store.write(next);
}

/**
 * Append a version to the declined list (idempotent). Used when the
 * renderer fires `sosb:update:decline`.
 */
export function declineUpdateVersion(store: AutoUpdateSettingsStore, version: string): void {
  const current = store.read();
  if (current.declinedVersions.includes(version)) {
    return;
  }
  store.write({
    ...current,
    declinedVersions: [...current.declinedVersions, version],
  });
}

/**
 * Whether `version` is on the declined list — checked by the orchestrator
 * before it forwards an `update-available` event to the renderer.
 */
export function isVersionDeclined(store: AutoUpdateSettingsStore, version: string): boolean {
  return store.read().declinedVersions.includes(version);
}
