import { describe, expect, test, vi } from "vitest";
import {
  createAutoUpdaterOrchestrator,
  AUTO_UPDATE_CHECK_INTERVAL_MS,
  type AutoUpdaterLike,
  type AutoUpdaterEventName,
  type RendererSender,
} from "../src/auto-updater-orchestrator.js";
import { AutoUpdateChannels, type UpdateInfoPayload } from "../src/auto-update-channels.js";
import {
  DEFAULT_AUTO_UPDATE_SETTINGS,
  type AutoUpdateSettingsStore,
} from "../src/auto-update-settings.js";

/**
 * AC (issue #36):
 *
 * - electron-updater integrated and pulls from GitHub Releases — wired by
 *   `main.ts`; this orchestrator is the testable seam over an
 *   `AutoUpdaterLike` shim.
 * - Background check fires on launch and every 6 hours — orchestrator's
 *   `start()` calls `checkForUpdates()` once and schedules a setInterval
 *   for `AUTO_UPDATE_CHECK_INTERVAL_MS` (= 6 hours).
 * - Found update downloads in background; prompt appears — orchestrator
 *   forwards `update-available` and `update-downloaded` events to the
 *   renderer via the supplied `RendererSender`.
 * - User-declined update does not auto-install on next launch — when
 *   `update-available` fires for a declined version, the orchestrator
 *   does NOT forward the event to the renderer (no banner).
 * - Auto-check setting persists; manual check works — orchestrator
 *   exposes `checkNow()`; honours `autoCheckEnabled = false` by skipping
 *   the periodic timer.
 * - Update failures handled gracefully (log + retry) — `error` events are
 *   forwarded to the renderer; orchestrator does NOT throw out of an
 *   event handler. The next interval call retries.
 */

function makeAutoUpdater(): AutoUpdaterLike & {
  emit: (event: AutoUpdaterEventName, payload: unknown) => void;
  checkForUpdates: ReturnType<typeof vi.fn>;
  quitAndInstall: ReturnType<typeof vi.fn>;
} {
  const listeners = new Map<AutoUpdaterEventName, Array<(arg: unknown) => void>>();
  return {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    on(event, listener) {
      const arr = listeners.get(event) ?? [];
      arr.push(listener as (arg: unknown) => void);
      listeners.set(event, arr);
    },
    removeAllListeners() {
      listeners.clear();
    },
    checkForUpdates: vi.fn().mockResolvedValue({ updateInfo: { version: "1.2.3" } }),
    quitAndInstall: vi.fn(),
    emit(event, payload) {
      const arr = listeners.get(event) ?? [];
      for (const fn of arr) fn(payload);
    },
  };
}

function makeSender(): RendererSender & {
  send: ReturnType<typeof vi.fn>;
  sent: Array<{ channel: string; payload: unknown }>;
} {
  const sent: Array<{ channel: string; payload: unknown }> = [];
  const send = vi.fn((channel: string, payload: unknown) => {
    sent.push({ channel, payload });
  });
  return { send, sent };
}

function memorySettingsStore(
  initial?: Partial<typeof DEFAULT_AUTO_UPDATE_SETTINGS>,
): AutoUpdateSettingsStore {
  let state = { ...DEFAULT_AUTO_UPDATE_SETTINGS, ...initial };
  return {
    read: () => ({ ...state, declinedVersions: [...state.declinedVersions] }),
    write: (next) => {
      state = { ...next, declinedVersions: [...next.declinedVersions] };
    },
  };
}

