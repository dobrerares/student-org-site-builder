/**
 * Electron main-process entrypoint.
 *
 * Composes the testable units (`registerIpcHandlers`, `resolveEditorUrl`,
 * `buildBrowserWindowOptions`, `createAutoUpdaterOrchestrator`) with
 * Electron's runtime APIs. The main process bootstraps a single
 * `BrowserWindow` that loads the editor app — either from the vite dev
 * server in development or from the packaged `index.html` in production —
 * and (in packaged builds) starts the `electron-updater` orchestrator.
 *
 * Two on-disk JSON files live inside `app.getPath("userData")`:
 *
 * - `recent-sites.json`        — recent-sites store (#35).
 * - `auto-update-settings.json` — auto-check toggle + declined versions (#36).
 *
 * Electron resolves `userData` to a per-user, per-platform location:
 *
 * - macOS:   ~/Library/Application Support/<productName>/...
 * - Linux:   ~/.config/<productName>/...
 * - Windows: %APPDATA%/<productName>/...
 *
 * Loading and saving JSON is best-effort — a missing or malformed file
 * yields an empty list / default settings, which the renderer treats as
 * "first run".
 *
 * Auto-update wiring (#36)
 * ------------------------
 * `electron-updater` runs ONLY in the main process — its dependencies
 * (`fs`, `child_process`, native code-signing tools) are Node-side.
 * We never import it from the renderer or the preload. The renderer
 * subscribes to push events via `window.sosb.onUpdateEvent(...)`.
 *
 * In development (`!app.isPackaged`) we skip the orchestrator entirely:
 * electron-updater throws on dev because there's no `app-update.yml`
 * inside the unpacked dev tree.
 */

import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildBrowserWindowOptions } from "./browser-window-options.js";
import { resolveEditorUrl } from "./editor-url.js";
import { registerIpcHandlers } from "./register-ipc-handlers.js";
import { registerAutoUpdateHandlers } from "./register-auto-update-handlers.js";
import {
  createAutoUpdaterOrchestrator,
  type AutoUpdaterLike,
  type RendererSender,
  type AutoUpdaterEventName,
} from "./auto-updater-orchestrator.js";
import {
  DEFAULT_AUTO_UPDATE_SETTINGS,
  type AutoUpdateSettings,
  type AutoUpdateSettingsStore,
} from "./auto-update-settings.js";
import type { RecentSitesStore } from "./recent-sites.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function createDiskStore(filePath: string): RecentSitesStore {
  return {
    read: () => {
      try {
        const raw = readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string")) {
          return parsed as readonly string[];
        }
        return [];
      } catch {
        return [];
      }
    },
    write: (next) => {
      try {
        writeFileSync(filePath, JSON.stringify(next, null, 2), "utf8");
      } catch (err) {
        console.error("[electron-shell] failed to persist recent sites:", err);
      }
    },
  };
}

function createSettingsDiskStore(filePath: string): AutoUpdateSettingsStore {
  return {
    read: () => {
      try {
        const raw = readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw) as unknown;
        if (parsed === null || typeof parsed !== "object") {
          return DEFAULT_AUTO_UPDATE_SETTINGS;
        }
        const obj = parsed as Record<string, unknown>;
        const autoCheck =
          typeof obj["autoCheckEnabled"] === "boolean"
            ? obj["autoCheckEnabled"]
            : DEFAULT_AUTO_UPDATE_SETTINGS.autoCheckEnabled;
        const declined =
          Array.isArray(obj["declinedVersions"]) &&
          obj["declinedVersions"].every((v) => typeof v === "string")
            ? (obj["declinedVersions"] as readonly string[])
            : DEFAULT_AUTO_UPDATE_SETTINGS.declinedVersions;
        return { autoCheckEnabled: autoCheck, declinedVersions: declined };
      } catch {
        return DEFAULT_AUTO_UPDATE_SETTINGS;
      }
    },
    write: (next: AutoUpdateSettings) => {
      try {
        writeFileSync(filePath, JSON.stringify(next, null, 2), "utf8");
      } catch (err) {
        console.error("[electron-shell] failed to persist auto-update settings:", err);
      }
    },
  };
}

let mainWindow: BrowserWindow | null = null;

