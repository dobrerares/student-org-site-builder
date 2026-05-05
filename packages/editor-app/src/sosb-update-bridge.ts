/**
 * Adapter from `window.sosb` (the Electron preload surface) to the
 * `UpdateBridge` interface that `<UpdateBanner>` consumes.
 *
 * The editor-app stays decoupled from electron-shell: the banner takes
 * a generic bridge, and this adapter is the only file that knows the
 * actual IPC channel names. In the browser SPA `window.sosb` is
 * undefined, the adapter isn't constructed, and the banner is never
 * mounted (`isElectronShellAvailable(window.sosb)` is the gate).
 *
 * Channel names mirror `@sosb/electron-shell`'s `AutoUpdateChannels` —
 * we hard-code the strings here (instead of importing the constants)
 * so editor-app doesn't pull in the electron-shell package as a
 * dependency.
 */

import type { UpdateBridge, UpdateError, UpdateInfo } from "./update-banner.js";

/** Push channels emitted from the main process to the renderer. */
const UPDATE_AVAILABLE_CHANNEL = "sosb:update:available";
const UPDATE_DOWNLOADED_CHANNEL = "sosb:update:downloaded";
const UPDATE_ERROR_CHANNEL = "sosb:update:error";

/**
 * The slice of `window.sosb` we use here. The full surface is exposed
 * by `@sosb/electron-shell`'s preload — but we only depend on what
 * `UpdateBanner` calls.
 */
export interface SosbUpdateSurface {
  onUpdateEvent(channel: string, listener: (payload: unknown) => void): () => void;
  installUpdateAndRelaunch(): Promise<void>;
  declineUpdate(): Promise<void>;
  checkForUpdates(): Promise<void>;
}

export function isElectronShellAvailable(value: unknown): value is SosbUpdateSurface {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["onUpdateEvent"] === "function" &&
    typeof v["installUpdateAndRelaunch"] === "function" &&
    typeof v["declineUpdate"] === "function"
  );
}

export function createSosbUpdateBridge(sosb: SosbUpdateSurface): UpdateBridge {
  return {
    onUpdateAvailable: (listener) =>
      sosb.onUpdateEvent(UPDATE_AVAILABLE_CHANNEL, (payload) => {
        listener(payload as UpdateInfo);
      }),
    onUpdateDownloaded: (listener) =>
      sosb.onUpdateEvent(UPDATE_DOWNLOADED_CHANNEL, (payload) => {
        listener(payload as UpdateInfo);
      }),
    onUpdateError: (listener) =>
      sosb.onUpdateEvent(UPDATE_ERROR_CHANNEL, (payload) => {
        listener(payload as UpdateError);
      }),
    installAndRelaunch: async () => {
      await sosb.installUpdateAndRelaunch();
    },
    declineUpdate: async () => {
      await sosb.declineUpdate();
    },
  };
}
