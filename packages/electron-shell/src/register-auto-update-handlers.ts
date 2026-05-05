/**
 * IPC handler registration for auto-update invoke channels.
 *
 * The renderer talks to the main process for five things:
 *
 * 1. Manually trigger a check (`Help → "Check for updates"`).
 * 2. Install the downloaded update + relaunch (the "Restart now" button).
 * 3. Decline the in-flight update so the next launch ignores it (the
 *    "Later" button).
 * 4. Read the persisted auto-update settings (Settings → toggle).
 * 5. Write new auto-update settings.
 *
 * This file mirrors `register-ipc-handlers.ts` from #35: a thin function
 * that walks `AUTO_UPDATE_INVOKE_LIST` and returns a `dispose()` for
 * symmetric teardown.
 */

import { AutoUpdateChannels, AUTO_UPDATE_INVOKE_LIST } from "./auto-update-channels.js";
import {
  loadAutoUpdateSettings,
  saveAutoUpdateSettings,
  type AutoUpdateSettings,
  type AutoUpdateSettingsStore,
} from "./auto-update-settings.js";
import type { AutoUpdaterOrchestrator } from "./auto-updater-orchestrator.js";
import type { IpcMainLike } from "./register-ipc-handlers.js";

export interface RegisterAutoUpdateHandlersDeps {
  readonly ipcMain: IpcMainLike;
  readonly orchestrator: AutoUpdaterOrchestrator;
  readonly settingsStore: AutoUpdateSettingsStore;
}

function isSettingsShape(value: unknown): value is AutoUpdateSettings {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v["autoCheckEnabled"] !== "boolean") return false;
  if (!Array.isArray(v["declinedVersions"])) return false;
  return v["declinedVersions"].every((entry) => typeof entry === "string");
}

export function registerAutoUpdateHandlers(deps: RegisterAutoUpdateHandlersDeps): () => void {
  const { ipcMain, orchestrator, settingsStore } = deps;

  ipcMain.handle(AutoUpdateChannels.invoke.checkForUpdates, async () => {
    await orchestrator.checkNow();
  });

  ipcMain.handle(AutoUpdateChannels.invoke.installAndRelaunch, async () => {
    orchestrator.installAndRelaunch();
  });

  ipcMain.handle(AutoUpdateChannels.invoke.declineUpdate, async () => {
    orchestrator.declineCurrent();
  });

  ipcMain.handle(AutoUpdateChannels.invoke.getSettings, async () =>
    loadAutoUpdateSettings(settingsStore),
  );

  ipcMain.handle(AutoUpdateChannels.invoke.setSettings, async (_event, raw: unknown) => {
    if (!isSettingsShape(raw)) {
      throw new TypeError(
        "setAutoUpdateSettings: expected { autoCheckEnabled: boolean, declinedVersions: string[] }",
      );
    }
    saveAutoUpdateSettings(settingsStore, raw);
  });

  return () => {
    for (const channel of AUTO_UPDATE_INVOKE_LIST) {
      ipcMain.removeHandler(channel);
    }
  };
}
