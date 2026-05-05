import { describe, expect, test, vi } from "vitest";
import {
  createOpenSiteHandler,
  createSaveSiteHandler,
  type ElectronDialogLike,
} from "../src/dialog-handlers.js";

/**
 * AC: native file dialogs work for import, export, and "open folder".
 *
 * The dialog *handlers* are testable without spinning up Electron because
 * we inject the small `ElectronDialogLike` shape (just the two methods we
 * actually call) — at runtime the main process passes Electron's real
 * `dialog`. The handlers normalise Electron's `{ canceled, filePaths }` /
 * `{ canceled, filePath }` shapes into a plain `string | null` for the
 * renderer, which is the surface the IPC bridge actually exposes.
 */

describe("openSite dialog handler", () => {
  test("returns the chosen folder path on confirm", async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({
      canceled: false,
      filePaths: ["/Users/me/my-site"],
    });
    const dialog: ElectronDialogLike = {
      showOpenDialog,
      showSaveDialog: vi.fn(),
    };

    const handler = createOpenSiteHandler(dialog);
    const result = await handler();

    expect(result).toBe("/Users/me/my-site");
    expect(showOpenDialog).toHaveBeenCalledTimes(1);
  });

  test("returns null when the user cancels", async () => {
    const dialog: ElectronDialogLike = {
      showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
      showSaveDialog: vi.fn(),
    };

    const handler = createOpenSiteHandler(dialog);
    const result = await handler();

    expect(result).toBeNull();
  });

  test("requests a directory selection (sites are folders, per PRD)", async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({ canceled: true, filePaths: [] });
    const dialog: ElectronDialogLike = {
      showOpenDialog,
      showSaveDialog: vi.fn(),
    };

    const handler = createOpenSiteHandler(dialog);
    await handler();

    const opts = showOpenDialog.mock.calls[0]![0] as {
      properties?: readonly string[];
    };
    expect(opts.properties).toContain("openDirectory");
  });
});

describe("saveSite dialog handler", () => {
  test("returns the chosen path on confirm", async () => {
    const dialog: ElectronDialogLike = {
      showOpenDialog: vi.fn(),
      showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: "/Users/me/out.zip" }),
    };

    const handler = createSaveSiteHandler(dialog);
    const result = await handler();

    expect(result).toBe("/Users/me/out.zip");
  });

  test("returns null when the user cancels", async () => {
    const dialog: ElectronDialogLike = {
      showOpenDialog: vi.fn(),
      showSaveDialog: vi.fn().mockResolvedValue({ canceled: true, filePath: undefined }),
    };

    const handler = createSaveSiteHandler(dialog);
    const result = await handler();

    expect(result).toBeNull();
  });

  test("offers a default zip filename", async () => {
    const showSaveDialog = vi.fn().mockResolvedValue({ canceled: true, filePath: undefined });
    const dialog: ElectronDialogLike = {
      showOpenDialog: vi.fn(),
      showSaveDialog,
    };

    const handler = createSaveSiteHandler(dialog);
    await handler({ defaultName: "my-site.zip" });

    const opts = showSaveDialog.mock.calls[0]![0] as { defaultPath?: string };
    expect(opts.defaultPath).toBe("my-site.zip");
  });
});
