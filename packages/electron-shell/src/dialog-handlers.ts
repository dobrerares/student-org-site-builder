import type { SaveSiteDialogOptions } from "./ipc-channels.js";

/**
 * Native dialog handlers, factored out of `main.ts` so they're unit-testable
 * in node without spinning up Electron. We accept the smallest subset of
 * Electron's `dialog` we actually use.
 */

export interface OpenDialogResultLike {
  readonly canceled: boolean;
  readonly filePaths: readonly string[];
}

export interface SaveDialogResultLike {
  readonly canceled: boolean;
  readonly filePath?: string | undefined;
}

export interface ElectronDialogLike {
  showOpenDialog(opts: {
    title?: string;
    properties?: readonly string[];
  }): Promise<OpenDialogResultLike>;
  showSaveDialog(opts: {
    title?: string;
    defaultPath?: string;
    filters?: ReadonlyArray<{ name: string; extensions: readonly string[] }>;
  }): Promise<SaveDialogResultLike>;
}

/**
 * Build the `openSiteDialog` IPC handler. Sites are folders on disk
 * (PRD: "Electron persistence: real filesystem. Sites are folders"), so
 * we open a directory selector.
 */
export function createOpenSiteHandler(dialog: ElectronDialogLike): () => Promise<string | null> {
  return async () => {
    const result = await dialog.showOpenDialog({
      title: "Open site folder",
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0] ?? null;
  };
}

/**
 * Build the `saveSiteDialog` IPC handler. The renderer can suggest a
 * default filename; the user picks the final destination. Returns the
 * chosen absolute path or `null` if the user cancelled.
 */
export function createSaveSiteHandler(
  dialog: ElectronDialogLike,
): (opts?: SaveSiteDialogOptions) => Promise<string | null> {
  return async (opts) => {
    const defaultName = opts?.defaultName ?? "site.zip";
    const result = await dialog.showSaveDialog({
      title: "Export site",
      defaultPath: defaultName,
      filters: [
        { name: "Site archive", extensions: ["zip"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (result.canceled) return null;
    return result.filePath ?? null;
  };
}
