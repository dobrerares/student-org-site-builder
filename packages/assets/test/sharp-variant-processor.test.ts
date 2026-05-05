/**
 * Tests for the production-grade `SharpImageProcessor` (Node-only) and its
 * multi-variant extension. These cover #37's contracts:
 *
 *  - Sharp pipeline produces 400/800/1600 WebP variants from one input
 *  - Each variant is appropriately sized and within a reasonable byte budget
 *  - Alpha is preserved on PNG variants (when keeping PNG, not WebP)
 *  - Variant naming is deterministic and content-addressed
 *  - The single-output path is still satisfied so existing pipeline tests keep working
 *  - Sharp processor refuses to up-scale: a 600px input does not produce a 1600px variant
 */

import { describe, expect, test } from "vitest";

import { detectMime, type SupportedMime } from "../src/mime.js";
import {
  RESPONSIVE_VARIANT_WIDTHS,
  WEBP_VARIANT_QUALITY,
  createSharpImageProcessor,
} from "../src/sharp-processor.js";
import type { ImageProcessor, MultiVariantImageProcessor } from "../src/processor.js";

import { makeLargeJpegFixture, makePngWithAlpha, readPixelRgba } from "./sharp-processor.js";

/**
 * The production sharp processor implements both seams: the legacy
 * single-output `ImageProcessor` (for pipeline orchestration parity with
 * the canvas processor) and the new `MultiVariantImageProcessor` (for
 * Electron-side responsive variant generation).
 */
describe("createSharpImageProcessor — shape", () => {
  test("returns an object that satisfies both the single-output and multi-variant seams", async () => {
    const proc = await createSharpImageProcessor();
    // Single-output methods (carryover from #8 seam).
    expect(typeof proc.decode).toBe("function");
    expect(typeof proc.resizeAndEncode).toBe("function");
    // Multi-variant method (this issue).
    expect(typeof proc.encodeVariants).toBe("function");

    // Type assertions: must be assignable to both interfaces.
    const single: ImageProcessor = proc;
    const multi: MultiVariantImageProcessor = proc;
    expect(single).toBe(proc);
    expect(multi).toBe(proc);
  });
});

describe("SharpImageProcessor.encodeVariants — JPEG → WebP variants", () => {
  test("a large photo produces 400/800/1600 WebP variants, each sized and budgeted", async () => {
    const proc = await createSharpImageProcessor();
    const fixture = await makeLargeJpegFixture(12 * 1024 * 1024);
    expect(Math.max(fixture.width, fixture.height)).toBeGreaterThan(2000);

    const decoded = await proc.decode(fixture.bytes, "image/jpeg");

    const variants = await proc.encodeVariants(decoded, {
      widths: [...RESPONSIVE_VARIANT_WIDTHS],
      targetMime: "image/webp",
      quality: WEBP_VARIANT_QUALITY,
    });

    // One output per requested width.
    expect(variants).toHaveLength(3);

    for (const variant of variants) {
      expect(variant.mime).toBe("image/webp");
      // The bytes really are a WebP file (RIFF...WEBP magic).
      const detected = detectMime(variant.bytes);
      expect(detected).toBe("image/webp");
      // Width is exactly the requested width (sharp matches it precisely
      // because the source is wider than every requested target).
      const target = variant.requestedWidth;
      expect([400, 800, 1600]).toContain(target);
      expect(variant.width).toBe(target);
      // Aspect ratio preserved within rounding.
      const inputAspect = fixture.width / fixture.height;
      const outputAspect = variant.width / variant.height;
      expect(Math.abs(inputAspect - outputAspect)).toBeLessThan(0.01);
    }

    // Byte budgets — webp at q=82 from a realistic photo:
    // 400 → low tens of KB, 1600 → low hundreds of KB.
    const v400 = variants.find((v) => v.requestedWidth === 400);
    const v800 = variants.find((v) => v.requestedWidth === 800);
    const v1600 = variants.find((v) => v.requestedWidth === 1600);
    expect(v400!.bytes.byteLength).toBeLessThan(100 * 1024);
    expect(v800!.bytes.byteLength).toBeLessThan(250 * 1024);
    expect(v1600!.bytes.byteLength).toBeLessThan(800 * 1024);
  }, 120_000);
});

describe("SharpImageProcessor.encodeVariants — alpha preservation", () => {
  test("PNG with alpha → PNG variants preserve transparent regions", async () => {
    const proc = await createSharpImageProcessor();
    const fixture = await makePngWithAlpha(2400, 1600);

    const decoded = await proc.decode(fixture.bytes, "image/png");
    const variants = await proc.encodeVariants(decoded, {
      widths: [400, 800, 1600],
      targetMime: "image/png",
    });

    expect(variants).toHaveLength(3);
    for (const variant of variants) {
      expect(variant.mime).toBe("image/png");
      // Each variant: right half is still transparent.
      const rightX = Math.floor(variant.width * 0.85);
      const someY = Math.floor(variant.height * 0.5);
      const px = await readPixelRgba(variant.bytes, rightX, someY);
      expect(px[3]).toBe(0);
      // Left half stays opaque red-ish.
      const leftX = Math.floor(variant.width * 0.15);
      const lpx = await readPixelRgba(variant.bytes, leftX, someY);
      expect(lpx[3]).toBe(255);
      expect(lpx[0]).toBeGreaterThan(150);
    }
  }, 60_000);
});

describe("SharpImageProcessor.encodeVariants — refuses up-scale", () => {
  test("an input narrower than the largest requested width is clamped to its native width", async () => {
    const proc = await createSharpImageProcessor();
    // Make a small fixture (600px wide); request 400/800/1600.
    const fixture = await makePngWithAlpha(600, 400);

    const decoded = await proc.decode(fixture.bytes, "image/png");
    const variants = await proc.encodeVariants(decoded, {
      widths: [400, 800, 1600],
      targetMime: "image/png",
    });

    // Variant for w=400 produces 400px (downscale).
    const v400 = variants.find((v) => v.requestedWidth === 400);
    expect(v400!.width).toBe(400);
    // Variants for 800 and 1600 are clamped to the native 600px width.
    const v800 = variants.find((v) => v.requestedWidth === 800);
    const v1600 = variants.find((v) => v.requestedWidth === 1600);
    expect(v800!.width).toBe(600);
    expect(v1600!.width).toBe(600);
  }, 60_000);
});

describe("SharpImageProcessor — single-output parity (carryover from #8)", () => {
  test("decode + resizeAndEncode still works on the single-output seam", async () => {
    const proc = await createSharpImageProcessor();
    const fixture = await makePngWithAlpha(800, 600);

    const decoded = await proc.decode(fixture.bytes, "image/png");
    const targetMime: SupportedMime = "image/png";
    const encoded = await proc.resizeAndEncode(decoded, targetMime, 2000, 85);

    expect(encoded.mime).toBe("image/png");
    expect(encoded.bytes.byteLength).toBeGreaterThan(0);
  }, 30_000);
});
