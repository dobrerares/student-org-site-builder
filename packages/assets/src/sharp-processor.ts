/**
 * Production-grade `MultiVariantImageProcessor` backed by sharp.
 *
 * **Node-only.** Sharp ships native binaries via prebuilds; it cannot
 * load in a browser, in Electron renderer (sandbox: true), or in any
 * sandboxed context. This file lives in `@sosb/assets` as a separate
 * entry from `./canvas-processor.ts`; the build never bundles both.
 *
 * Selection of the right processor at call sites happens through
 * `getDefaultProcessor()` in `./index.ts` (or by importing the specific
 * factory directly).
 *
 * Why a real implementation here, not a test helper?
 *
 * `@sosb/assets` is a deep module: orchestration is environment-agnostic
 * but the encoder is environment-specific. The browser default is
 * `CanvasImageProcessor` (browser-only). The Electron default is the
 * processor exported from this file (Node-only). Both share the same
 * `ImageProcessor` seam from #8; this file extends it with
 * `encodeVariants` for #37's responsive-variant work.
 *
 * The `test/sharp-processor.ts` test helper still exists alongside —
 * its purpose is fixture synthesis (large JPEGs with realistic entropy,
 * PNGs with a known alpha mask). The processor itself is now production
 * code, not test-only.
 */

import type { SupportedMime } from "./mime.js";
import {
  type ImageDecode,
  type ImageEncoded,
  type ImageVariant,
  type MultiVariantImageProcessor,
  type VariantEncodeOptions,
} from "./processor.js";

// Re-export the variant-related constants here so consumers can grab
// "everything sharp/variant-related" from one import path.
export {
  RESPONSIVE_VARIANT_WIDTHS,
  WEBP_VARIANT_QUALITY,
  type ImageVariant,
  type MultiVariantImageProcessor,
  type VariantEncodeOptions,
} from "./processor.js";

/**
 * Build the production sharp-backed processor. Async because we resolve
 * sharp via dynamic `import()` — keeps the call graph clean for static
 * analysis (no top-level sharp import means a future browser-side build
 * that accidentally pulls this file in fails fast at the import call,
 * not silently at run time inside a renderer where the failure mode is
 * worse).
 */
export async function createSharpImageProcessor(): Promise<MultiVariantImageProcessor> {
  const sharpModule = await import("sharp");
  const sharp = sharpModule.default;

  const decode: MultiVariantImageProcessor["decode"] = async (
    bytes: Uint8Array,
  ): Promise<ImageDecode> => {
    const image = sharp(Buffer.from(bytes));
    const metadata = await image.metadata();
    return {
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
      original: bytes,
    };
  };

  const resizeAndEncode: MultiVariantImageProcessor["resizeAndEncode"] = async (
    decoded: ImageDecode,
    targetMime: SupportedMime,
    maxLongEdge: number,
    jpegQuality: number,
  ): Promise<ImageEncoded> => {
    const longEdge = Math.max(decoded.width, decoded.height);
    const scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1;
    const targetWidth = Math.max(1, Math.round(decoded.width * scale));
    const targetHeight = Math.max(1, Math.round(decoded.height * scale));

    let pipeline = sharp(Buffer.from(decoded.original));
    if (scale < 1) {
      pipeline = pipeline.resize(targetWidth, targetHeight, { fit: "fill" });
    }

    const outBuffer = await encodeWithSharp(pipeline, targetMime, jpegQuality);
    const finalMeta = await sharp(outBuffer).metadata();
    return {
      bytes: new Uint8Array(outBuffer),
      mime: targetMime,
      width: finalMeta.width ?? targetWidth,
      height: finalMeta.height ?? targetHeight,
    };
  };

  const encodeVariants: MultiVariantImageProcessor["encodeVariants"] = async (
    decoded: ImageDecode,
    options: VariantEncodeOptions,
  ): Promise<readonly ImageVariant[]> => {
    const widths = [...new Set(options.widths)].sort((a, b) => a - b);
    const quality = options.quality ?? 82;
    const targetMime = options.targetMime;

    const out: ImageVariant[] = [];
    for (const requestedWidth of widths) {
      // Sharp refuses to up-scale by default when we pass `withoutEnlargement: true`,
      // but our public contract is "actual width is min(requested, source)" —
      // be explicit here to keep the contract ours and not sharp's.
      const cappedWidth = Math.min(requestedWidth, decoded.width || requestedWidth);
      const aspect = decoded.height / Math.max(1, decoded.width);
      const targetHeight = Math.max(1, Math.round(cappedWidth * aspect));

      let pipeline = sharp(Buffer.from(decoded.original));
      // Always resize: even the cap-equal case re-encodes to the target
      // mime so all variants are uniform.
      pipeline = pipeline.resize(cappedWidth, targetHeight, {
        fit: "fill",
        withoutEnlargement: true,
      });

      const buffer = await encodeWithSharp(pipeline, targetMime, quality);
      const meta = await sharp(buffer).metadata();
      out.push({
        requestedWidth,
        width: meta.width ?? cappedWidth,
        height: meta.height ?? targetHeight,
        mime: targetMime,
        bytes: new Uint8Array(buffer),
      });
    }
    return out;
  };

  return { decode, resizeAndEncode, encodeVariants };
}

async function encodeWithSharp(
  pipeline: import("sharp").Sharp,
  targetMime: SupportedMime,
  quality: number,
): Promise<Buffer> {
  switch (targetMime) {
    case "image/jpeg":
      return pipeline.jpeg({ quality, mozjpeg: false, chromaSubsampling: "4:2:0" }).toBuffer();
    case "image/png":
      return pipeline.png({ compressionLevel: 9 }).toBuffer();
    case "image/webp":
      return pipeline.webp({ quality, lossless: false }).toBuffer();
    case "image/svg+xml":
      // Unreachable: SVG never goes through the sharp processor.
      throw new Error("SharpImageProcessor: SVG output is not supported (use passthrough)");
  }
}
