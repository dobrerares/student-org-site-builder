import { describe, expect, test } from "vitest";
import { IpcChannels, IPC_CHANNEL_LIST } from "../src/ipc-channels.js";

/**
 * AC: the IPC bridge exposes a small, namespaced, typed channel surface.
 *
 * Channel names are stable strings that BOTH the preload (renderer side)
 * and main (host side) must agree on. We assert they exist with the names
 * the preload + main implementations import — a typo in either side breaks
 * IPC silently, so a single source of truth + a regression test is the
 * cheapest insurance.
 *
 * The required channels:
 *
 * - `sosb:open-site-dialog`             native open dialog -> returns path or null
 * - `sosb:save-site-dialog`             native save dialog -> returns path or null
 * - `sosb:get-recent-sites`             read recent-sites store
 * - `sosb:add-recent-site`              append to recent-sites store
 * - `sosb:clear-recent-sites`           wipe recent-sites store
 * - `sosb:process-asset-for-variants`   Sharp + responsive variants (#37)
 */
describe("IPC channel constants", () => {
  test("openSiteDialog channel name", () => {
    expect(IpcChannels.openSiteDialog).toBe("sosb:open-site-dialog");
  });

  test("saveSiteDialog channel name", () => {
    expect(IpcChannels.saveSiteDialog).toBe("sosb:save-site-dialog");
  });

  test("getRecentSites channel name", () => {
    expect(IpcChannels.getRecentSites).toBe("sosb:get-recent-sites");
  });

  test("addRecentSite channel name", () => {
    expect(IpcChannels.addRecentSite).toBe("sosb:add-recent-site");
  });

  test("clearRecentSites channel name", () => {
    expect(IpcChannels.clearRecentSites).toBe("sosb:clear-recent-sites");
  });

  test("processAssetForVariants channel name", () => {
    expect(IpcChannels.processAssetForVariants).toBe("sosb:process-asset-for-variants");
  });

  test("IPC_CHANNEL_LIST enumerates every channel exactly once", () => {
    const expected = [
      "sosb:open-site-dialog",
      "sosb:save-site-dialog",
      "sosb:get-recent-sites",
      "sosb:add-recent-site",
      "sosb:clear-recent-sites",
      "sosb:process-asset-for-variants",
    ];
    expect(IPC_CHANNEL_LIST.length).toBe(expected.length);
    for (const channel of expected) {
      expect(IPC_CHANNEL_LIST).toContain(channel);
    }
    // The list has no duplicates.
    expect(new Set(IPC_CHANNEL_LIST).size).toBe(IPC_CHANNEL_LIST.length);
  });

  test("every channel is namespaced under 'sosb:'", () => {
    for (const channel of IPC_CHANNEL_LIST) {
      expect(channel.startsWith("sosb:")).toBe(true);
    }
  });
});
