/**
 * End-to-end pipeline tests for `uploadAssetWithVariants` (issue #37).
 *
 * Where `uploadAsset` (#8) writes one canonical resized output per upload,
 * `uploadAssetWithVariants` writes the canonical output PLUS one extra
 * file per responsive variant width. The metadata sidecar grows a
 * `variants` array; the returned `AssetRef` exposes the same array so
 * blocks can render an `<img srcset>` directly.
 *
 * AC mapping:
 *
 *  - Image upload in Electron produces 400/800/1600 variants in WebP.
 *  - Asset metadata records all variants.
 *  - Built site `<img srcset>` references variants correctly with sizes.
 *  - SVG passthrough remains unchanged (no variants for vector assets).
 *  - Browser pipeline (uploadAsset, single-output) is untouched and still
 *    works against the same VFS.
 */

import { describe, expect, test } from "vitest";

import { MemoryDriver } from "@sosb/vfs";

import {
  RESPONSIVE_VARIANT_WIDTHS,
  WEBP_VARIANT_QUALITY,
  buildSrcset,
  createSharpImageProcessor,
  readAssetMetadata,
  uploadAsset,
  uploadAssetWithVariants,
} from "../src/index.js";
import type { AssetMetadata, AssetVariantDescriptor } from "../src/types.js";

import { makeLargeJpegFixture, makePngWithAlpha } from "./sharp-processor.js";

