/**
 * Electron main-process entrypoint.
 *
 * Composes the testable units (`registerIpcHandlers`, `resolveEditorUrl`,
 * `buildBrowserWindowOptions`) with Electron's runtime APIs. The main
 * process bootstraps a single `BrowserWindow` that loads the editor app —
 * either from the vite dev server in development or from the packaged
 * `index.html` in production.
 *
 * The recent-sites store is JSON-on-disk inside `app.getPath("userData")`,
 * which Electron resolves to a per-user, per-platform location:
 *
 * - macOS:   ~/Library/Application Support/<productName>/recent-sites.json
 * - Linux:   ~/.config/<productName>/recent-sites.json
 * - Windows: %APPDATA%/<productName>/recent-sites.json
 *
 * Loading and saving JSON is best-effort — a missing or malformed file
 * yields an empty list, which the renderer treats as "no recent sites".
 */

import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildBrowserWindowOptions } from "./browser-window-options.js";
import { resolveEditorUrl } from "./editor-url.js";
import { registerIpcHandlers } from "./register-ipc-handlers.js";
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

app.whenReady().then(() => {
  const recentSitesPath = path.join(app.getPath("userData"), "recent-sites.json");
  const store = createDiskStore(recentSitesPath);

  registerIpcHandlers({ ipcMain, dialog, store });

  void createMainWindow();

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
