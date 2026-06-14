import { describe, expect, test } from "vitest";
import { MemoryDriver } from "@sosb/vfs/memory";

import { exportZipBasename, mergeAssetVfs, populateAssetDisplayUrls } from "../src/site-io.js";

describe("exportZipBasename", () => {
  test("slugifies the org name", () => {
    expect(exportZipBasename("Asociația Demo")).toBe("asocia-ia-demo");
  });

  test("falls back to site when empty", () => {
    expect(exportZipBasename("   ")).toBe("site");
  });
});

describe("mergeAssetVfs", () => {
  test("copies assets/ entries into the target vfs", async () => {
    const source = new MemoryDriver();
    const target = new MemoryDriver();
    await source.write("assets/abc.png", new Uint8Array([1, 2, 3]));
    await mergeAssetVfs(source, target);
    expect(await target.read("assets/abc.png")).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe("populateAssetDisplayUrls", () => {
  test("mints blob URLs keyed by content hash", async () => {
    const vfs = new MemoryDriver();
    const cache = new Map<string, string>();
    await vfs.write("assets/deadbeef.png", new Uint8Array([137, 80, 78, 71]));
    await populateAssetDisplayUrls(vfs, cache);
    const url = cache.get("deadbeef");
    expect(url).toMatch(/^blob:/);
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  });

  test("mints display URLs for supported AVIF image assets", async () => {
    const vfs = new MemoryDriver();
    const cache = new Map<string, string>();
    await vfs.write("assets/photo.avif", new Uint8Array([0, 0, 0, 0]));
    await populateAssetDisplayUrls(vfs, cache);
    const url = cache.get("photo");
    expect(url).toMatch(/^blob:/);
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  });

  test("also mints URLs for downloadable documents", async () => {
    const vfs = new MemoryDriver();
    const cache = new Map<string, string>();
    await vfs.write("assets/report.pdf", new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    await populateAssetDisplayUrls(vfs, cache);
    const url = cache.get("report");
    expect(url).toMatch(/^blob:/);
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  });
});
