/**
 * The asset-pipeline IPC channel must be present in the registry — both
 * as a string constant and in the enumerable IPC_CHANNEL_LIST that the
 * handler-registration walker uses.
 *
 * Also asserts the preload API surface gains a `processAssetForVariants`
 * method backed by exactly that channel — the renderer cannot call any
 * IPC channel that isn't on the allowlist.
 */

import { describe, expect, test } from "vitest";

import { IpcChannels, IPC_CHANNEL_LIST } from "../src/ipc-channels.js";
import { PRELOAD_API_METHODS, buildPreloadApi } from "../src/preload-surface.js";

describe("IpcChannels — asset processing channel exists", () => {
  test("IpcChannels.processAssetForVariants is namespaced under sosb:", () => {
    expect(IpcChannels.processAssetForVariants).toBe("sosb:process-asset-for-variants");
  });

  test("IPC_CHANNEL_LIST includes the asset channel", () => {
    expect(IPC_CHANNEL_LIST).toContain(IpcChannels.processAssetForVariants);
  });
});

describe("Preload API — processAssetForVariants", () => {
  test("PRELOAD_API_METHODS includes the new method", () => {
    expect(PRELOAD_API_METHODS).toContain("processAssetForVariants");
  });

  test("buildPreloadApi.processAssetForVariants invokes the right channel", async () => {
    let calledChannel: string | null = null;
    const fakeIpc = {
      invoke: async (channel: string) => {
        calledChannel = channel;
        return {
          canonical: {
            bytes: new Uint8Array([0]),
            mime: "image/jpeg" as const,
            width: 1,
            height: 1,
          },
          variants: [],
        };
      },
    };
    const api = buildPreloadApi(fakeIpc);
    await api.processAssetForVariants({
      bytes: new Uint8Array([0xff, 0xd8, 0xff]),
      declaredMime: "image/jpeg",
      name: "photo.jpg",
      alt: "Photo",
      variantWidths: [400, 800, 1600],
    });
    expect(calledChannel).toBe(IpcChannels.processAssetForVariants);
  });
});
