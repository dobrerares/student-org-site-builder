import { describe, expect, test } from "vitest";
import {
  AutoUpdateChannels,
  AUTO_UPDATE_EVENT_LIST,
  AUTO_UPDATE_INVOKE_LIST,
} from "../src/auto-update-channels.js";

/**
 * AC: the auto-updater exposes two surfaces over IPC.
 *
 * 1. **Push events** from main → renderer (`webContents.send`). These let
 *    the editor's UI react to update lifecycle changes (available,
 *    download progress, downloaded, errored).
 * 2. **Invoke channels** from renderer → main (`ipcRenderer.invoke`). These
 *    let the editor's UI trigger actions (manually check now, install &
 *    relaunch, persist auto-check toggle).
 *
 * Channel names are stable, namespaced under `sosb:update:` so they cannot
 * collide with existing `sosb:` channels (open/save/recent-sites). A typo
 * on either side breaks the bridge silently — single source of truth +
 * regression test is the cheapest insurance.
 */

describe("AutoUpdateChannels", () => {
  describe("event channels (main → renderer)", () => {
    test("update-available event channel name", () => {
      expect(AutoUpdateChannels.events.updateAvailable).toBe("sosb:update:available");
    });

    test("update-not-available event channel name", () => {
      expect(AutoUpdateChannels.events.updateNotAvailable).toBe("sosb:update:not-available");
    });

    test("update-downloaded event channel name", () => {
      expect(AutoUpdateChannels.events.updateDownloaded).toBe("sosb:update:downloaded");
    });

    test("update-error event channel name", () => {
      expect(AutoUpdateChannels.events.updateError).toBe("sosb:update:error");
    });

    test("download-progress event channel name", () => {
      expect(AutoUpdateChannels.events.downloadProgress).toBe("sosb:update:download-progress");
    });

    test("checking-for-update event channel name", () => {
      expect(AutoUpdateChannels.events.checkingForUpdate).toBe("sosb:update:checking");
    });

    test("AUTO_UPDATE_EVENT_LIST enumerates every event channel", () => {
      const expected = [
        "sosb:update:available",
        "sosb:update:not-available",
        "sosb:update:downloaded",
        "sosb:update:error",
        "sosb:update:download-progress",
        "sosb:update:checking",
      ];
      expect(AUTO_UPDATE_EVENT_LIST.length).toBe(expected.length);
      for (const channel of expected) {
        expect(AUTO_UPDATE_EVENT_LIST).toContain(channel);
      }
      expect(new Set(AUTO_UPDATE_EVENT_LIST).size).toBe(AUTO_UPDATE_EVENT_LIST.length);
    });
  });

  describe("invoke channels (renderer → main)", () => {
    test("checkForUpdates invoke channel name", () => {
      expect(AutoUpdateChannels.invoke.checkForUpdates).toBe("sosb:update:check");
    });

    test("installAndRelaunch invoke channel name", () => {
      expect(AutoUpdateChannels.invoke.installAndRelaunch).toBe("sosb:update:install");
    });

    test("declineUpdate invoke channel name", () => {
      expect(AutoUpdateChannels.invoke.declineUpdate).toBe("sosb:update:decline");
    });

    test("getAutoUpdateSettings invoke channel name", () => {
      expect(AutoUpdateChannels.invoke.getSettings).toBe("sosb:update:get-settings");
    });

    test("setAutoUpdateSettings invoke channel name", () => {
      expect(AutoUpdateChannels.invoke.setSettings).toBe("sosb:update:set-settings");
    });

    test("AUTO_UPDATE_INVOKE_LIST enumerates every invoke channel", () => {
      const expected = [
        "sosb:update:check",
        "sosb:update:install",
        "sosb:update:decline",
        "sosb:update:get-settings",
        "sosb:update:set-settings",
      ];
      expect(AUTO_UPDATE_INVOKE_LIST.length).toBe(expected.length);
      for (const channel of expected) {
        expect(AUTO_UPDATE_INVOKE_LIST).toContain(channel);
      }
      expect(new Set(AUTO_UPDATE_INVOKE_LIST).size).toBe(AUTO_UPDATE_INVOKE_LIST.length);
    });
  });

  test("every auto-update channel is namespaced under 'sosb:update:'", () => {
    const all: readonly string[] = [...AUTO_UPDATE_EVENT_LIST, ...AUTO_UPDATE_INVOKE_LIST];
    for (const channel of all) {
      expect(channel.startsWith("sosb:update:")).toBe(true);
    }
  });

  test("event and invoke channel sets do not overlap", () => {
    const events = new Set<string>(AUTO_UPDATE_EVENT_LIST);
    for (const invoke of AUTO_UPDATE_INVOKE_LIST) {
      expect(events.has(invoke)).toBe(false);
    }
  });
});
