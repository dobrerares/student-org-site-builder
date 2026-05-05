import { describe, expect, test, vi } from "vitest";
import {
  registerAutoUpdateHandlers,
  type RegisterAutoUpdateHandlersDeps,
} from "../src/register-auto-update-handlers.js";
import { AutoUpdateChannels, AUTO_UPDATE_INVOKE_LIST } from "../src/auto-update-channels.js";
import {
  DEFAULT_AUTO_UPDATE_SETTINGS,
  type AutoUpdateSettingsStore,
} from "../src/auto-update-settings.js";
import type { IpcMainLike } from "../src/register-ipc-handlers.js";
import type { AutoUpdaterOrchestrator } from "../src/auto-updater-orchestrator.js";

/**
 * AC: every renderer-invoke channel in `AUTO_UPDATE_INVOKE_LIST` is
 * registered as a handler. The handlers route to the orchestrator
 * (`checkNow`, `installAndRelaunch`, `declineCurrent`) or the settings
 * store (`getSettings`, `setSettings`).
 */

function fakeIpcMain(): IpcMainLike & {
  handlers: Map<string, (...args: unknown[]) => unknown>;
} {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  return {
    handlers,
    handle: (channel, listener) => {
      handlers.set(channel, listener as (...args: unknown[]) => unknown);
    },
    removeHandler: (channel) => {
      handlers.delete(channel);
    },
  };
}

function fakeOrchestrator(): AutoUpdaterOrchestrator & {
  checkNow: ReturnType<typeof vi.fn>;
  installAndRelaunch: ReturnType<typeof vi.fn>;
  declineCurrent: ReturnType<typeof vi.fn>;
} {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    checkNow: vi.fn().mockResolvedValue(undefined),
    installAndRelaunch: vi.fn(),
    declineCurrent: vi.fn(),
  };
}

function memoryStore(
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

interface MakeDepsResult {
  readonly ipcMain: ReturnType<typeof fakeIpcMain>;
  readonly orchestrator: ReturnType<typeof fakeOrchestrator>;
  readonly settingsStore: AutoUpdateSettingsStore;
}

function makeDeps(overrides: Partial<RegisterAutoUpdateHandlersDeps> = {}): MakeDepsResult {
  const ipcMain = overrides.ipcMain
    ? (overrides.ipcMain as ReturnType<typeof fakeIpcMain>)
    : fakeIpcMain();
  const orchestrator = overrides.orchestrator
    ? (overrides.orchestrator as ReturnType<typeof fakeOrchestrator>)
    : fakeOrchestrator();
  const settingsStore = overrides.settingsStore ?? memoryStore();
  return { ipcMain, orchestrator, settingsStore };
}

describe("registerAutoUpdateHandlers", () => {
  test("registers a handler for every invoke channel", () => {
    const deps = makeDeps();
    registerAutoUpdateHandlers(deps);
    for (const channel of AUTO_UPDATE_INVOKE_LIST) {
      expect(deps.ipcMain.handlers.has(channel), `missing handler for ${channel}`).toBe(true);
    }
    expect(deps.ipcMain.handlers.size).toBe(AUTO_UPDATE_INVOKE_LIST.length);
  });

  test("checkForUpdates handler calls orchestrator.checkNow", async () => {
    const deps = makeDeps();
    registerAutoUpdateHandlers(deps);

    const handler = deps.ipcMain.handlers.get(AutoUpdateChannels.invoke.checkForUpdates)!;
    await handler({});
    expect(deps.orchestrator.checkNow).toHaveBeenCalledTimes(1);
  });

  test("installAndRelaunch handler calls orchestrator.installAndRelaunch", async () => {
    const deps = makeDeps();
    registerAutoUpdateHandlers(deps);

    const handler = deps.ipcMain.handlers.get(AutoUpdateChannels.invoke.installAndRelaunch)!;
    await handler({});
    expect(deps.orchestrator.installAndRelaunch).toHaveBeenCalledTimes(1);
  });

  test("declineUpdate handler calls orchestrator.declineCurrent", async () => {
    const deps = makeDeps();
    registerAutoUpdateHandlers(deps);

    const handler = deps.ipcMain.handlers.get(AutoUpdateChannels.invoke.declineUpdate)!;
    await handler({});
    expect(deps.orchestrator.declineCurrent).toHaveBeenCalledTimes(1);
  });

  test("getSettings handler returns the persisted settings", async () => {
    const deps = makeDeps({
      settingsStore: memoryStore({ autoCheckEnabled: false }),
    });
    registerAutoUpdateHandlers(deps);

    const handler = deps.ipcMain.handlers.get(AutoUpdateChannels.invoke.getSettings)!;
    const result = await handler({});
    expect(result).toMatchObject({ autoCheckEnabled: false });
  });

  test("setSettings handler persists new settings", async () => {
    const deps = makeDeps();
    registerAutoUpdateHandlers(deps);

    const handler = deps.ipcMain.handlers.get(AutoUpdateChannels.invoke.setSettings)!;
    await handler({}, { autoCheckEnabled: false, declinedVersions: ["9.9.9"] });

    expect(deps.settingsStore.read()).toEqual({
      autoCheckEnabled: false,
      declinedVersions: ["9.9.9"],
    });
  });

  test("setSettings handler rejects malformed input", async () => {
    const deps = makeDeps();
    registerAutoUpdateHandlers(deps);

    const handler = deps.ipcMain.handlers.get(AutoUpdateChannels.invoke.setSettings)!;
    await expect(handler({}, "not-an-object")).rejects.toThrow();
  });

  test("returned dispose function removes every handler", () => {
    const deps = makeDeps();
    const dispose = registerAutoUpdateHandlers(deps);
    expect(deps.ipcMain.handlers.size).toBe(AUTO_UPDATE_INVOKE_LIST.length);

    dispose();

    expect(deps.ipcMain.handlers.size).toBe(0);
  });
});