const SVG_SOURCE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect x="10" y="10" width="80" height="80" fill="#1a73e8"/>
</svg>
`;

describe("uploadAssetWithVariants — JPEG photo", () => {
  test("produces 400/800/1600 WebP variants on disk plus the canonical output", async () => {
    const vfs = new MemoryDriver();
    const processor = await createSharpImageProcessor();
    const fixture = await makeLargeJpegFixture(12 * 1024 * 1024);

    const ref = await uploadAssetWithVariants(
      { kind: "bytes", bytes: fixture.bytes, name: "photo.jpg", alt: "Team photo" },
      vfs,
      { processor, variantWidths: [...RESPONSIVE_VARIANT_WIDTHS], variantQuality: WEBP_VARIANT_QUALITY },
    );

    // The ref carries the variants list.
    expect(ref.variants).toBeDefined();
    expect(ref.variants).toHaveLength(3);
    const widths = ref.variants!.map((v) => v.width).sort((a, b) => a - b);
    expect(widths).toEqual([400, 800, 1600]);
    for (const v of ref.variants!) {
      expect(v.mime).toBe("image/webp");
      expect(v.path.endsWith(".webp")).toBe(true);
      expect(await vfs.has(v.path)).toBe(true);
    }

    // Canonical JPEG output also written.
    expect(ref.mime).toBe("image/jpeg");
    expect(await vfs.has(ref.path)).toBe(true);

    // Metadata sidecar records the variant list verbatim.
    const meta = await readAssetMetadata(vfs, ref);
    expect(meta.variants).toBeDefined();
    expect(meta.variants).toHaveLength(3);
    expect(meta.variants).toEqual(ref.variants);

    // Variant paths are content-addressed and deterministic: each variant
    // path embeds the canonical hash AND the variant width.
    for (const v of ref.variants!) {
      expect(v.path).toContain(ref.hash);
      expect(v.path).toContain(`${v.width}`);
    }
  }, 120_000);
});

describe("uploadAssetWithVariants — deterministic naming", () => {
  test("uploading the same bytes twice yields the same paths for canonical AND every variant", async () => {
    const vfs = new MemoryDriver();
    const processor = await createSharpImageProcessor();
    const fixture = await makePngWithAlpha(1200, 800);

    const a = await uploadAssetWithVariants(
      { kind: "bytes", bytes: fixture.bytes, name: "logo.png", alt: "Logo" },
      vfs,
      { processor, variantWidths: [400, 800], targetVariantMime: "image/png" },
    );
    const b = await uploadAssetWithVariants(
      { kind: "bytes", bytes: fixture.bytes, name: "logo-other-name.png", alt: "Different alt" },
      vfs,
      { processor, variantWidths: [400, 800], targetVariantMime: "image/png" },
    );

    expect(b.hash).toBe(a.hash);
    expect(b.path).toBe(a.path);
    expect(b.metadataPath).toBe(a.metadataPath);
    expect(b.variants).toHaveLength(2);
    expect(a.variants).toHaveLength(2);
    expect(b.variants!.map((v) => v.path).sort()).toEqual(a.variants!.map((v) => v.path).sort());

    // VFS contains: canonical asset + sidecar + 2 variant files = 4 entries.
    const list = await vfs.list("assets/");
    expect(list.length).toBe(4);
  }, 60_000);
});

describe("uploadAssetWithVariants — SVG passthrough unchanged", () => {
  test("SVG is stored verbatim with no variants generated", async () => {
    const vfs = new MemoryDriver();
    const processor = await createSharpImageProcessor();
    const bytes = new TextEncoder().encode(SVG_SOURCE);

    const ref = await uploadAssetWithVariants(
      { kind: "bytes", bytes, name: "logo.svg", alt: "Logo" },
      vfs,
      { processor, variantWidths: [400, 800, 1600] },
    );

    expect(ref.mime).toBe("image/svg+xml");
    // No variants for SVG — they're already infinitely scalable.
    expect(ref.variants).toBeUndefined();
    const meta = await readAssetMetadata(vfs, ref);
    expect(meta.variants).toBeUndefined();
    // Byte-equality: the stored asset is the SVG input verbatim.
    const stored = await vfs.read(ref.path);
    expect(Array.from(stored)).toEqual(Array.from(bytes));
  });
});

describe("buildSrcset", () => {
  test("formats a srcset string of `<path> <width>w` pairs from a variant list", () => {
    const variants: readonly AssetVariantDescriptor[] = [
      { width: 400, height: 300, mime: "image/webp", path: "assets/abc.400.webp", bytes: 0 },
      { width: 800, height: 600, mime: "image/webp", path: "assets/abc.800.webp", bytes: 0 },
      { width: 1600, height: 1200, mime: "image/webp", path: "assets/abc.1600.webp", bytes: 0 },
    ];
    const srcset = buildSrcset(variants);
    // Pairs are sorted ascending by width and separated by `, ` with width
    // suffix `w`.
    expect(srcset).toBe(
      "assets/abc.400.webp 400w, assets/abc.800.webp 800w, assets/abc.1600.webp 1600w",
    );
  });

  test("preserves order even when input is shuffled", () => {
    const variants: readonly AssetVariantDescriptor[] = [
      { width: 1600, height: 1200, mime: "image/webp", path: "assets/x.1600.webp", bytes: 0 },
      { width: 400, height: 300, mime: "image/webp", path: "assets/x.400.webp", bytes: 0 },
      { width: 800, height: 600, mime: "image/webp", path: "assets/x.800.webp", bytes: 0 },
    ];
    const srcset = buildSrcset(variants);
    expect(srcset.startsWith("assets/x.400.webp 400w")).toBe(true);
    expect(srcset.endsWith("assets/x.1600.webp 1600w")).toBe(true);
  });

  test("returns an empty string when given no variants", () => {
    expect(buildSrcset([])).toBe("");
  });
});

describe("uploadAsset (single-output, browser-equivalent) coexists", () => {
  test("the legacy single-output upload still works against the same VFS — browser pipeline (#8) untouched", async () => {
    const vfs = new MemoryDriver();
    const processor = await createSharpImageProcessor();
    const bytes = new TextEncoder().encode(SVG_SOURCE);

    // The single-output upload is unchanged from #8.
    const ref = await uploadAsset(
      { kind: "bytes", bytes, name: "logo.svg", alt: "Logo" },
      vfs,
      { processor },
    );

    expect(ref.alt).toBe("Logo");
    expect(ref.mime).toBe("image/svg+xml");
    const meta = await readAssetMetadata(vfs, ref);
    // No `variants` field on a single-output upload.
    expect(meta.variants).toBeUndefined();
  });
});

describe("AssetMetadata.variants schema shape", () => {
  test("each variant entry on the sidecar has width, height, mime, path", async () => {
    const vfs = new MemoryDriver();
    const processor = await createSharpImageProcessor();
    const fixture = await makePngWithAlpha(1200, 800);

    const ref = await uploadAssetWithVariants(
      { kind: "bytes", bytes: fixture.bytes, name: "logo.png", alt: "Logo" },
      vfs,
      { processor, variantWidths: [400, 800], targetVariantMime: "image/png" },
    );
    const sidecarBytes = await vfs.read(ref.metadataPath);
    const sidecar: AssetMetadata = JSON.parse(new TextDecoder().decode(sidecarBytes));
    expect(sidecar.variants).toBeDefined();
    for (const v of sidecar.variants!) {
      expect(typeof v.width).toBe("number");
      expect(typeof v.height).toBe("number");
      expect(typeof v.path).toBe("string");
      expect(["image/png", "image/webp", "image/jpeg"]).toContain(v.mime);
    }
  }, 60_000);
});
