import { IpcChannels, IPC_CHANNEL_LIST, type SaveSiteDialogOptions } from "./ipc-channels.js";
import {
  createOpenSiteHandler,
  createSaveSiteHandler,
  type ElectronDialogLike,
} from "./dialog-handlers.js";
import {
  addRecentSite,
  clearRecentSites,
  loadRecentSites,
  type RecentSitesStore,
} from "./recent-sites.js";
import {
  createAssetIpcHandler,
  type AssetIpcDeps,
  type ProcessAssetForVariantsRequest,
} from "./asset-handlers.js";

/**
 * The slice of `ipcMain` we actually use. The real `ipcMain` is global
 * and side-effecting, but `registerIpcHandlers` accepts this shim so the
 * wiring is testable in node.
 */
export interface IpcMainLike {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void;
  removeHandler(channel: string): void;
}

export interface RegisterIpcHandlersDeps {
  readonly ipcMain: IpcMainLike;
  readonly dialog: ElectronDialogLike;
  readonly store: RecentSitesStore;
  /**
   * Asset processor (#37): runs Sharp in the main process. Optional
   * because some test paths only exercise the dialog/recent-sites
   * handlers; in production `main.ts` always wires one in.
   */
  readonly assetProcessor?: AssetIpcDeps["processor"];
}

/**
 * Register one IPC handler per channel in `IPC_CHANNEL_LIST`. Returns a
 * `dispose()` that unregisters them all (matters for tests, hot reload,
 * and `app.quit` cleanup paths).
 */
export function registerIpcHandlers(deps: RegisterIpcHandlersDeps): () => void {
  const { ipcMain, dialog, store, assetProcessor } = deps;

  const open = createOpenSiteHandler(dialog);
  const save = createSaveSiteHandler(dialog);

  ipcMain.handle(IpcChannels.openSiteDialog, async () => open());
  ipcMain.handle(IpcChannels.saveSiteDialog, async (_event, opts: unknown) =>
    save((opts as SaveSiteDialogOptions | undefined) ?? {}),
  );
  ipcMain.handle(IpcChannels.getRecentSites, async () => loadRecentSites(store));
  ipcMain.handle(IpcChannels.addRecentSite, async (_event, path: unknown) => {
    if (typeof path !== "string") {
      throw new TypeError("addRecentSite: expected a string path");
    }
    return addRecentSite(store, path);
  });
  ipcMain.handle(IpcChannels.clearRecentSites, async () => {
    clearRecentSites(store);
  });

  if (assetProcessor) {
    const handle = createAssetIpcHandler({ processor: assetProcessor });
    ipcMain.handle(IpcChannels.processAssetForVariants, async (_event, request: unknown) =>
      handle(request as ProcessAssetForVariantsRequest),
    );
  } else {
    // No processor wired -- the channel still gets a handler that
    // rejects loudly so the renderer doesn't see a silent IPC timeout.
    ipcMain.handle(IpcChannels.processAssetForVariants, async () => {
      throw new Error("processAssetForVariants: no asset processor wired in this build");
    });
  }

  return () => {
    for (const channel of IPC_CHANNEL_LIST) {
      ipcMain.removeHandler(channel);
    }
  };
}
