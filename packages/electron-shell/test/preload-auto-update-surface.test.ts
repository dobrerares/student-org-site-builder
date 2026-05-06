import { describe, expect, test, vi } from "vitest";
import {
  buildPreloadApi,
  PRELOAD_API_METHODS,
  type IpcRendererLike,
} from "../src/preload-surface.js";
import { AutoUpdateChannels } from "../src/auto-update-channels.js";

/**
 * AC: the preload exposes the auto-update surface alongside the existing
 * dialog / recent-sites methods. Renderer reaches it via `window.sosb`:
 *
 * - `checkForUpdates()` / `installUpdateAndRelaunch()` /
 *   `declineUpdate()` — invoke routes.
 * - `getAutoUpdateSettings()` / `setAutoUpdateSettings(s)` — invoke routes.
 * - `onUpdateEvent(channel, listener)` — subscribe to push events from
 *   main; returns an unsubscribe function.
 */

interface IpcRendererForEvents extends IpcRendererLike {
  on(channel: string, listener: (event: unknown, payload: unknown) => void): void;
  removeListener(channel: string, listener: (event: unknown, payload: unknown) => void): void;
}

function fakeIpc(): IpcRendererForEvents & {
  invoke: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  listeners: Map<string, Set<(event: unknown, payload: unknown) => void>>;
} {
  const listeners = new Map<string, Set<(event: unknown, payload: unknown) => void>>();
  const on = vi.fn((channel: string, listener: (event: unknown, payload: unknown) => void) => {
    const set = listeners.get(channel) ?? new Set();
    set.add(listener);
    listeners.set(channel, set);
  });
  const removeListener = vi.fn(
    (channel: string, listener: (event: unknown, payload: unknown) => void) => {
      listeners.get(channel)?.delete(listener);
    },
  );
  return {
    invoke: vi.fn().mockResolvedValue(undefined),
    on,
    removeListener,
    listeners,
  };
}

describe("preload auto-update surface", () => {
  test("PRELOAD_API_METHODS lists every method including auto-update routes", () => {
    expect(PRELOAD_API_METHODS).toEqual([
      "openSiteDialog",
      "saveSiteDialog",
      "getRecentSites",
      "addRecentSite",
      "clearRecentSites",
      "checkForUpdates",
      "installUpdateAndRelaunch",
      "declineUpdate",
      "getAutoUpdateSettings",
      "setAutoUpdateSettings",
      "onUpdateEvent",
      "processAssetForVariants",
    ]);
  });

  test("checkForUpdates invokes the check channel", async () => {
    const ipc = fakeIpc();
    const api = buildPreloadApi(ipc);
    await api.checkForUpdates();
    expect(ipc.invoke).toHaveBeenCalledWith(AutoUpdateChannels.invoke.checkForUpdates);
  });

  test("installUpdateAndRelaunch invokes the install channel", async () => {
    const ipc = fakeIpc();
    const api = buildPreloadApi(ipc);
    await api.installUpdateAndRelaunch();
    expect(ipc.invoke).toHaveBeenCalledWith(AutoUpdateChannels.invoke.installAndRelaunch);
  });

  test("declineUpdate invokes the decline channel", async () => {
    const ipc = fakeIpc();
    const api = buildPreloadApi(ipc);
    await api.declineUpdate();
    expect(ipc.invoke).toHaveBeenCalledWith(AutoUpdateChannels.invoke.declineUpdate);
  });

  test("getAutoUpdateSettings invokes the get-settings channel and returns the result", async () => {
    const ipc = fakeIpc();
    ipc.invoke.mockResolvedValueOnce({ autoCheckEnabled: false, declinedVersions: ["1.0.0"] });
    const api = buildPreloadApi(ipc);
    const result = await api.getAutoUpdateSettings();
    expect(ipc.invoke).toHaveBeenCalledWith(AutoUpdateChannels.invoke.getSettings);
    expect(result.autoCheckEnabled).toBe(false);
    expect(result.declinedVersions).toEqual(["1.0.0"]);
  });

  test("setAutoUpdateSettings invokes the set-settings channel with the payload", async () => {
    const ipc = fakeIpc();
    const api = buildPreloadApi(ipc);
    await api.setAutoUpdateSettings({
      autoCheckEnabled: false,
      declinedVersions: [],
    });
    expect(ipc.invoke).toHaveBeenCalledWith(AutoUpdateChannels.invoke.setSettings, {
      autoCheckEnabled: false,
      declinedVersions: [],
    });
  });

  test("onUpdateEvent subscribes via ipcRenderer.on and forwards the payload", () => {
    const ipc = fakeIpc();
    const api = buildPreloadApi(ipc);
    const handler = vi.fn();

    api.onUpdateEvent(AutoUpdateChannels.events.updateAvailable, handler);

    expect(ipc.on).toHaveBeenCalledWith(
      AutoUpdateChannels.events.updateAvailable,
      expect.any(Function),
    );

    // Simulate the main process sending an event.
    const calls = ipc.listeners.get(AutoUpdateChannels.events.updateAvailable);
    expect(calls?.size).toBe(1);
    for (const fn of calls!) fn({}, { version: "1.2.3" });

    expect(handler).toHaveBeenCalledWith({ version: "1.2.3" });
  });

  test("onUpdateEvent returns an unsubscribe function", () => {
    const ipc = fakeIpc();
    const api = buildPreloadApi(ipc);
    const handler = vi.fn();

    const unsubscribe = api.onUpdateEvent(AutoUpdateChannels.events.updateDownloaded, handler);
    expect(typeof unsubscribe).toBe("function");

    expect(ipc.listeners.get(AutoUpdateChannels.events.updateDownloaded)?.size).toBe(1);
    unsubscribe();
    expect(ipc.removeListener).toHaveBeenCalled();
    expect(ipc.listeners.get(AutoUpdateChannels.events.updateDownloaded)?.size).toBe(0);
  });
});
