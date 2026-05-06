import { describe, expect, test, vi } from "vitest";
import {
  PRELOAD_API_KEY,
  PRELOAD_API_METHODS,
  buildPreloadApi,
  type IpcRendererLike,
} from "../src/preload-surface.js";

/**
 * AC: the preload script exposes a small, typed renderer-side API via
 * `contextBridge.exposeInMainWorld(PRELOAD_API_KEY, api)`.
 *
 * The actual `contextBridge.exposeInMainWorld` call is a one-liner that
 * runs only inside Electron's preload context, so we don't unit-test it
 * directly. What we DO test is the *shape* of the API the preload
 * exposes — every function the renderer calls must be present, must be a
 * function, and must round-trip through the IPC channels we agreed on
 * (asserted in `ipc-channels.test.ts`).
 *
 * `buildPreloadApi(ipcRenderer)` is the seam: pass a fake `ipcRenderer`,
 * inspect what methods are present, and verify each one calls
 * `ipcRenderer.invoke` with the expected channel name.
 */

describe("preload API surface", () => {
  test("PRELOAD_API_KEY is the namespaced window key", () => {
    expect(PRELOAD_API_KEY).toBe("sosb");
  });

  test("PRELOAD_API_METHODS lists every method the renderer can call", () => {
    // Extended in #36 with the auto-update routes; the dialog + recent-site
    // entries from #35 still come first.
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
    ]);
  });

  test("buildPreloadApi exposes every method as a function", () => {
    const ipc: IpcRendererLike = { invoke: vi.fn().mockResolvedValue(null) };
    const api = buildPreloadApi(ipc);

    for (const name of PRELOAD_API_METHODS) {
      expect(typeof (api as unknown as Record<string, unknown>)[name]).toBe("function");
    }
  });

  test("openSiteDialog invokes the open-site channel", async () => {
    const invoke = vi.fn().mockResolvedValue("/path/to/site");
    const api = buildPreloadApi({ invoke });
    const result = await api.openSiteDialog();
    expect(invoke).toHaveBeenCalledWith("sosb:open-site-dialog");
    expect(result).toBe("/path/to/site");
  });

  test("saveSiteDialog invokes the save-site channel with default options", async () => {
    const invoke = vi.fn().mockResolvedValue("/path/to/out.zip");
    const api = buildPreloadApi({ invoke });
    await api.saveSiteDialog({ defaultName: "my-site.zip" });
    expect(invoke).toHaveBeenCalledWith("sosb:save-site-dialog", {
      defaultName: "my-site.zip",
    });
  });

  test("getRecentSites invokes the get-recent-sites channel", async () => {
    const invoke = vi.fn().mockResolvedValue(["/a", "/b"]);
    const api = buildPreloadApi({ invoke });
    const list = await api.getRecentSites();
    expect(invoke).toHaveBeenCalledWith("sosb:get-recent-sites");
    expect(list).toEqual(["/a", "/b"]);
  });

  test("addRecentSite invokes the add-recent-site channel with the path", async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    const api = buildPreloadApi({ invoke });
    await api.addRecentSite("/sites/foo");
    expect(invoke).toHaveBeenCalledWith("sosb:add-recent-site", "/sites/foo");
  });

  test("clearRecentSites invokes the clear-recent-sites channel", async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    const api = buildPreloadApi({ invoke });
    await api.clearRecentSites();
    expect(invoke).toHaveBeenCalledWith("sosb:clear-recent-sites");
  });
});
