/**
 * Auto-update IPC channel constants.
 *
 * Two surfaces:
 *
 * - **Events** (main → renderer): pushed via `webContents.send`. The
 *   renderer subscribes to these via `window.sosb.onUpdateEvent(...)` to
 *   update banner UI as the autoUpdater state machine progresses.
 * - **Invoke** (renderer → main): triggered via `ipcRenderer.invoke`. Lets
 *   the renderer ask the main process to manually check for updates,
 *   install a downloaded update, decline an update, or read/write the
 *   user's auto-check setting.
 *
 * Every channel is namespaced under `sosb:update:` so messages can't
 * collide with the channels owned by #35 (`sosb:open-site-dialog`,
 * `sosb:save-site-dialog`, etc.) or any third-party Electron consumer.
 *
 * Single source of truth: both the main process (`auto-updater-orchestrator`,
 * `register-auto-update-handlers`) and the preload (`buildPreloadApi`)
 * import from here. A typo on either side breaks IPC silently — these
 * constants make typos a typecheck error instead.
 */

export const AutoUpdateChannels = {
  events: {
    /** electron-updater emitted `update-available` — a newer version exists. */
    updateAvailable: "sosb:update:available",
    /** electron-updater emitted `update-not-available` — already on latest. */
    updateNotAvailable: "sosb:update:not-available",
    /** electron-updater emitted `update-downloaded` — install ready. */
    updateDownloaded: "sosb:update:downloaded",
    /** electron-updater emitted `error` during any phase. */
    updateError: "sosb:update:error",
    /** electron-updater emitted `download-progress` — bytes/percent updates. */
    downloadProgress: "sosb:update:download-progress",
    /** electron-updater emitted `checking-for-update` — request in flight. */
    checkingForUpdate: "sosb:update:checking",
  },
  invoke: {
    /** Renderer → main: trigger a manual `autoUpdater.checkForUpdates()`. */
    checkForUpdates: "sosb:update:check",
    /** Renderer → main: install the downloaded update and relaunch. */
    installAndRelaunch: "sosb:update:install",
    /** Renderer → main: record a "later" decision so the next launch skips it. */
    declineUpdate: "sosb:update:decline",
    /** Renderer → main: read the persisted auto-update settings. */
    getSettings: "sosb:update:get-settings",
    /** Renderer → main: persist new auto-update settings. */
    setSettings: "sosb:update:set-settings",
  },
} as const;

export type AutoUpdateEventChannel =
  (typeof AutoUpdateChannels.events)[keyof typeof AutoUpdateChannels.events];

export type AutoUpdateInvokeChannel =
  (typeof AutoUpdateChannels.invoke)[keyof typeof AutoUpdateChannels.invoke];

export const AUTO_UPDATE_EVENT_LIST: readonly AutoUpdateEventChannel[] = [
  AutoUpdateChannels.events.updateAvailable,
  AutoUpdateChannels.events.updateNotAvailable,
  AutoUpdateChannels.events.updateDownloaded,
  AutoUpdateChannels.events.updateError,
  AutoUpdateChannels.events.downloadProgress,
  AutoUpdateChannels.events.checkingForUpdate,
];

export const AUTO_UPDATE_INVOKE_LIST: readonly AutoUpdateInvokeChannel[] = [
  AutoUpdateChannels.invoke.checkForUpdates,
  AutoUpdateChannels.invoke.installAndRelaunch,
  AutoUpdateChannels.invoke.declineUpdate,
  AutoUpdateChannels.invoke.getSettings,
  AutoUpdateChannels.invoke.setSettings,
];

/**
 * Update-info payload sent over `updateAvailable` and `updateDownloaded`.
 * Mirrors the relevant fields from electron-updater's `UpdateInfo` so
 * neither the renderer nor the orchestrator depends on the full upstream
 * type (which depends on Node-only modules).
 */
export interface UpdateInfoPayload {
  readonly version: string;
  readonly releaseNotes?: string | undefined;
  readonly releaseName?: string | undefined;
  readonly releaseDate?: string | undefined;
}

/** Progress info payload sent over `downloadProgress`. */
export interface DownloadProgressPayload {
  readonly bytesPerSecond: number;
  readonly percent: number;
  readonly total: number;
  readonly transferred: number;
}

/** Error payload sent over `updateError`. */
export interface UpdateErrorPayload {
  readonly message: string;
}
