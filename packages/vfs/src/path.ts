/**
 * VFS path policy.
 *
 * Paths are POSIX-style, forward-slash, no leading slash. The shared
 * validator is used by every driver so the contract is uniform: a malformed
 * path throws `VfsInvalidPathError` regardless of which driver caught it.
 *
 * The empty string, paths starting with `/`, paths containing `\`, and paths
 * containing `..` segments are rejected. Paths must not be longer than 1024
 * characters — the limit is generous but keeps pathological inputs from
 * blowing up the in-memory map.
 */

const MAX_PATH_LENGTH = 1024;

export class VfsInvalidPathError extends Error {
  override readonly name = "VfsInvalidPathError";
  readonly code = "vfs.path.invalid" as const;
  readonly path: string;
  constructor(path: string, reason: string) {
    super(`Invalid VFS path "${path}": ${reason}`);
    this.path = path;
  }
}

/**
 * Validate a VFS path. Throws `VfsInvalidPathError` on rejection. Returns
 * the path unchanged on acceptance so callers can chain
 * `validatePath(p)` inline.
 */
export function validatePath(path: string): string {
  if (typeof path !== "string") {
    throw new VfsInvalidPathError(String(path), "path must be a string");
  }
  if (path.length === 0) {
    throw new VfsInvalidPathError(path, "path must not be empty");
  }
  if (path.length > MAX_PATH_LENGTH) {
    throw new VfsInvalidPathError(path, `path exceeds ${MAX_PATH_LENGTH} characters`);
  }
  if (path.startsWith("/")) {
    throw new VfsInvalidPathError(path, "path must be relative (no leading slash)");
  }
  if (path.includes("\\")) {
    throw new VfsInvalidPathError(path, "path must use forward slashes only");
  }
  for (const segment of path.split("/")) {
    if (segment === "" || segment === "." || segment === "..") {
      throw new VfsInvalidPathError(path, `path contains an invalid segment: "${segment}"`);
    }
  }
  return path;
}

/**
 * Validate a `list()` prefix. Empty string and `undefined` mean "all paths"
 * and short-circuit to no-op. Non-empty prefixes are checked the same way as
 * full paths except that they may end on a `/` — listing `assets/` should
 * return everything underneath, including `assets/foo.png`.
 */
export function validatePrefix(prefix: string | undefined): string {
  if (prefix === undefined || prefix === "") return "";
  if (typeof prefix !== "string") {
    throw new VfsInvalidPathError(String(prefix), "prefix must be a string");
  }
  if (prefix.length > MAX_PATH_LENGTH) {
    throw new VfsInvalidPathError(prefix, `prefix exceeds ${MAX_PATH_LENGTH} characters`);
  }
  if (prefix.startsWith("/")) {
    throw new VfsInvalidPathError(prefix, "prefix must be relative (no leading slash)");
  }
  if (prefix.includes("\\")) {
    throw new VfsInvalidPathError(prefix, "prefix must use forward slashes only");
  }
  // Allow trailing slash, but otherwise validate non-empty segments.
  const trimmed = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  if (trimmed.length > 0) {
    for (const segment of trimmed.split("/")) {
      if (segment === "" || segment === "." || segment === "..") {
        throw new VfsInvalidPathError(prefix, `prefix contains an invalid segment: "${segment}"`);
      }
    }
  }
  return prefix;
}
