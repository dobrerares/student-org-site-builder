import { describe, expect, test, vi } from "vitest";
import { registerIpcHandlers, type IpcMainLike } from "../src/register-ipc-handlers.js";
import { IpcChannels, IPC_CHANNEL_LIST } from "../src/ipc-channels.js";
import type { ElectronDialogLike } from "../src/dialog-handlers.js";
import type { RecentSitesStore } from "../src/recent-sites.js";

/**
 * AC (the wiring): the main process must register one handler per IPC
 * channel — if any channel is missing, the renderer's `invoke` of it
 * rejects at runtime with "no handler for channel". A regression here is
 * silent in dev (the renderer just sees a Promise rejection) but breaks
 * every native dialog.
 *
 * `registerIpcHandlers` accepts thin shims so the wiring is testable in
 * node (no real `ipcMain`, no real `dialog`).
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

function memoryStore(): RecentSitesStore {
  let list: readonly string[] = [];
  return {
    read: () => [...list],
    write: (next) => {
      list = [...next];
    },
  };
}

function fakeDialog(): ElectronDialogLike {
  return {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: true, filePath: undefined }),
  };
}

describe("registerIpcHandlers", () => {
  test("registers a handler for every channel in IPC_CHANNEL_LIST", () => {
    const ipc = fakeIpcMain();
    registerIpcHandlers({
      ipcMain: ipc,
      dialog: fakeDialog(),
      store: memoryStore(),
    });

    for (const channel of IPC_CHANNEL_LIST) {
      expect(ipc.handlers.has(channel), `missing handler for ${channel}`).toBe(true);
    }
    expect(ipc.handlers.size).toBe(IPC_CHANNEL_LIST.length);
  });

  test("openSiteDialog handler returns the chosen path", async () => {
    const ipc = fakeIpcMain();
    const dialog: ElectronDialogLike = {
      showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ["/picked"] }),
      showSaveDialog: vi.fn(),
    };
    registerIpcHandlers({ ipcMain: ipc, dialog, store: memoryStore() });

    const handler = ipc.handlers.get(IpcChannels.openSiteDialog)!;
    const result = await handler({});
    expect(result).toBe("/picked");
  });

  test("addRecentSite handler persists through the store", async () => {
    const ipc = fakeIpcMain();
    const store = memoryStore();
    registerIpcHandlers({ ipcMain: ipc, dialog: fakeDialog(), store });

    const add = ipc.handlers.get(IpcChannels.addRecentSite)!;
    await add({}, "/sites/foo");

    const get = ipc.handlers.get(IpcChannels.getRecentSites)!;
    const list = await get({});
    expect(list).toEqual(["/sites/foo"]);
  });

  test("returned dispose function unregisters every handler", () => {
    const ipc = fakeIpcMain();
    const dispose = registerIpcHandlers({
      ipcMain: ipc,
      dialog: fakeDialog(),
      store: memoryStore(),
    });
    expect(ipc.handlers.size).toBe(IPC_CHANNEL_LIST.length);

    dispose();

    expect(ipc.handlers.size).toBe(0);
  });
});
