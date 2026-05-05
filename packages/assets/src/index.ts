/**
 * `@sosb/assets` — image processing pipeline.
 *
 * Tracking issue: #8 (browser pipeline). The Electron-side `sharp`-
 * based pipeline lives in #37 and plugs into the same
 * `ImageProcessor` interface this module exports.
 *
 * Public surface:
 *
 *  - `uploadAsset(input, vfs, { processor })` — programmatic upload
 *    entrypoint. Validates alt, detects MIME, resizes raster images,
 *    passes SVG through, hashes the stored bytes, writes the asset
 *    plus a `<hash>.metadata.json` sidecar to the VFS, returns an
 *    `AssetRef`.
 *  - `deleteAsset(vfs, ref)` — removes both the asset and its sidecar.
 *  - `readAssetMetadata(vfs, ref)` — round-trips the sidecar.
 *  - `CanvasImageProcessor` — default browser-side `ImageProcessor`.
 *  - `AssetError` / `AssetErrorCode` — typed error surface.
 *  - `AssetRef`, `AssetMetadata`, `AssetUploadInput` — shared types.
 *  - `MAX_LONG_EDGE_PX`, `JPEG_QUALITY`, `HASH_PREFIX_LENGTH` — pinned
 *    constants the editor / blocks may need to surface in form copy.
 */

export { CanvasImageProcessor } from "./canvas-processor.js";
export { chooseOutputMime, JPEG_QUALITY, MAX_LONG_EDGE_PX } from "./processor.js";
export type { ImageDecode, ImageEncoded, ImageProcessor } from "./processor.js";
export { detectMime, isSupportedMime } from "./mime.js";
export type { SupportedMime } from "./mime.js";
export { HASH_PREFIX_LENGTH, sha256HexPrefix } from "./hash.js";
export { AssetError } from "./errors.js";
export type { AssetErrorCode } from "./errors.js";
export type { AssetMetadata, AssetRef, AssetUploadInput } from "./types.js";
export { deleteAsset, readAssetMetadata, uploadAsset } from "./pipeline.js";
export type { UploadOptions } from "./pipeline.js";
