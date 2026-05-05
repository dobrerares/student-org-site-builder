/**
 * `@sosb/assets` — image and document asset pipeline.
 *
 * Tracking issues: #8 (browser image pipeline), #21 (document pipeline,
 * non-image files). The Electron-side `sharp`-based image pipeline
 * lives in #37 and plugs into the same `ImageProcessor` interface
 * exported here.
 *
 * Public surface:
 *
 *  Image pipeline (#8):
 *    - `uploadAsset` / `deleteAsset` / `readAssetMetadata`
 *    - `CanvasImageProcessor` — default browser `ImageProcessor`
 *    - `AssetRef`, `AssetMetadata`, `AssetUploadInput`
 *    - `MAX_LONG_EDGE_PX`, `JPEG_QUALITY` — pinned constants
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

// --- Image pipeline ---------------------------------------------------------
export { CanvasImageProcessor } from "./canvas-processor.js";
export { chooseOutputMime, JPEG_QUALITY, MAX_LONG_EDGE_PX } from "./processor.js";
export type { ImageDecode, ImageEncoded, ImageProcessor } from "./processor.js";
export { detectMime, isSupportedMime } from "./mime.js";
export type { SupportedMime } from "./mime.js";
export type { AssetMetadata, AssetRef, AssetUploadInput } from "./types.js";
export { deleteAsset, readAssetMetadata, uploadAsset } from "./pipeline.js";
export type { UploadOptions } from "./pipeline.js";

// --- Document pipeline ------------------------------------------------------
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
