/**
 * The narrow seam between the asset pipeline orchestration and the
 * actual image-decoding/encoding implementation.
 *
 * The default browser implementation (`CanvasImageProcessor` in
 * `./canvas-processor.ts`) uses `OffscreenCanvas` + `createImageBitmap`
 * + `canvas.convertToBlob`. Tests inject a sharp-backed processor that
 * implements the same interface; both produce the same observable
 * properties (alpha preserved, output mime correct, output size within
 * budget) without sharing implementation.
 *
 * The seam is intentionally minimal: two methods, three parameter types
 * — the rest of the pipeline (mime detection, hashing, dedup, sidecar,
 * deletion, alt enforcement) is environment-agnostic and lives in
 * `./pipeline.ts`.
 *
 * The Electron-side `sharp`-based pipeline that ships responsive
 * variants (issue #37) will plug a different processor in here too;
 * its multi-output method shape is out of scope for v1 and lives in a
 * future extension of this interface.
 */

import type { SupportedMime } from "./mime.js";

/**
 * The product of a successful decode. `original` is preserved so the
 * processor can re-pipe the bytes through resize+encode without a
 * round-trip back to a serialisable format. Concrete processors may
 * carry their own internal handle alongside; callers don't depend on
 * extra fields.
 */
export interface ImageDecode {
  width: number;
  height: number;
  /**
   * The original input bytes, retained verbatim. The pipeline does NOT
   * re-encode SVG (it's passed through as-is) so for raster types this
   * is what the resize-and-encode step starts from.
   */
  original: Uint8Array;
}

/**
 * The product of a successful resize+encode. `width` and `height` are
 * the actual output dimensions (after rounding); `mime` is the chosen
 * output content type, which may differ from the input (e.g. WebP-with-
 * alpha may be re-encoded to PNG).
 */
export interface ImageEncoded {
  bytes: Uint8Array;
  mime: SupportedMime;
  width: number;
  height: number;
}

export interface ImageProcessor {
  /**
   * Decode the input bytes into an in-memory image handle the processor
   * can resize and re-encode. Throws on undecodable input.
   */
  decode(bytes: Uint8Array, declaredMime: SupportedMime): Promise<ImageDecode>;

  /**
   * Resize so the long edge is at most `maxLongEdge` pixels and re-encode
   * to `targetMime`. JPEG output uses `jpegQuality` (0-100); other formats
   * pick a reasonable default in v1 (PNG max compression, WebP at the same
   * quality factor as JPEG).
   *
   * If the input already fits within `maxLongEdge`, the processor MAY
   * skip the resize step but MUST still re-encode to `targetMime` so the
   * output content type is uniform across the pipeline.
   */
  resizeAndEncode(
    decoded: ImageDecode,
    targetMime: SupportedMime,
    maxLongEdge: number,
    jpegQuality: number,
  ): Promise<ImageEncoded>;
}

/**
 * Pick the right output mime for a given input mime.
 *
 * - JPEG → JPEG (q=85)
 * - PNG → PNG (alpha preserved)
 * - WebP → PNG (we transcode to PNG to preserve alpha without WebP's
 *           encoder ambiguity in v1; the Electron pipeline #37 covers
 *           the AVIF/WebP variants)
 * - SVG → SVG (passthrough; never reaches this function)
 *
 * The PRD's "PNG/WebP for alpha" list is treated as "either is fine,
 * pick one". v1 picks PNG for portability and because canvas
 * `toBlob('image/webp', ...)` is not supported in Safari at the time of
 * writing (v1 floor: Chrome 100+, Firefox 100+, Safari 15.4+).
 */
export function chooseOutputMime(inputMime: SupportedMime): SupportedMime {
  switch (inputMime) {
    case "image/jpeg":
      return "image/jpeg";
    case "image/png":
      return "image/png";
    case "image/webp":
      return "image/png";
    case "image/svg+xml":
      return "image/svg+xml";
  }
}

/**
 * The browser pipeline's resize budget. The PRD pins the long-edge cap
 * at 2000px; this constant is the single source of truth.
 */
export const MAX_LONG_EDGE_PX = 2000;

/**
 * The browser pipeline's JPEG quality factor. The PRD pins q=85.
 */
export const JPEG_QUALITY = 85;

// ---------------------------------------------------------------------------
// Multi-variant seam (#37, Electron-side)
// ---------------------------------------------------------------------------

/**
 * One responsive-variant request. A processor returns one
 * {@link ImageVariant} per width entry in {@link VariantEncodeOptions.widths}.
 */
export interface VariantEncodeOptions {
  /** Target pixel widths, in any order (the processor sorts/clamps as needed). */
  readonly widths: readonly number[];
  /** Output content type for every variant. */
  readonly targetMime: SupportedMime;
  /**
   * Quality factor (0-100) used by lossy encoders (WebP, AVIF, JPEG). PNG
   * encoders ignore it.
   */
  readonly quality?: number;
}

/**
 * One emitted variant. Carries both the requested width (the entry from
 * {@link VariantEncodeOptions.widths} that produced it) and the actual
 * output dimensions (which may be smaller if the source was narrower
 * than the requested width — the processor refuses to up-scale).
 */
export interface ImageVariant {
  /** The width entry from the request that produced this variant. */
  readonly requestedWidth: number;
  /** Actual output pixel width (≤ requestedWidth; equal when source ≥ requestedWidth). */
  readonly width: number;
  /** Actual output pixel height. Aspect ratio preserved. */
  readonly height: number;
  readonly mime: SupportedMime;
  readonly bytes: Uint8Array;
}

/**
 * The extended seam for Electron-side pipelines: encode many variants
 * from a single decoded source. A `MultiVariantImageProcessor` is also
 * an `ImageProcessor` (the legacy single-output methods stay valid) so
 * call sites can branch on capability with `instanceof`-free duck typing.
 */
export interface MultiVariantImageProcessor extends ImageProcessor {
  /**
   * Produce one encoded variant per entry in `options.widths`.
   *
   * Contract:
   *  - Aspect ratio is preserved.
   *  - The processor MUST NOT up-scale: if `decoded.width < width` the
   *    output's `width` equals `decoded.width` (the variant is clamped).
   *  - Output `mime` matches `options.targetMime` exactly.
   *  - Output `bytes` is a self-contained encoded image (e.g. for WebP
   *    the full RIFF...WEBP container).
   */
  encodeVariants(
    decoded: ImageDecode,
    options: VariantEncodeOptions,
  ): Promise<readonly ImageVariant[]>;
}

/**
 * The PRD-pinned responsive variant widths for the Electron pipeline.
 * Recorded as a constant so the editor / blocks / IPC handlers all
 * reference the same list.
 */
export const RESPONSIVE_VARIANT_WIDTHS = [400, 800, 1600] as const;

/**
 * Default WebP quality factor for variant generation. Lower than the
 * PRD's q=85 JPEG floor because WebP at q=82 reliably matches q=85 JPEG
 * subjective quality at smaller file sizes — the whole point of using
 * WebP for the Electron-built `srcset`.
 */
export const WEBP_VARIANT_QUALITY = 82;
