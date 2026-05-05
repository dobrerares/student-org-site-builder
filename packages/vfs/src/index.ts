/**
 * `@sosb/vfs` — virtual filesystem abstraction with multiple drivers.
 *
 * The shipped drivers in v1 are `MemoryDriver` (used by tests and the
 * editor's in-memory document model) and `ZipDriver` (used by the
 * `@sosb/zip` import/export module). Future IndexedDB / OPFS /
 * Electron-FS drivers (#35, #37) will plug in by implementing the same
 * `Vfs` interface and passing `runVfsConformance(...)` from
 * `@sosb/vfs/test-conformance`.
 *
 * Tracking issue: #6.
 */

export type { Vfs } from "./vfs.js";
export { MemoryDriver } from "./memory.js";
export { ZipDriver, ZIP_DRIVER_MTIME } from "./zip-driver.js";
export { FsDriver } from "./fs-driver.js";
export { VfsInvalidPathError, VfsNotFoundError, VfsAlreadyExistsError } from "./errors.js";
export { validatePath, validatePrefix } from "./path.js";
