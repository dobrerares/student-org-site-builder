import { IpcChannels, type SaveSiteDialogOptions } from "./ipc-channels.js";
import { AutoUpdateChannels } from "./auto-update-channels.js";
import type { AutoUpdateSettings } from "./auto-update-settings.js";
import type {
  ProcessAssetForVariantsRequest,
  ProcessAssetForVariantsResponse,
} from "./asset-handlers.js";

/**
 * The shape exposed to the renderer via `contextBridge.exposeInMainWorld`.
 *
 * The renderer accesses it as `window.sosb.<method>(...)`. The preload
 * script doesn't expose `ipcRenderer` directly -- the renderer can ONLY
 * call the methods listed here, which is the documented Electron pattern
 * for safe contextBridge surfaces.
 */
export const PRELOAD_API_KEY = "sosb";

export const PRELOAD_API_METHODS = [
  // From #35 — native dialogs + recent sites.
  "openSiteDialog",
  "saveSiteDialog",
  "getRecentSites",
  "addRecentSite",
  "clearRecentSites",
  // From #36 — auto-update orchestration.
  "checkForUpdates",
  "installUpdateAndRelaunch",
  "declineUpdate",
  "getAutoUpdateSettings",
  "setAutoUpdateSettings",
  "onUpdateEvent",
  // From #37 — Electron Sharp asset pipeline.
  "processAssetForVariants",
] as const;

export type PreloadApiMethod = (typeof PRELOAD_API_METHODS)[number];

export interface IpcRendererLike {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on?(channel: string, listener: (event: unknown, payload: unknown) => void): void;
  removeListener?(channel: string, listener: (event: unknown, payload: unknown) => void): void;
}

/**
 * Listener for an autoUpdater event pushed from the main process to the
 * renderer. The first argument is the renderer-side payload (the main
 * process strips Electron's `IpcMainEvent` before sending).
 */
export type UpdateEventListener = (payload: unknown) => void;

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
  /** Manually trigger an auto-update check (Help → "Check for updates"). */
  checkForUpdates(): Promise<void>;
  /** Install the downloaded update and relaunch (the "Restart now" button). */
  installUpdateAndRelaunch(): Promise<void>;
  /** Persist a "Later" decision so the next launch ignores this version. */
  declineUpdate(): Promise<void>;
  /** Read the persisted auto-update settings. */
  getAutoUpdateSettings(): Promise<AutoUpdateSettings>;
  /** Persist the auto-update settings (auto-check toggle + declined list). */
  setAutoUpdateSettings(next: AutoUpdateSettings): Promise<void>;
  /**
   * Subscribe to an auto-update push event (e.g.
   * `AutoUpdateChannels.events.updateAvailable`). Returns an unsubscribe
   * function. The renderer can use this to update banner UI live.
   */
  onUpdateEvent(channel: string, listener: UpdateEventListener): () => void;
  /**
   * Asset pipeline (#37): main-process Sharp produces canonical bytes
   * and responsive variants from renderer-supplied image bytes.
   *
   * The renderer NEVER passes a path -- only bytes. This keeps the
   * Sharp pipeline behind a hard validation boundary: the IPC handler
   * verifies the declared mime is in the image allowlist, the payload
   * is under the hard size cap, the variant widths are positive, and
   * the alt is non-empty BEFORE Sharp ever touches the bytes.
   */
  processAssetForVariants(
    request: ProcessAssetForVariantsRequest,
  ): Promise<ProcessAssetForVariantsResponse>;
}

/**
 * Build the renderer-facing API. Pure function over `ipcRenderer.invoke`
 * (and optionally `on` / `removeListener` for the push-events surface),
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
    checkForUpdates: async () => {
      await ipcRenderer.invoke(AutoUpdateChannels.invoke.checkForUpdates);
    },
    installUpdateAndRelaunch: async () => {
      await ipcRenderer.invoke(AutoUpdateChannels.invoke.installAndRelaunch);
    },
    declineUpdate: async () => {
      await ipcRenderer.invoke(AutoUpdateChannels.invoke.declineUpdate);
    },
    getAutoUpdateSettings: async () =>
      (await ipcRenderer.invoke(AutoUpdateChannels.invoke.getSettings)) as AutoUpdateSettings,
    setAutoUpdateSettings: async (next) => {
      await ipcRenderer.invoke(AutoUpdateChannels.invoke.setSettings, next);
    },
    onUpdateEvent: (channel, listener) => {
      if (
        typeof ipcRenderer.on !== "function" ||
        typeof ipcRenderer.removeListener !== "function"
      ) {
        // Non-Electron environments (or a misconfigured shim) — return a
        // no-op unsubscribe so the renderer can still mount cleanly.
        return () => {
          /* no-op */
        };
      }
      const wrapped = (_event: unknown, payload: unknown): void => {
        listener(payload);
      };
      ipcRenderer.on(channel, wrapped);
      return () => {
        ipcRenderer.removeListener?.(channel, wrapped);
      };
    },
    processAssetForVariants: async (request) =>
      (await ipcRenderer.invoke(
        IpcChannels.processAssetForVariants,
        request,
      )) as ProcessAssetForVariantsResponse,
  };
}
