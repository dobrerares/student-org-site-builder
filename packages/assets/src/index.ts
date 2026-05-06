/**
 * `@sosb/assets` — image and document asset pipeline.
 *
 * Tracking issues: #8 (browser image pipeline), #21 (document pipeline,
 * non-image files), #37 (Electron-side `sharp`-based image pipeline +
 * responsive variants). All three share the same `pipeline.ts`
 * orchestration (mime detect, hash, dedup, sidecar, alt enforcement) and
 * the same `ImageProcessor` seam.
 *
 * Public surface:
 *
 *  Image pipeline (#8):
 *    - `uploadAsset` / `deleteAsset` / `readAssetMetadata`
 *    - `CanvasImageProcessor` — default browser `ImageProcessor`
 *    - `AssetRef`, `AssetMetadata`, `AssetUploadInput`
 *    - `MAX_LONG_EDGE_PX`, `JPEG_QUALITY` — pinned constants
 *
 *  Multi-variant image pipeline (#37):
 *    - `uploadAssetWithVariants` — canonical output PLUS responsive
 *      `srcset` variants. Electron-side default. Pairs with the
 *      production Sharp-backed processor from `./sharp-processor.ts`.
 *    - `buildSrcset`, `DEFAULT_RESPONSIVE_SIZES` — renderer helpers.
 *    - `RESPONSIVE_VARIANT_WIDTHS`, `WEBP_VARIANT_QUALITY` — pinned
 *      constants for the variant pipeline.
 *    - `getDefaultProcessor()` — picks Sharp under Node and Canvas in
 *      a browser. Most call sites should use this.
 *
 *  Document pipeline (#21):
 *    - `uploadDocument` / `deleteDocument` / `readDocumentMetadata`
 *    - `DocumentRef`, `DocumentMetadata`, `DocumentUploadInput`
 *    - `DEFAULT_DOCUMENT_MAX_BYTES` — 25 MiB per-file cap
 *    - `detectDocumentMime`, `isSupportedDocumentMime`
 *    - `SupportedDocumentMime` — closed whitelist of accepted types
 *
 *  Cross-cutting:
 *    - `AssetError` / `AssetErrorCode` — shared typed error surface
 *    - `HASH_PREFIX_LENGTH`, `sha256HexPrefix` — content-addressing
 */

// --- Image pipeline (single-output, #8) -------------------------------------
export { CanvasImageProcessor } from "./canvas-processor.js";
export { chooseOutputMime, JPEG_QUALITY, MAX_LONG_EDGE_PX } from "./processor.js";
export type {
  ImageDecode,
  ImageEncoded,
  ImageProcessor,
  ImageVariant,
  MultiVariantImageProcessor,
  VariantEncodeOptions,
} from "./processor.js";
export { detectMime, isSupportedMime } from "./mime.js";
export type { SupportedMime } from "./mime.js";
export type { AssetMetadata, AssetRef, AssetUploadInput, AssetVariantDescriptor } from "./types.js";
export { deleteAsset, readAssetMetadata, uploadAsset } from "./pipeline.js";
export type { UploadOptions } from "./pipeline.js";

// --- Image pipeline (multi-variant, #37) ------------------------------------
export { RESPONSIVE_VARIANT_WIDTHS, WEBP_VARIANT_QUALITY } from "./processor.js";
export {
  buildSrcset,
  DEFAULT_RESPONSIVE_SIZES,
  uploadAssetWithVariants,
} from "./variant-pipeline.js";
export type { UploadVariantsOptions } from "./variant-pipeline.js";
export { createSharpImageProcessor } from "./sharp-processor.js";
export { getDefaultProcessor, isNodeEnvironment } from "./environment.js";

// --- Document pipeline (#21) ------------------------------------------------
export { detectDocumentMime, isSupportedDocumentMime } from "./document-mime.js";
export type { SupportedDocumentMime } from "./document-mime.js";
export type { DocumentMetadata, DocumentRef, DocumentUploadInput } from "./document-types.js";
export {
  DEFAULT_DOCUMENT_MAX_BYTES,
  deleteDocument,
  readDocumentMetadata,
  uploadDocument,
} from "./document-pipeline.js";
export type { UploadDocumentOptions } from "./document-pipeline.js";

// --- Cross-cutting ----------------------------------------------------------
export { HASH_PREFIX_LENGTH, sha256HexPrefix } from "./hash.js";
export { AssetError } from "./errors.js";
export type { AssetErrorCode } from "./errors.js";