describe("AutoUpdaterOrchestrator", () => {
  test("AUTO_UPDATE_CHECK_INTERVAL_MS is six hours", () => {
    expect(AUTO_UPDATE_CHECK_INTERVAL_MS).toBe(6 * 60 * 60 * 1000);
  });

  test("start() triggers an immediate checkForUpdates", async () => {
    const updater = makeAutoUpdater();
    const sender = makeSender();
    const orchestrator = createAutoUpdaterOrchestrator({
      autoUpdater: updater,
      sender,
      settingsStore: memorySettingsStore(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    orchestrator.start();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
    orchestrator.stop();
  });

  test("start() does NOT run the periodic timer when autoCheckEnabled = false", () => {
    vi.useFakeTimers();
    const updater = makeAutoUpdater();
    const sender = makeSender();
    const orchestrator = createAutoUpdaterOrchestrator({
      autoUpdater: updater,
      sender,
      settingsStore: memorySettingsStore({ autoCheckEnabled: false }),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    orchestrator.start();
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
    vi.advanceTimersByTime(AUTO_UPDATE_CHECK_INTERVAL_MS * 2);
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
    orchestrator.stop();
    vi.useRealTimers();
  });

  test("start() schedules a check every 6 hours when autoCheckEnabled = true", () => {
    vi.useFakeTimers();
    const updater = makeAutoUpdater();
    const sender = makeSender();
    const orchestrator = createAutoUpdaterOrchestrator({
      autoUpdater: updater,
      sender,
      settingsStore: memorySettingsStore(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    orchestrator.start();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(AUTO_UPDATE_CHECK_INTERVAL_MS);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(AUTO_UPDATE_CHECK_INTERVAL_MS);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(3);

    orchestrator.stop();
    vi.useRealTimers();
  });

  test("forwards update-available event to the renderer", () => {
    const updater = makeAutoUpdater();
    const sender = makeSender();
    const orchestrator = createAutoUpdaterOrchestrator({
      autoUpdater: updater,
      sender,
      settingsStore: memorySettingsStore(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    orchestrator.start();
    updater.emit("update-available", { version: "1.2.3" });

    const sent = sender.sent.find((m) => m.channel === AutoUpdateChannels.events.updateAvailable);
    expect(sent).toBeDefined();
    expect((sent!.payload as UpdateInfoPayload).version).toBe("1.2.3");
    orchestrator.stop();
  });

  test("does NOT forward update-available for declined versions", () => {
    const updater = makeAutoUpdater();
    const sender = makeSender();
    const orchestrator = createAutoUpdaterOrchestrator({
      autoUpdater: updater,
      sender,
      settingsStore: memorySettingsStore({ declinedVersions: ["1.2.3"] }),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    orchestrator.start();
    updater.emit("update-available", { version: "1.2.3" });

    const sent = sender.sent.find((m) => m.channel === AutoUpdateChannels.events.updateAvailable);
    expect(sent).toBeUndefined();
    orchestrator.stop();
  });

  test("forwards update-downloaded event to the renderer", () => {
    const updater = makeAutoUpdater();
    const sender = makeSender();
    const orchestrator = createAutoUpdaterOrchestrator({
      autoUpdater: updater,
      sender,
      settingsStore: memorySettingsStore(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    orchestrator.start();
    updater.emit("update-downloaded", { version: "1.2.3" });

    const sent = sender.sent.find((m) => m.channel === AutoUpdateChannels.events.updateDownloaded);
    expect(sent).toBeDefined();
    orchestrator.stop();
  });

  test("forwards download-progress event to the renderer", () => {
    const updater = makeAutoUpdater();
    const sender = makeSender();
    const orchestrator = createAutoUpdaterOrchestrator({
      autoUpdater: updater,
      sender,
      settingsStore: memorySettingsStore(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    orchestrator.start();
    updater.emit("download-progress", {
      bytesPerSecond: 100,
      percent: 50,
      total: 1000,
      transferred: 500,
    });

    const sent = sender.sent.find((m) => m.channel === AutoUpdateChannels.events.downloadProgress);
    expect(sent).toBeDefined();
    orchestrator.stop();
  });

  test("forwards error event to the renderer (does NOT throw)", () => {
    const updater = makeAutoUpdater();
    const sender = makeSender();
    const errorLog = vi.fn();
    const orchestrator = createAutoUpdaterOrchestrator({
      autoUpdater: updater,
      sender,
      settingsStore: memorySettingsStore(),
      logger: { info: vi.fn(), warn: vi.fn(), error: errorLog },
    });

    orchestrator.start();
    expect(() => updater.emit("error", new Error("boom"))).not.toThrow();

    const sent = sender.sent.find((m) => m.channel === AutoUpdateChannels.events.updateError);
    expect(sent).toBeDefined();
    expect(errorLog).toHaveBeenCalled();
    orchestrator.stop();
  });

  test("checkNow() always triggers checkForUpdates regardless of autoCheckEnabled", async () => {
    const updater = makeAutoUpdater();
    const sender = makeSender();
    const orchestrator = createAutoUpdaterOrchestrator({
      autoUpdater: updater,
      sender,
      settingsStore: memorySettingsStore({ autoCheckEnabled: false }),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    await orchestrator.checkNow();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  test("installAndRelaunch() calls quitAndInstall on the underlying updater", () => {
    const updater = makeAutoUpdater();
    const sender = makeSender();
    const orchestrator = createAutoUpdaterOrchestrator({
      autoUpdater: updater,
      sender,
      settingsStore: memorySettingsStore(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    orchestrator.installAndRelaunch();
    expect(updater.quitAndInstall).toHaveBeenCalledTimes(1);
  });

  test("declineCurrent() persists the version to the declined list", () => {
    const updater = makeAutoUpdater();
    const sender = makeSender();
    const store = memorySettingsStore();
    const orchestrator = createAutoUpdaterOrchestrator({
      autoUpdater: updater,
      sender,
      settingsStore: store,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    orchestrator.start();
    updater.emit("update-available", { version: "1.2.3" });
    orchestrator.declineCurrent();

    expect(store.read().declinedVersions).toContain("1.2.3");
    orchestrator.stop();
  });

  test("declineCurrent() is a no-op when there's no current update info", () => {
    const updater = makeAutoUpdater();
    const sender = makeSender();
    const store = memorySettingsStore();
    const orchestrator = createAutoUpdaterOrchestrator({
      autoUpdater: updater,
      sender,
      settingsStore: store,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    orchestrator.declineCurrent();
    expect(store.read().declinedVersions).toEqual([]);
  });

  test("stop() clears the periodic timer and removes all listeners", () => {
    vi.useFakeTimers();
    const updater = makeAutoUpdater();
    const sender = makeSender();
    const orchestrator = createAutoUpdaterOrchestrator({
      autoUpdater: updater,
      sender,
      settingsStore: memorySettingsStore(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    orchestrator.start();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);

    orchestrator.stop();

    vi.advanceTimersByTime(AUTO_UPDATE_CHECK_INTERVAL_MS * 5);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  test("autoUpdater is configured to autoDownload but NOT autoInstallOnAppQuit", () => {
    const updater = makeAutoUpdater();
    const sender = makeSender();
    const orchestrator = createAutoUpdaterOrchestrator({
      autoUpdater: updater,
      sender,
      settingsStore: memorySettingsStore(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    orchestrator.start();
    // PRD: "Background check + auto-download + prompt to install. Never
    // auto-restarts mid-session."
    expect(updater.autoDownload).toBe(true);
    expect(updater.autoInstallOnAppQuit).toBe(false);
    orchestrator.stop();
  });
});
