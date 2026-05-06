/**
 * FS-backed VFS driver -- "sites are folders on disk" persistence
 * (PRD: "Electron persistence: real filesystem. Sites are folders").
 *
 * The driver maps the abstract POSIX-style VFS path space onto a real
 * directory rooted at the host OS path passed to the constructor.
 * Every read/write/delete/copy/list operation is constrained to that
 * root: the path validator rejects `..` segments and absolute paths
 * (inherited from the shared `validatePath`), and the resolved host
 * path is checked at each call so a permitted-shape relative path
 * cannot escape via symlinks or subtle joins.
 *
 * Node-only. The FS driver runs in the Electron main process; the
 * renderer (sandbox: true) cannot import it.
 *
 * Determinism note: `list()` returns POSIX-style paths sorted
 * lexicographically. Internally we walk the filesystem with `readdir`
 * but normalise every host-OS separator to `/` before returning.
 */

import * as fs from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import * as path from "node:path";

import type { Vfs } from "./vfs.js";
import { VfsInvalidPathError, VfsNotFoundError } from "./errors.js";
import { validatePath, validatePrefix } from "./path.js";

const NODE_ENOENT = "ENOENT";

export class FsDriver implements Vfs {
  readonly #rootDir: string;

  constructor(rootDir: string) {
    if (typeof rootDir !== "string" || rootDir.length === 0) {
      throw new TypeError("FsDriver: rootDir must be a non-empty string");
    }
    // Resolve once so subsequent operations don't depend on cwd.
    this.#rootDir = path.resolve(rootDir);
    // Make sure the root exists. A site folder may be empty but not absent.
    if (!existsSync(this.#rootDir)) {
      mkdirSync(this.#rootDir, { recursive: true });
    }
  }

  async read(p: string): Promise<Uint8Array> {
    const key = validatePath(p);
    const hostPath = this.#resolveInside(key);
    try {
      const buffer = await fs.readFile(hostPath);
      return new Uint8Array(buffer);
    } catch (err) {
      if (isEnoent(err)) throw new VfsNotFoundError(key);
      throw err;
    }
  }

  async write(p: string, bytes: Uint8Array): Promise<void> {
    const key = validatePath(p);
    const hostPath = this.#resolveInside(key);
    const hostDir = path.dirname(hostPath);
    await fs.mkdir(hostDir, { recursive: true });
    // Defensive copy: we don't want a later mutation of the caller's
    // buffer to corrupt the file we just wrote (well, the kernel buffers
    // it, but contractually we promise stable bytes).
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    await fs.writeFile(hostPath, copy);
  }

  async list(prefix?: string): Promise<string[]> {
    const validatedPrefix = validatePrefix(prefix);
    // Walk the root, accumulate POSIX-style relative paths.
    const out: string[] = [];
    await walk(this.#rootDir, this.#rootDir, out);
    out.sort();
    if (validatedPrefix === "") return out;
    return out.filter((p) => p.startsWith(validatedPrefix));
  }

  async delete(p: string): Promise<void> {
    const key = validatePath(p);
    const hostPath = this.#resolveInside(key);
    try {
      await fs.unlink(hostPath);
    } catch (err) {
      if (isEnoent(err)) throw new VfsNotFoundError(key);
      throw err;
    }
  }

  async copy(from: string, to: string): Promise<void> {
    const src = validatePath(from);
    const dst = validatePath(to);
    const srcHost = this.#resolveInside(src);
    const dstHost = this.#resolveInside(dst);
    if (!existsSync(srcHost)) throw new VfsNotFoundError(src);
    // Self-copy: read+write so the source and destination buffers stay
    // independent on the FS too (semantically a no-op but matches the
    // MemoryDriver's contract).
    if (srcHost === dstHost) {
      const data = await fs.readFile(srcHost);
      await fs.writeFile(dstHost, data);
      return;
    }
    await fs.mkdir(path.dirname(dstHost), { recursive: true });
    await fs.copyFile(srcHost, dstHost);
  }

  async has(p: string): Promise<boolean> {
    const key = validatePath(p);
    const hostPath = this.#resolveInside(key);
    return existsSync(hostPath);
  }

  /**
   * Resolve a validated VFS path to a host-OS path inside the root,
   * rejecting any result that would leak outside (defence in depth on
   * top of the path validator).
   */
  #resolveInside(vfsPath: string): string {
    const hostPath = path.resolve(this.#rootDir, vfsPath);
    const rootWithSep = this.#rootDir.endsWith(path.sep) ? this.#rootDir : this.#rootDir + path.sep;
    if (hostPath !== this.#rootDir && !hostPath.startsWith(rootWithSep)) {
      throw new VfsInvalidPathError(vfsPath, "path resolves outside the FS driver root");
    }
    return hostPath;
  }
}

async function walk(rootDir: string, current: string, out: string[]): Promise<void> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(current, { withFileTypes: true });
  } catch (err) {
    if (isEnoent(err)) return;
    throw err;
  }
  for (const entry of entries) {
    const childHost = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await walk(rootDir, childHost, out);
    } else if (entry.isFile()) {
      const rel = path.relative(rootDir, childHost);
      // Normalise host separators to POSIX forward slashes -- the VFS
      // path space is platform-independent.
      out.push(rel.split(path.sep).join("/"));
    }
    // Symlinks and special files are skipped silently; the v1 FS driver
    // doesn't traverse them. Sites should never legitimately contain
    // symlinks anyway.
  }
}

function isEnoent(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === NODE_ENOENT;
}
