/**
 * `@sosb/electron-shell` — Electron desktop shell.
 *
 * Tracking issues: #35, #36. ADR 0006 records the shell design; ADR 0029
 * records the auto-update design.
 *
 * Public surface (v1):
 *
 * - `main.ts` — Electron main process entrypoint. Wires `BrowserWindow`,
 *   the preload script, the IPC bridge, the recent-sites store, and (in
 *   packaged builds) the `electron-updater` orchestrator. Run from
 *   `electron .` against the package root.
 * - `preload.ts` — Electron preload script. Exposes `window.sosb` via
 *   `contextBridge.exposeInMainWorld`.
 * - `ipc-channels.ts` / `auto-update-channels.ts` — channel constants,
 *   single source of truth shared between main and preload.
 * - `register-ipc-handlers.ts` / `register-auto-update-handlers.ts` —
 *   wiring helpers, accept shims so they're testable in node.
 * - `recent-sites.ts` — recent-sites store logic (dedup, FIFO cap).
 * - `auto-update-settings.ts` — auto-check toggle + declined-versions
 *   list, persisted via the same shape as `recent-sites`.
 * - `auto-updater-orchestrator.ts` — wires `electron-updater` events to
 *   the renderer; testable in node via the `AutoUpdaterLike` shim.
 * - `dialog-handlers.ts` — open/save dialog factories.
 * - `editor-url.ts` — pure URL resolver: dev server vs. packaged file://.
 * - `browser-window-options.ts` — security-first webPreferences.
 *
 * Out of scope for #35 + #36:
 *
 * - Sharp asset pipeline IPC — #37.
 * - Mac code signing / notarization — see `.out-of-scope/mac-code-signing.md`.
 */

export {
  IpcChannels,
  IPC_CHANNEL_LIST,
  type IpcChannel,
  type SaveSiteDialogOptions,
} from "./ipc-channels.js";
export {
  AutoUpdateChannels,
  AUTO_UPDATE_EVENT_LIST,
  AUTO_UPDATE_INVOKE_LIST,
  type AutoUpdateEventChannel,
  type AutoUpdateInvokeChannel,
  type UpdateInfoPayload,
  type DownloadProgressPayload,
  type UpdateErrorPayload,
} from "./auto-update-channels.js";
export {
  PRELOAD_API_KEY,
  PRELOAD_API_METHODS,
  buildPreloadApi,
  type PreloadApi,
  type PreloadApiMethod,
  type IpcRendererLike,
  type UpdateEventListener,
} from "./preload-surface.js";
export {
  registerIpcHandlers,
  type IpcMainLike,
  type RegisterIpcHandlersDeps,
} from "./register-ipc-handlers.js";
export {
  registerAutoUpdateHandlers,
  type RegisterAutoUpdateHandlersDeps,
} from "./register-auto-update-handlers.js";
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
export {
  DEFAULT_AUTO_UPDATE_SETTINGS,
  loadAutoUpdateSettings,
  saveAutoUpdateSettings,
  declineUpdateVersion,
  isVersionDeclined,
  type AutoUpdateSettings,
  type AutoUpdateSettingsStore,
} from "./auto-update-settings.js";
export {
  AUTO_UPDATE_CHECK_INTERVAL_MS,
  createAutoUpdaterOrchestrator,
  type AutoUpdaterLike,
  type AutoUpdaterOrchestrator,
  type AutoUpdaterEventName,
  type RendererSender,
  type OrchestratorDeps,
  type OrchestratorLogger,
} from "./auto-updater-orchestrator.js";
export { resolveEditorUrl, type ResolveEditorUrlOpts } from "./editor-url.js";
export {
  buildBrowserWindowOptions,
  type BuildBrowserWindowOpts,
  type BrowserWindowOptions,
} from "./browser-window-options.js";
