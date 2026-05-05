/**
 * Shared driver-conformance suite.
 *
 * Every driver — `MemoryDriver`, `ZipDriver`, and the future
 * IndexedDB / OPFS / Electron-FS drivers — runs against this exact
 * suite via `runVfsConformance(name, () => driverInstance)`. The
 * promise is: if your driver passes this suite, call sites can
 * substitute it for any other driver without behavioural change.
 *
 * The suite is written with Vitest. Vitest is a peer dependency of
 * `@sosb/vfs` so importing this file from a future driver package
 * picks up the consumer's vitest, not a duplicate copy.
 */

import { describe, expect, test } from "vitest";

import type { Vfs } from "./vfs.js";
import { VfsInvalidPathError, VfsNotFoundError } from "./errors.js";

const enc = new TextEncoder();

function bytes(s: string): Uint8Array {
  return enc.encode(s);
}

/**
 * Run the shared conformance suite against a driver factory. The factory
 * is invoked once per test so each test gets a fresh, empty VFS.
 *
 * @param driverName Display name (appears in test output).
 * @param createDriver Factory returning a freshly-empty driver instance.
 *                     Async to allow drivers that need an open() step.
 */
export function runVfsConformance(
  driverName: string,
  createDriver: () => Promise<Vfs> | Vfs,
): void {
  describe(`VFS conformance: ${driverName}`, () => {
    // -----------------------------------------------------------------
    // write + read
    // -----------------------------------------------------------------

    test("read returns bytes that were written", async () => {
      const vfs = await createDriver();
      await vfs.write("hello.txt", bytes("world"));
      const back = await vfs.read("hello.txt");
      expect(new TextDecoder().decode(back)).toBe("world");
    });

    test("write replaces existing content", async () => {
      const vfs = await createDriver();
      await vfs.write("a.txt", bytes("first"));
      await vfs.write("a.txt", bytes("second"));
      const back = await vfs.read("a.txt");
      expect(new TextDecoder().decode(back)).toBe("second");
    });

    test("write copies the input buffer (mutation after write is safe)", async () => {
      const vfs = await createDriver();
      const buffer = bytes("original");
      await vfs.write("a.txt", buffer);
      // Mutate the buffer the caller passed in. A driver that retained a
      // reference to the buffer would see this mutation reflected in
      // subsequent reads — that's a leak we're testing against.
      buffer[0] = 0;
      const back = await vfs.read("a.txt");
      expect(new TextDecoder().decode(back)).toBe("original");
    });

    test("read returns a fresh copy each time (mutation does not leak across reads)", async () => {
      const vfs = await createDriver();
      await vfs.write("a.txt", bytes("xy"));
      const first = await vfs.read("a.txt");
      first[0] = 0;
      const second = await vfs.read("a.txt");
      expect(new TextDecoder().decode(second)).toBe("xy");
    });

    test("read of an absent path throws VfsNotFoundError", async () => {
      const vfs = await createDriver();
      await expect(vfs.read("missing.txt")).rejects.toBeInstanceOf(VfsNotFoundError);
    });

    test("write supports zero-byte content", async () => {
      const vfs = await createDriver();
      await vfs.write("empty.bin", new Uint8Array(0));
      const back = await vfs.read("empty.bin");
      expect(back.byteLength).toBe(0);
    });

    test("write supports binary (non-UTF-8) content", async () => {
      const vfs = await createDriver();
      const data = new Uint8Array([0x00, 0xff, 0x7f, 0x80, 0x10, 0xab]);
      await vfs.write("blob.bin", data);
      const back = await vfs.read("blob.bin");
      expect(Array.from(back)).toEqual(Array.from(data));
    });

    // -----------------------------------------------------------------
    // has
    // -----------------------------------------------------------------

    test("has returns true for written paths and false for absent paths", async () => {
      const vfs = await createDriver();
      await vfs.write("a.txt", bytes("x"));
      expect(await vfs.has("a.txt")).toBe(true);
      expect(await vfs.has("b.txt")).toBe(false);
    });

    test("has returns false after delete", async () => {
      const vfs = await createDriver();
      await vfs.write("a.txt", bytes("x"));
      await vfs.delete("a.txt");
      expect(await vfs.has("a.txt")).toBe(false);
    });

    // -----------------------------------------------------------------
    // list
    // -----------------------------------------------------------------

    test("list with no prefix returns every path, sorted", async () => {
      const vfs = await createDriver();
      await vfs.write("z/last.txt", bytes("z"));
      await vfs.write("a/first.txt", bytes("a"));
      await vfs.write("m/mid.txt", bytes("m"));
      const all = await vfs.list();
      expect(all).toEqual(["a/first.txt", "m/mid.txt", "z/last.txt"]);
    });

    test("list with prefix returns matching paths only", async () => {
      const vfs = await createDriver();
      await vfs.write("assets/a.png", bytes("a"));
      await vfs.write("assets/b.png", bytes("b"));
      await vfs.write("data.json", bytes("{}"));
      const assets = await vfs.list("assets/");
      expect(assets).toEqual(["assets/a.png", "assets/b.png"]);
    });

    test("list with prefix that has no matches returns empty array", async () => {
      const vfs = await createDriver();
      await vfs.write("a.txt", bytes("x"));
      const out = await vfs.list("missing/");
      expect(out).toEqual([]);
    });

    test("list on an empty VFS returns empty array", async () => {
      const vfs = await createDriver();
      expect(await vfs.list()).toEqual([]);
    });

    test("list result is stable across calls (deterministic ordering)", async () => {
      const vfs = await createDriver();
      // Insert in random-ish order.
      const inserts = ["b/x", "a/y", "c/z", "a/a", "b/a"];
      for (const p of inserts) await vfs.write(p, bytes(p));
      const first = await vfs.list();
      const second = await vfs.list();
      expect(second).toEqual(first);
      expect(first).toEqual([...first].sort());
    });

    // -----------------------------------------------------------------
    // delete
    // -----------------------------------------------------------------

    test("delete removes the path", async () => {
      const vfs = await createDriver();
      await vfs.write("a.txt", bytes("x"));
      await vfs.delete("a.txt");
      await expect(vfs.read("a.txt")).rejects.toBeInstanceOf(VfsNotFoundError);
      expect(await vfs.list()).toEqual([]);
    });

    test("delete of an absent path throws VfsNotFoundError", async () => {
      const vfs = await createDriver();
      await expect(vfs.delete("missing.txt")).rejects.toBeInstanceOf(VfsNotFoundError);
    });

    // -----------------------------------------------------------------
    // copy
    // -----------------------------------------------------------------

    test("copy duplicates bytes from source to destination", async () => {
      const vfs = await createDriver();
      await vfs.write("src.txt", bytes("payload"));
      await vfs.copy("src.txt", "dst.txt");
      expect(new TextDecoder().decode(await vfs.read("dst.txt"))).toBe("payload");
      // Source remains.
      expect(new TextDecoder().decode(await vfs.read("src.txt"))).toBe("payload");
    });

    test("copy overwrites the destination if it exists", async () => {
      const vfs = await createDriver();
      await vfs.write("src.txt", bytes("new"));
      await vfs.write("dst.txt", bytes("old"));
      await vfs.copy("src.txt", "dst.txt");
      expect(new TextDecoder().decode(await vfs.read("dst.txt"))).toBe("new");
    });

    test("copy does not couple source and destination after the call", async () => {
      const vfs = await createDriver();
      await vfs.write("src.txt", bytes("payload"));
      await vfs.copy("src.txt", "dst.txt");
      // Mutating source after copy does not affect destination.
      await vfs.write("src.txt", bytes("changed"));
      expect(new TextDecoder().decode(await vfs.read("dst.txt"))).toBe("payload");
    });

    test("copy from an absent source throws VfsNotFoundError", async () => {
      const vfs = await createDriver();
      await expect(vfs.copy("missing.txt", "dst.txt")).rejects.toBeInstanceOf(VfsNotFoundError);
    });

    test("copy from a path to itself is a no-op (data preserved)", async () => {
      const vfs = await createDriver();
      await vfs.write("a.txt", bytes("payload"));
      await vfs.copy("a.txt", "a.txt");
      expect(new TextDecoder().decode(await vfs.read("a.txt"))).toBe("payload");
    });

    // -----------------------------------------------------------------
    // path validation
    // -----------------------------------------------------------------

    test("write rejects an empty path", async () => {
      const vfs = await createDriver();
      await expect(vfs.write("", bytes("x"))).rejects.toBeInstanceOf(VfsInvalidPathError);
    });

    test("write rejects a leading slash", async () => {
      const vfs = await createDriver();
      await expect(vfs.write("/abs.txt", bytes("x"))).rejects.toBeInstanceOf(VfsInvalidPathError);
    });

    test("write rejects backslashes", async () => {
      const vfs = await createDriver();
      await expect(vfs.write("a\\b.txt", bytes("x"))).rejects.toBeInstanceOf(VfsInvalidPathError);
    });

    test("write rejects '..' segments", async () => {
      const vfs = await createDriver();
      await expect(vfs.write("a/../b.txt", bytes("x"))).rejects.toBeInstanceOf(VfsInvalidPathError);
    });

    test("read rejects malformed paths the same way as write", async () => {
      const vfs = await createDriver();
      await expect(vfs.read("")).rejects.toBeInstanceOf(VfsInvalidPathError);
      await expect(vfs.read("/abs")).rejects.toBeInstanceOf(VfsInvalidPathError);
    });

    test("delete rejects malformed paths", async () => {
      const vfs = await createDriver();
      await expect(vfs.delete("/abs")).rejects.toBeInstanceOf(VfsInvalidPathError);
    });

    test("copy rejects malformed source or destination", async () => {
      const vfs = await createDriver();
      await vfs.write("ok.txt", bytes("x"));
      await expect(vfs.copy("ok.txt", "")).rejects.toBeInstanceOf(VfsInvalidPathError);
      await expect(vfs.copy("/abs", "ok2.txt")).rejects.toBeInstanceOf(VfsInvalidPathError);
    });

    test("has on a malformed path throws VfsInvalidPathError", async () => {
      const vfs = await createDriver();
      await expect(vfs.has("/abs")).rejects.toBeInstanceOf(VfsInvalidPathError);
    });

    // -----------------------------------------------------------------
    // mixed-content scenario (closer to real export/import use)
    // -----------------------------------------------------------------

    test("realistic mixed-content scenario survives the basic CRUD cycle", async () => {
      const vfs = await createDriver();
      await vfs.write("data.json", bytes('{"schemaVersion":1}'));
      await vfs.write("assets/8e3a7f.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
      await vfs.write("assets/4a91d2.jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]));
      await vfs.write("DEPLOY.md", bytes("# Deploy\n"));

      expect(await vfs.list()).toEqual([
        "DEPLOY.md",
        "assets/4a91d2.jpg",
        "assets/8e3a7f.png",
        "data.json",
      ]);
      expect(await vfs.list("assets/")).toEqual(["assets/4a91d2.jpg", "assets/8e3a7f.png"]);

      await vfs.copy("assets/8e3a7f.png", "assets/copy.png");
      expect(await vfs.has("assets/copy.png")).toBe(true);

      await vfs.delete("assets/copy.png");
      expect(await vfs.has("assets/copy.png")).toBe(false);
      expect(await vfs.list("assets/")).toEqual(["assets/4a91d2.jpg", "assets/8e3a7f.png"]);
    });
  });
}
