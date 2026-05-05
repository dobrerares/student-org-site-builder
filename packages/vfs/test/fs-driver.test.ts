/**
 * FS-backed VFS driver tests.
 *
 * The driver passes the shared `runVfsConformance` suite (~30 tests),
 * so the sites-as-folders persistence behaves identically to the
 * `MemoryDriver` and `ZipDriver` from a call-site perspective.
 *
 * Plus a few FS-specific guarantees:
 *
 *  - Stays inside the configured root (path traversal rejected).
 *  - Creates intermediate directories implicitly.
 *  - Survives reopening: a new driver pointed at the same root sees
 *    everything a previous driver wrote.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { runVfsConformance } from "../src/test-conformance.js";
import { FsDriver } from "../src/fs-driver.js";
import { VfsInvalidPathError, VfsNotFoundError } from "../src/errors.js";

let rootDir: string;

beforeEach(() => {
  rootDir = mkdtempSync(join(tmpdir(), "sosb-vfs-fs-"));
});

afterEach(() => {
  rmSync(rootDir, { recursive: true, force: true });
});

// Every conformance test runs against a fresh subdir so they don't share state.
runVfsConformance("FsDriver", () => {
  const sub = mkdtempSync(join(tmpdir(), "sosb-vfs-fs-conf-"));
  return new FsDriver(sub);
});

describe("FsDriver — FS-specific behaviour", () => {
  test("survives reopening: a new driver at the same root sees what was written", async () => {
    const a = new FsDriver(rootDir);
    await a.write("data.json", new TextEncoder().encode('{"k":1}'));
    await a.write("assets/logo.svg", new TextEncoder().encode("<svg/>"));

    const b = new FsDriver(rootDir);
    expect(await b.has("data.json")).toBe(true);
    expect(await b.has("assets/logo.svg")).toBe(true);
    const loaded = await b.read("assets/logo.svg");
    expect(new TextDecoder().decode(loaded)).toBe("<svg/>");
  });

  test("creates intermediate directories implicitly", async () => {
    const driver = new FsDriver(rootDir);
    await driver.write("a/b/c/d.txt", new TextEncoder().encode("nested"));
    expect(await driver.has("a/b/c/d.txt")).toBe(true);
  });

  test("rejects path traversal attempts that escape the root", async () => {
    const driver = new FsDriver(rootDir);
    await expect(
      driver.write("../escape.txt", new TextEncoder().encode("nope")),
    ).rejects.toBeInstanceOf(VfsInvalidPathError);
  });

  test("list returns POSIX-style relative paths regardless of host OS", async () => {
    const driver = new FsDriver(rootDir);
    await driver.write("assets/a.png", new Uint8Array([1, 2]));
    await driver.write("assets/sub/b.png", new Uint8Array([3, 4]));
    const all = await driver.list("assets/");
    // No backslashes; sorted lexicographically.
    for (const path of all) {
      expect(path.includes("\\")).toBe(false);
    }
    expect(all).toEqual(["assets/a.png", "assets/sub/b.png"]);
  });

  test("read of a non-existent file throws VfsNotFoundError (not raw Node error)", async () => {
    const driver = new FsDriver(rootDir);
    await expect(driver.read("missing.txt")).rejects.toBeInstanceOf(VfsNotFoundError);
  });

  test("delete + write of the same path round-trips", async () => {
    const driver = new FsDriver(rootDir);
    await driver.write("a.txt", new TextEncoder().encode("first"));
    await driver.delete("a.txt");
    await driver.write("a.txt", new TextEncoder().encode("second"));
    expect(new TextDecoder().decode(await driver.read("a.txt"))).toBe("second");
  });
});
