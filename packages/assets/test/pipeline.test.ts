/**
 * Pipeline tests — exercise the full upload/delete/dedup orchestration
 * against a real `MemoryDriver` VFS and a real `SharpImageProcessor`
 * (Node-side equivalent of the browser canvas processor).
 *
 * The acceptance criteria for issue #8 map directly to these tests:
 *
 * - 12MB JPEG → resized output under 500KB
 * - dedup: same bytes → single VFS entry
 * - metadata sidecar fields all present
 * - SVG passthrough byte-equality
 * - PNG alpha preservation
 * - delete removes both asset and sidecar
 *
 * Plus the alt enforcement at the upload entrypoint.
 */

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { MemoryDriver } from "@sosb/vfs";

import { AssetError } from "../src/errors.js";
import { uploadAsset, deleteAsset, readAssetMetadata } from "../src/pipeline.js";
import type { AssetMetadata, AssetRef } from "../src/types.js";

import {
  createSharpProcessor,
  makeLargeJpegFixture,
  makePngWithAlpha,
  readPixelRgba,
} from "./sharp-processor.js";

const SVG_SOURCE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect x="10" y="10" width="80" height="80" fill="#1a73e8"/>
</svg>
`;

let processor: Awaited<ReturnType<typeof createSharpProcessor>>;

beforeAll(async () => {
  processor = await createSharpProcessor();
});

afterAll(() => {
  // No teardown needed — sharp manages its own pool.
});

describe("uploadAsset — alt enforcement", () => {
  test("rejects an upload with empty alt text", async () => {
    const vfs = new MemoryDriver();
    const bytes = new TextEncoder().encode(SVG_SOURCE);
    await expect(
      uploadAsset({ kind: "bytes", bytes, name: "logo.svg", alt: "" }, vfs, { processor }),
    ).rejects.toMatchObject({ name: "AssetError", code: "asset.alt.missing" });
  });

  test("rejects an upload with whitespace-only alt", async () => {
    const vfs = new MemoryDriver();
    const bytes = new TextEncoder().encode(SVG_SOURCE);
    await expect(
      uploadAsset({ kind: "bytes", bytes, name: "logo.svg", alt: "   " }, vfs, { processor }),
    ).rejects.toBeInstanceOf(AssetError);
  });

  test("accepts an upload with non-empty alt and stores it on the AssetRef and sidecar", async () => {
    const vfs = new MemoryDriver();
    const bytes = new TextEncoder().encode(SVG_SOURCE);
    const ref = await uploadAsset(
      { kind: "bytes", bytes, name: "logo.svg", alt: "Org logo" },
      vfs,
      { processor },
    );
    expect(ref.alt).toBe("Org logo");
    const metadata = await readAssetMetadata(vfs, ref);
    expect(metadata.alt).toBe("Org logo");
  });
});

describe("uploadAsset — SVG passthrough", () => {
  test("stores SVG bytes byte-identical to input", async () => {
    const vfs = new MemoryDriver();
    const bytes = new TextEncoder().encode(SVG_SOURCE);
    const ref = await uploadAsset(
      { kind: "bytes", bytes, name: "logo.svg", alt: "Org logo" },
      vfs,
      { processor },
    );
    const stored = await vfs.read(ref.path);
    expect(Array.from(stored)).toEqual(Array.from(bytes));
    expect(ref.path.endsWith(".svg")).toBe(true);
    expect(ref.mime).toBe("image/svg+xml");
  });

  test("SVG metadata records mime as image/svg+xml and originalName from input", async () => {
    const vfs = new MemoryDriver();
    const bytes = new TextEncoder().encode(SVG_SOURCE);
    const ref = await uploadAsset(
      { kind: "bytes", bytes, name: "team-logo.svg", alt: "Team logo" },
      vfs,
      { processor },
    );
    const metadata = await readAssetMetadata(vfs, ref);
    expect(metadata.mimeType).toBe("image/svg+xml");
    expect(metadata.originalName).toBe("team-logo.svg");
  });
});

describe("uploadAsset — content-addressed dedup", () => {
  test("uploading the same bytes twice produces a single VFS entry per file (asset + sidecar)", async () => {
    const vfs = new MemoryDriver();
    const bytes = new TextEncoder().encode(SVG_SOURCE);

    const first = await uploadAsset(
      { kind: "bytes", bytes, name: "logo.svg", alt: "Org logo" },
      vfs,
      { processor },
    );
    const second = await uploadAsset(
      { kind: "bytes", bytes, name: "ignored.svg", alt: "Same logo, different alt" },
      vfs,
      { processor },
    );

    // Same hash → same path → same metadata path.
    expect(second.hash).toBe(first.hash);
    expect(second.path).toBe(first.path);
    expect(second.metadataPath).toBe(first.metadataPath);

    // VFS contains exactly two entries: the asset and the sidecar.
    const paths = await vfs.list("assets/");
    expect(paths.length).toBe(2);
    expect(paths).toContain(first.path);
    expect(paths).toContain(first.metadataPath);
  });

  test("uploading different bytes produces two separate entries", async () => {
    const vfs = new MemoryDriver();
    const a = new TextEncoder().encode("<svg>a</svg>");
    const b = new TextEncoder().encode("<svg>b</svg>");

    const refA = await uploadAsset({ kind: "bytes", bytes: a, name: "a.svg", alt: "a" }, vfs, {
      processor,
    });
    const refB = await uploadAsset({ kind: "bytes", bytes: b, name: "b.svg", alt: "b" }, vfs, {
      processor,
    });

    expect(refA.hash).not.toBe(refB.hash);
    const paths = await vfs.list("assets/");
    // Two assets + two sidecars.
    expect(paths.length).toBe(4);
  });
});

describe("uploadAsset — JPEG resize budget (12MB → <500KB)", () => {
  test("a 12MB photo-grade JPEG is resized to long-edge ≤ 2000px and re-encoded under 500KB", async () => {
    const vfs = new MemoryDriver();
    const fixture = await makeLargeJpegFixture(12 * 1024 * 1024);
    // Sanity: the fixture really is large.
    expect(fixture.bytes.byteLength).toBeGreaterThan(8 * 1024 * 1024);
    // Sanity: long edge is well past 2000.
    expect(Math.max(fixture.width, fixture.height)).toBeGreaterThan(2000);

    const ref = await uploadAsset(
      { kind: "bytes", bytes: fixture.bytes, name: "photo.jpg", alt: "Team photo" },
      vfs,
      { processor },
    );

    const stored = await vfs.read(ref.path);
    // AC: under 500KB.
    expect(stored.byteLength).toBeLessThan(500 * 1024);
    // AC: long edge ≤ 2000px.
    expect(Math.max(ref.width, ref.height)).toBeLessThanOrEqual(2000);
    // Output mime is JPEG (non-alpha source).
    expect(ref.mime).toBe("image/jpeg");
  }, 120_000); // sharp synthesis + encode is slow on first call; give it 2 minutes.
});

describe("uploadAsset — PNG alpha preservation", () => {
  test("alpha channel survives the resize+re-encode (transparent regions stay transparent)", async () => {
    const vfs = new MemoryDriver();
    const fixture = await makePngWithAlpha(2400, 1600);
    // Sanity: fixture has alpha.
    const inputTransparent = await readPixelRgba(fixture.bytes, fixture.width - 10, 10);
    expect(inputTransparent[3]).toBe(0);

    const ref = await uploadAsset(
      { kind: "bytes", bytes: fixture.bytes, name: "logo.png", alt: "Logo" },
      vfs,
      { processor },
    );

    expect(ref.mime).toBe("image/png");
    // Long edge resized to ≤ 2000px.
    expect(Math.max(ref.width, ref.height)).toBeLessThanOrEqual(2000);
    expect(Math.max(ref.width, ref.height)).toBeGreaterThanOrEqual(1500);

    const stored = await vfs.read(ref.path);
    // The right half of the image is transparent. After resize, that
    // region is somewhere on the right side of the output too; pick a
    // point clearly within the right half.
    const rightX = Math.floor(ref.width * 0.85);
    const someY = Math.floor(ref.height * 0.5);
    const out = await readPixelRgba(stored, rightX, someY);
    expect(out[3]).toBe(0);

    // Left half stays opaque red-ish.
    const leftX = Math.floor(ref.width * 0.2);
    const leftPixel = await readPixelRgba(stored, leftX, someY);
    expect(leftPixel[3]).toBe(255);
    expect(leftPixel[0]).toBeGreaterThan(150); // R is dominant.
  }, 60_000);
});

describe("uploadAsset — metadata sidecar", () => {
  test("sidecar contains originalName, mimeType, dimensions, and alt", async () => {
    const vfs = new MemoryDriver();
    const fixture = await makePngWithAlpha(800, 600);
    const ref = await uploadAsset(
      { kind: "bytes", bytes: fixture.bytes, name: "team-photo.png", alt: "The 2026 board" },
      vfs,
      { processor },
    );

    const sidecarBytes = await vfs.read(ref.metadataPath);
    const sidecar: AssetMetadata = JSON.parse(new TextDecoder().decode(sidecarBytes));
    expect(sidecar.originalName).toBe("team-photo.png");
    expect(sidecar.mimeType).toBe("image/png");
    expect(sidecar.dimensions.w).toBe(ref.width);
    expect(sidecar.dimensions.h).toBe(ref.height);
    expect(sidecar.alt).toBe("The 2026 board");
  }, 60_000);

  test("sidecar path follows the <hash>.metadata.json convention", async () => {
    const vfs = new MemoryDriver();
    const bytes = new TextEncoder().encode(SVG_SOURCE);
    const ref = await uploadAsset({ kind: "bytes", bytes, name: "logo.svg", alt: "Logo" }, vfs, {
      processor,
    });
    expect(ref.metadataPath).toBe(`assets/${ref.hash}.metadata.json`);
  });
});

describe("deleteAsset", () => {
  test("removes both the asset and its sidecar", async () => {
    const vfs = new MemoryDriver();
    const bytes = new TextEncoder().encode(SVG_SOURCE);
    const ref = await uploadAsset({ kind: "bytes", bytes, name: "logo.svg", alt: "Logo" }, vfs, {
      processor,
    });

    expect(await vfs.has(ref.path)).toBe(true);
    expect(await vfs.has(ref.metadataPath)).toBe(true);

    await deleteAsset(vfs, ref);

    expect(await vfs.has(ref.path)).toBe(false);
    expect(await vfs.has(ref.metadataPath)).toBe(false);
    expect(await vfs.list("assets/")).toEqual([]);
  });

  test("delete throws AssetError(notFound) for an unknown ref", async () => {
    const vfs = new MemoryDriver();
    const fakeRef: AssetRef = {
      hash: "deadbeefdeadbeef",
      path: "assets/deadbeefdeadbeef.png",
      metadataPath: "assets/deadbeefdeadbeef.metadata.json",
      mime: "image/png",
      width: 1,
      height: 1,
      alt: "x",
    };
    await expect(deleteAsset(vfs, fakeRef)).rejects.toMatchObject({
      name: "AssetError",
      code: "asset.notFound",
    });
  });
});

describe("uploadAsset — unsupported types", () => {
  test("rejects an unsupported binary type (e.g. PDF magic) with asset.mime.unsupported", async () => {
    const vfs = new MemoryDriver();
    const pdfMagic = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"
    await expect(
      uploadAsset({ kind: "bytes", bytes: pdfMagic, name: "doc.pdf", alt: "doc" }, vfs, {
        processor,
      }),
    ).rejects.toMatchObject({ name: "AssetError", code: "asset.mime.unsupported" });
  });
});
