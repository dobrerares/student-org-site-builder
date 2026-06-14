import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Site } from "@sosb/schema";
import { FONT_ASSET_PREFIX } from "@sosb/renderer";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { iframeSrcdoc } from "../src/iframe-srcdoc.js";

const baseSite = minimal as unknown as Site;

const INTER_PATH = `${FONT_ASSET_PREFIX}inter-latin-400-normal.woff2`;

/**
 * `URL.createObjectURL` is mocked to a stable, file-keyed fake so assertions
 * are deterministic and don't depend on jsdom/node's object-URL allocator.
 * The font-blobs module is a memoised singleton, so we `resetModules` per test
 * and re-import it fresh, ensuring the spy is in place before the first mint.
 */
let blobCounter = 0;

beforeEach(() => {
  blobCounter = 0;
  vi.resetModules();
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:font/${blobCounter++}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("font blob resolver (preview)", () => {
  test("fontBlobUrlForPath returns a blob URL for a renderer-owned font path", async () => {
    const { fontBlobUrlForPath } = await import("../src/font-blobs.js");
    const url = fontBlobUrlForPath(INTER_PATH);
    expect(url).toBeDefined();
    expect(url).toMatch(/^blob:font\//);
  });

  test("fontBlobUrlForPath returns undefined for non-font asset paths", async () => {
    const { fontBlobUrlForPath } = await import("../src/font-blobs.js");
    expect(fontBlobUrlForPath("assets/deadbeef.png")).toBeUndefined();
    expect(fontBlobUrlForPath("not-an-asset")).toBeUndefined();
  });

  test("blob URLs are minted once and memoised across calls", async () => {
    const { fontBlobUrlForPath } = await import("../src/font-blobs.js");
    const first = fontBlobUrlForPath(INTER_PATH);
    const callsAfterFirst = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls.length;
    const second = fontBlobUrlForPath(INTER_PATH);
    expect(second).toBe(first);
    // No new mint on the second call — the singleton is reused.
    expect((URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      callsAfterFirst,
    );
  });

  test("revokeFontBlobUrls revokes every minted URL", async () => {
    const { fontBlobUrlForPath, revokeFontBlobUrls } = await import("../src/font-blobs.js");
    fontBlobUrlForPath(INTER_PATH);
    const minted = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(minted).toBeGreaterThan(0);
    revokeFontBlobUrls();
    expect((URL.revokeObjectURL as ReturnType<typeof vi.fn>).mock.calls.length).toBe(minted);
  });

  test("the composed resolver checks fonts first, then falls through to the user-asset hash cache", async () => {
    const { fontBlobUrlForPath } = await import("../src/font-blobs.js");
    // Mirror editor-app's `displayUrlForAssetPath`: font cache first, then the
    // hash-keyed user-asset cache. This asserts the exact composition without
    // mounting the whole component.
    const hashCache = new Map<string, string>([["deadbeef", "blob:user/deadbeef"]]);
    const resolve = (path: string): string | undefined => {
      if (!path.startsWith("assets/")) return undefined;
      const fontUrl = fontBlobUrlForPath(path);
      if (fontUrl !== undefined) return fontUrl;
      const filename = path.slice("assets/".length);
      const dot = filename.lastIndexOf(".");
      const hash = dot >= 0 ? filename.slice(0, dot) : filename;
      return hashCache.get(hash);
    };

    // Font path -> font blob (not the raw path).
    const fontUrl = resolve(INTER_PATH);
    expect(fontUrl).toMatch(/^blob:font\//);
    expect(fontUrl).not.toBe(INTER_PATH);

    // User-asset path still resolves via the hash cache — no regression.
    expect(resolve("assets/deadbeef.png")).toBe("blob:user/deadbeef");
  });

  test("a minimal-theme preview emits @font-face src:url(blob:...) via the resolver", async () => {
    const { fontBlobUrlForPath } = await import("../src/font-blobs.js");
    const resolver = (path: string): string | undefined => fontBlobUrlForPath(path);

    const html = iframeSrcdoc(baseSite, "minimal", 0, resolver);

    // The resolver was consulted for fonts: the emitted @font-face src points
    // at a blob URL, not the raw renderer-owned asset path.
    expect(html).toContain("@font-face");
    expect(html).toMatch(/src:url\(blob:font\//);
    expect(html).not.toContain(`src:url(${FONT_ASSET_PREFIX}`);
  });
});
