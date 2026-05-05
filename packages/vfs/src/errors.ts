/**
 * VFS error types. Every driver throws these, never plain `Error`, so callers
 * can branch on `error.code` rather than parsing messages.
 */

export class VfsNotFoundError extends Error {
  override readonly name = "VfsNotFoundError";
  readonly code = "vfs.path.notFound" as const;
  readonly path: string;
  constructor(path: string) {
    super(`VFS path not found: "${path}"`);
    this.path = path;
  }
}

export class VfsAlreadyExistsError extends Error {
  override readonly name = "VfsAlreadyExistsError";
  readonly code = "vfs.path.alreadyExists" as const;
  readonly path: string;
  constructor(path: string) {
    super(`VFS path already exists: "${path}"`);
    this.path = path;
  }
}

export { VfsInvalidPathError } from "./path.js";
