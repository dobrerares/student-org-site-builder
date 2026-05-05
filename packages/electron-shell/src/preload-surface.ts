import { IpcChannels, type SaveSiteDialogOptions } from "./ipc-channels.js";

/**
 * The shape exposed to the renderer via `contextBridge.exposeInMainWorld`.
 *
 * The renderer accesses it as `window.sosb.<method>(...)`. The preload
 * script doesn't expose `ipcRenderer` directly — the renderer can ONLY
 * call the methods listed here, which is the documented Electron pattern
 * for safe contextBridge surfaces.
 */
export const PRELOAD_API_KEY = "sosb";

export const PRELOAD_API_METHODS = [
  "openSiteDialog",
  "saveSiteDialog",
  "getRecentSites",
  "addRecentSite",
  "clearRecentSites",
] as const;

export type PreloadApiMethod = (typeof PRELOAD_API_METHODS)[number];

export interface IpcRendererLike {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
}

export interface PreloadApi {
  /** Open the native folder picker. Resolves to the chosen path or null. */
  openSiteDialog(): Promise<string | null>;
  /** Open the native save dialog. Resolves to the chosen path or null. */
  saveSiteDialog(opts?: SaveSiteDialogOptions): Promise<string | null>;
  /** Read the recent-sites list (most-recent first). */
  getRecentSites(): Promise<readonly string[]>;
  /** Push a path onto the recent-sites list (deduped). */
  addRecentSite(path: string): Promise<readonly string[]>;
  /** Empty the recent-sites list. */
  clearRecentSites(): Promise<void>;
}

/**
 * Build the renderer-facing API. Pure function over `ipcRenderer.invoke`,
 * so a fake `IpcRendererLike` makes the whole surface unit-testable.
 */
export function buildPreloadApi(ipcRenderer: IpcRendererLike): PreloadApi {
  return {
    openSiteDialog: async () =>
      (await ipcRenderer.invoke(IpcChannels.openSiteDialog)) as string | null,
    saveSiteDialog: async (opts) =>
      (await ipcRenderer.invoke(IpcChannels.saveSiteDialog, opts ?? {})) as string | null,
    getRecentSites: async () =>
      (await ipcRenderer.invoke(IpcChannels.getRecentSites)) as readonly string[],
    addRecentSite: async (path) =>
      (await ipcRenderer.invoke(IpcChannels.addRecentSite, path)) as readonly string[],
    clearRecentSites: async () => {
      await ipcRenderer.invoke(IpcChannels.clearRecentSites);
    },
  };
}