async function createMainWindow(): Promise<void> {
  // The compiled main.js sits next to preload.js in the same dist dir.
  const preloadPath = path.resolve(here, "preload.js");
  const options = buildBrowserWindowOptions({ preloadPath });

  mainWindow = new BrowserWindow(options);

  const devServerUrl = process.env["SOSB_DEV_SERVER_URL"];
  const url = resolveEditorUrl({
    isPackaged: app.isPackaged,
    rendererRoot: path.resolve(here, "..", "renderer"),
    ...(devServerUrl ? { devServerUrl } : {}),
  });

  await mainWindow.loadURL(url);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/**
 * Build a `RendererSender` that fans events out to whatever the current
 * main BrowserWindow is. If the window has been closed, the send is a
 * no-op (the orchestrator's safeSend wraps any throws too).
 */
function buildRendererSender(): RendererSender {
  return {
    send: (channel, payload) => {
      if (mainWindow !== null && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, payload);
      }
    },
  };
}

/**
 * Lazy-import electron-updater's autoUpdater. Imported via dynamic import
 * because (a) the orchestrator unit tests don't need it, and (b) it
 * reaches into Node-only modules that don't load in the test runner.
 */
async function loadAutoUpdater(): Promise<AutoUpdaterLike | null> {
  try {
    const module: { autoUpdater?: unknown } = await import("electron-updater");
    if (module.autoUpdater === undefined) {
      console.warn("[electron-shell] electron-updater did not export autoUpdater");
      return null;
    }
    return adaptAutoUpdater(module.autoUpdater as ElectronUpdaterAutoUpdater);
  } catch (err) {
    console.error("[electron-shell] failed to load electron-updater:", err);
    return null;
  }
}

/**
 * Minimal type for the electron-updater singleton. We only declare the
 * methods we touch — the upstream type pulls in Node-only modules that
 * we don't want to depend on at typecheck time.
 */
interface ElectronUpdaterAutoUpdater {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  removeAllListeners(event?: string): unknown;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(): void;
}

function adaptAutoUpdater(updater: ElectronUpdaterAutoUpdater): AutoUpdaterLike {
  // The shim narrows electron-updater's loose `EventEmitter` shape to the
  // strict `AutoUpdaterLike` the orchestrator consumes.
  return {
    get autoDownload() {
      return updater.autoDownload;
    },
    set autoDownload(v: boolean) {
      updater.autoDownload = v;
    },
    get autoInstallOnAppQuit() {
      return updater.autoInstallOnAppQuit;
    },
    set autoInstallOnAppQuit(v: boolean) {
      updater.autoInstallOnAppQuit = v;
    },
    on: (event: AutoUpdaterEventName, listener) => {
      updater.on(event, (arg: unknown) => listener(arg));
    },
    removeAllListeners: () => {
      updater.removeAllListeners();
    },
    checkForUpdates: () => updater.checkForUpdates(),
    quitAndInstall: () => updater.quitAndInstall(),
  };
}

app.whenReady().then(async () => {
  const userData = app.getPath("userData");
  const recentSitesPath = path.join(userData, "recent-sites.json");
  const autoUpdatePath = path.join(userData, "auto-update-settings.json");
  const recentStore = createDiskStore(recentSitesPath);
  const settingsStore = createSettingsDiskStore(autoUpdatePath);

  registerIpcHandlers({ ipcMain, dialog, store: recentStore });

  await createMainWindow();

  // Auto-update is desktop-only AND packaged-only. In dev we skip — the
  // electron-updater throws because there's no `app-update.yml` next to
  // the unpacked main bundle.
  if (app.isPackaged) {
    const autoUpdater = await loadAutoUpdater();
    if (autoUpdater !== null) {
      const orchestrator = createAutoUpdaterOrchestrator({
        autoUpdater,
        sender: buildRendererSender(),
        settingsStore,
        logger: {
          info: (msg, ...args) => console.log(msg, ...args),
          warn: (msg, ...args) => console.warn(msg, ...args),
          error: (msg, ...args) => console.error(msg, ...args),
        },
      });
      registerAutoUpdateHandlers({ ipcMain, orchestrator, settingsStore });
      orchestrator.start();
    }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // macOS apps usually stay running until Cmd+Q. We follow the platform
  // convention.
  if (process.platform !== "darwin") {
    app.quit();
  }
});
