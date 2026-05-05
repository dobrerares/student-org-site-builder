/**
 * The IPC channel names exchanged between the preload (renderer) and the
 * main process. Single source of truth: both sides import from here.
 *
 * Every channel is namespaced under `sosb:` so messages can't collide with
 * a random `ipcRenderer.send` somewhere else in the app or in a third-party
 * library that reaches into Electron's IPC bus.
 *
 * Out of scope for #35 (and therefore not present here):
 *
 * - Sharp / asset-pipeline channels — owned by #37.
 * - Auto-update channels (`electron-updater`) — owned by #36.
 */

export const IpcChannels = {
  /** Native open-folder dialog. Returns the chosen path or `null`. */
  openSiteDialog: "sosb:open-site-dialog",
  /** Native save-file dialog. Returns the chosen path or `null`. */
  saveSiteDialog: "sosb:save-site-dialog",
  /** Read the recent-sites list from app preferences. */
  getRecentSites: "sosb:get-recent-sites",
  /** Push a path to the front of the recent-sites list. */
  addRecentSite: "sosb:add-recent-site",
  /** Empty the recent-sites list. */
  clearRecentSites: "sosb:clear-recent-sites",
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

/**
 * Enumeration of every IPC channel. Used by `registerIpcHandlers` to
 * verify (in tests) that every channel has a handler, and to drive
 * `dispose()` cleanup.
 */
export const IPC_CHANNEL_LIST: readonly IpcChannel[] = [
  IpcChannels.openSiteDialog,
  IpcChannels.saveSiteDialog,
  IpcChannels.getRecentSites,
  IpcChannels.addRecentSite,
  IpcChannels.clearRecentSites,
];

/**
 * Optional payload accepted by `saveSiteDialog`. The renderer can suggest
 * a default filename (e.g. `"my-org.zip"`); the dialog still gives the
 * user the final say.
 */
export interface SaveSiteDialogOptions {
  readonly defaultName?: string;
}
