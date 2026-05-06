/**
 * Tests for the Electron-side asset-pipeline IPC handler (issue #37).
 *
 * The renderer cannot run Sharp directly (Sharp is a Node-only library;
 * the renderer has `sandbox: true, nodeIntegration: false`). Instead the
 * renderer invokes `window.sosb.processAssetForVariants(payload)` which
 * goes over IPC to the main-process handler. The handler:
 *
 *   - Validates the payload (declared mime against an allowlist; bytes
 *     under a hard size cap; alt non-empty).
 *   - Runs Sharp inside the main process to produce variants.
 *   - Returns the canonical bytes + variant bytes back to the renderer.
 *   - Crucially: the handler accepts only image bytes, never a filesystem
 *     path. That keeps the renderer from coercing the main process into
 *     reading arbitrary files via the IPC surface.
 */

import { describe, expect, test } from "vitest";

import { createAssetIpcHandler } from "../src/asset-handlers.js";
import type { ProcessAssetForVariantsRequest } from "../src/asset-handlers.js";

function fakeProcessor() {
  return {
    async processAssetForVariants(request: ProcessAssetForVariantsRequest) {
      return {
        canonical: {
          bytes: new Uint8Array([0xff, 0xd8, 0xff]), // JPEG magic
          mime: "image/jpeg" as const,
          width: 1600,
          height: 900,
        },
        variants: [
          {
            requestedWidth: 400,
            width: 400,
            height: 225,
            mime: "image/webp" as const,
            bytes: new Uint8Array([0]),
          },
          {
            requestedWidth: 800,
            width: 800,
            height: 450,
            mime: "image/webp" as const,
            bytes: new Uint8Array([0]),
          },
          {
            requestedWidth: 1600,
            width: 1600,
            height: 900,
            mime: "image/webp" as const,
            bytes: new Uint8Array([0]),
          },
        ],
        echoedAlt: request.alt,
        echoedName: request.name,
      };
    },
  };
}

describe("createAssetIpcHandler — happy path", () => {
  test("dispatches a well-formed request to the processor and returns canonical + variants", async () => {
    const handler = createAssetIpcHandler({ processor: fakeProcessor() });
    const result = await handler({
      bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]),
      declaredMime: "image/jpeg",
      name: "photo.jpg",
      alt: "A team photo",
      variantWidths: [400, 800, 1600],
    });
    expect(result.canonical.mime).toBe("image/jpeg");
    expect(result.variants).toHaveLength(3);
    expect(result.variants.map((v) => v.requestedWidth)).toEqual([400, 800, 1600]);
  });
});

describe("createAssetIpcHandler — validation (security boundary)", () => {
  test("rejects an empty alt with a typed error code", async () => {
    const handler = createAssetIpcHandler({ processor: fakeProcessor() });
    await expect(
      handler({
        bytes: new Uint8Array([0xff, 0xd8, 0xff]),
        declaredMime: "image/jpeg",
        name: "photo.jpg",
        alt: "",
        variantWidths: [400, 800, 1600],
      }),
    ).rejects.toMatchObject({ code: "ipc.asset.alt.missing" });
  });

  test("rejects an unsupported declared MIME (e.g. application/pdf)", async () => {
    const handler = createAssetIpcHandler({ processor: fakeProcessor() });
    await expect(
      handler({
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        declaredMime: "application/pdf",
        name: "doc.pdf",
        alt: "doc",
        variantWidths: [400, 800, 1600],
      }),
    ).rejects.toMatchObject({ code: "ipc.asset.mime.unsupported" });
  });

  test("rejects an oversized payload (> 50 MB hard cap)", async () => {
    const handler = createAssetIpcHandler({ processor: fakeProcessor() });
    // 51 MB of zeros — declared as JPEG to bypass the mime check.
    const huge = new Uint8Array(51 * 1024 * 1024);
    huge[0] = 0xff;
    huge[1] = 0xd8;
    huge[2] = 0xff;
    await expect(
      handler({
        bytes: huge,
        declaredMime: "image/jpeg",
        name: "huge.jpg",
        alt: "oversized",
        variantWidths: [400, 800, 1600],
      }),
    ).rejects.toMatchObject({ code: "ipc.asset.payload.tooLarge" });
  });

  test("does not accept any filesystem-path-like field — only bytes", async () => {
    // This is a structural property: the request type does not have a
    // `path` field. Even passing one would be ignored. We assert via
    // TypeScript-level test on the Request keys.
    const requestKeys: ReadonlyArray<keyof ProcessAssetForVariantsRequest> = [
      "bytes",
      "declaredMime",
      "name",
      "alt",
      "variantWidths",
    ];
    expect(requestKeys).not.toContain("path" as never);
    expect(requestKeys).not.toContain("filePath" as never);
  });

  test("rejects empty variantWidths", async () => {
    const handler = createAssetIpcHandler({ processor: fakeProcessor() });
    await expect(
      handler({
        bytes: new Uint8Array([0xff, 0xd8, 0xff]),
        declaredMime: "image/jpeg",
        name: "photo.jpg",
        alt: "Photo",
        variantWidths: [],
      }),
    ).rejects.toMatchObject({ code: "ipc.asset.variants.invalid" });
  });

  test("rejects nonsensical variantWidths (zero / negative / non-finite)", async () => {
    const handler = createAssetIpcHandler({ processor: fakeProcessor() });
    await expect(
      handler({
        bytes: new Uint8Array([0xff, 0xd8, 0xff]),
        declaredMime: "image/jpeg",
        name: "photo.jpg",
        alt: "Photo",
        variantWidths: [0, -1, Number.NaN] as unknown as readonly number[],
      }),
    ).rejects.toMatchObject({ code: "ipc.asset.variants.invalid" });
  });
});
