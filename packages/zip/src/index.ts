/**
 * `@sosb/zip` — bidirectional import/export with round-trip preservation.
 *
 * `exportToZip(siteData, vfs)` produces a `Blob` with the v1 PRD layout
 * (`data.json`, `assets/`, placeholder `dist/`, placeholder
 * `DEPLOY.md`). `importFromZip(blob)` reads the blob back into a
 * validated `siteData` plus a `MemoryDriver` holding the asset bytes,
 * running `@sosb/schema`'s `migrateSite` on the way in.
 *
 * Tracking issue: #6.
 */

export { exportToZip, serializeSiteData, copyAssets, DATA_JSON_INDENT } from "./export.js";
export { importFromZip } from "./import.js";
export type { ImportResult } from "./import.js";
export { ZipImportError } from "./errors.js";
export type { ZipImportErrorCode } from "./errors.js";
