/**
 * `@sosb/zip` — bidirectional import/export with round-trip preservation.
 *
 * `exportToZip(siteData, vfs)` produces a `Blob` with the v1 PRD layout
 * (`data.json`, `assets/`, placeholder `dist/`, `DEPLOY.md`).
 * `importFromZip(blob)` reads the blob back into a validated `siteData`
 * plus a `MemoryDriver` holding the asset bytes, running `@sosb/schema`'s
 * `migrateSite` on the way in.
 *
 * Alongside the round-trip surface, the package also exports
 * `generateDeployMd` — the pure-function generator that produces the
 * user-facing `DEPLOY.md` shipped inside every export zip and rendered
 * by the in-app "Open guide" modal so on-screen and in-zip copy stay in
 * lockstep.
 *
 * Tracking issues: #6 (round-trip), #43 (DEPLOY.md generator).
 */

export { exportToZip, serializeSiteData, copyAssets, DATA_JSON_INDENT } from "./export.js";
export { importFromZip } from "./import.js";
export type { ImportResult } from "./import.js";
export { ZipImportError } from "./errors.js";
export type { ZipImportErrorCode } from "./errors.js";
export { generateDeployMd } from "./deploy-md.js";
export type { DeployLanguage, DeployMdInput } from "./deploy-md.js";
