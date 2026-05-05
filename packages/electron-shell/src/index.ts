/**
 * `@sosb/electron-shell` — Electron desktop shell.
 *
 * Tracking issue: #35. ADR 0006 records the design.
 *
 * Public surface (v1):
 *
 * - `main.ts` — Electron main process entrypoint. Wires `BrowserWindow`,
 *   the preload script, the IPC bridge, and the recent-sites store. Run
 *   from `electron .` against the package root.
 * - `preload.ts` — Electron preload script. Exposes `window.sosb` via
 *   `contextBridge.exposeInMainWorld`.
 * - `ipc-channels.ts` — channel constants, single source of truth shared
 *   between main and preload.
 * - `register-ipc-handlers.ts` — wiring helper, accepts shims so it's
 *   testable in node.
 * - `recent-sites.ts` — recent-sites store logic (dedup, FIFO cap).
 * - `dialog-handlers.ts` — open/save dialog factories.
 * - `editor-url.ts` — pure URL resolver: dev server vs. packaged file://.
 * - `browser-window-options.ts` — security-first webPreferences.
 *
 * Out of scope for #35:
 *
 * - Sharp asset pipeline IPC — #37.
 * - `electron-updater` integration — #36.
 * - Mac code signing / notarization — see `.out-of-scope/mac-code-signing.md`.
 */

export {
  IpcChannels,
  IPC_CHANNEL_LIST,
  type IpcChannel,
  type SaveSiteDialogOptions,
} from "./ipc-channels.js";
export {
  PRELOAD_API_KEY,
  PRELOAD_API_METHODS,
  buildPreloadApi,
  type PreloadApi,
  type PreloadApiMethod,
  type IpcRendererLike,
} from "./preload-surface.js";
export {
  registerIpcHandlers,
  type IpcMainLike,
  type RegisterIpcHandlersDeps,
} from "./register-ipc-handlers.js";
export {
  createOpenSiteHandler,
  createSaveSiteHandler,
  type ElectronDialogLike,
  type OpenDialogResultLike,
  type SaveDialogResultLike,
} from "./dialog-handlers.js";
export {
  RECENT_SITES_LIMIT,
  loadRecentSites,
  saveRecentSites,
  addRecentSite,
  clearRecentSites,
  type RecentSitesStore,
} from "./recent-sites.js";
export { resolveEditorUrl, type ResolveEditorUrlOpts } from "./editor-url.js";
export {
  buildBrowserWindowOptions,
  type BuildBrowserWindowOpts,
  type BrowserWindowOptions,
} from "./browser-window-options.js";
