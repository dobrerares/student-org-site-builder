/**
 * Browser-default `ImageProcessor` using `OffscreenCanvas` +
 * `createImageBitmap` + `OffscreenCanvas.convertToBlob`.
 *
 * This module is the only file in `@sosb/assets` that depends on
 * browser-only globals. Anything calling it must run inside a real
 * browser (Chromium / Firefox / Safari) or in a Playwright headless
 * Chromium. Importing this module under Node without the canvas
 * globals is supported as long as you never call its export — the
 * module-load step is side-effect free.
 *
 * Encoding choices:
 *
 *  - JPEG: `OffscreenCanvas.convertToBlob({ type: 'image/jpeg', quality })`
 *    where `quality` is in [0, 1] (we pass 0.85 for the PRD-pinned q=85).
 *  - PNG: `convertToBlob({ type: 'image/png' })`. PNG is lossless;
 *    `quality` is ignored. Alpha channel is preserved.
 *
 * `OffscreenCanvas.convertToBlob` is available in Chromium and
 * Firefox; Safari requires 16.4+. In environments without
 * `OffscreenCanvas` (very old browsers), the caller is expected to
 * shim with a hidden `<canvas>` element — out of scope for v1.
 */

import type { SupportedMime } from "./mime.js";
import type { ImageDecode, ImageEncoded, ImageProcessor } from "./processor.js";

/**
 * The default browser-side processor. Created once and reused.
 */
export const CanvasImageProcessor: ImageProcessor = {
  async decode(bytes: Uint8Array, declaredMime: SupportedMime): Promise<ImageDecode> {
    if (declaredMime === "image/svg+xml") {
      // SVGs never reach the processor — the pipeline's passthrough
      // branch handles them. This guard exists so a buggy caller fails
      // loudly rather than silently rasterising vectors.
      throw new Error("CanvasImageProcessor: SVG inputs must use the passthrough branch.");
    }
    // Copy into a fresh ArrayBuffer because some browsers detach the
    // input buffer when constructing a Blob/ImageBitmap.
    const blob = new Blob([bytes.slice()], { type: declaredMime });
    const bitmap = await createImageBitmap(blob);
    const out: ImageDecode = {
      width: bitmap.width,
      height: bitmap.height,
      original: bytes,
    };
    // The bitmap is consumed by `resizeAndEncode` via `original`; close
    // this handle to free GPU resources.
    bitmap.close();
    return out;
  },

  async resizeAndEncode(
    decoded: ImageDecode,
    targetMime: SupportedMime,
    maxLongEdge: number,
    jpegQuality: number,
  ): Promise<ImageEncoded> {
    const longEdge = Math.max(decoded.width, decoded.height);
    const scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1;
    const targetWidth = Math.max(1, Math.round(decoded.width * scale));
    const targetHeight = Math.max(1, Math.round(decoded.height * scale));

    // Re-decode from the original bytes so we can drive the bitmap
    // straight onto a target-sized canvas with the browser's built-in
    // resampling.
    const blob = new Blob([decoded.original.slice()]);
    const bitmap = await createImageBitmap(blob, {
      resizeWidth: targetWidth,
      resizeHeight: targetHeight,
      resizeQuality: "high",
    });

    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext("2d", { alpha: targetMime !== "image/jpeg" });
    if (!ctx) {
      bitmap.close();
      throw new Error("CanvasImageProcessor: failed to get 2D context");
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const encodeOptions: { type: SupportedMime; quality?: number } = { type: targetMime };
    if (targetMime === "image/jpeg" || targetMime === "image/webp") {
      encodeOptions.quality = jpegQuality / 100;
    }
    const outBlob = await canvas.convertToBlob(encodeOptions);
    const buffer = await outBlob.arrayBuffer();

    return {
      bytes: new Uint8Array(buffer),
      mime: targetMime,
      width: targetWidth,
      height: targetHeight,
    };
  },
};
