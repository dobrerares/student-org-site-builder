import { describe, expect, test } from "vitest";
import { ZipDriver } from "../src/index.js";

const enc = new TextEncoder();

function bytes(s: string): Uint8Array {
  return enc.encode(s);
}

describe("ZipDriver byte serialisation", () => {
  test("toZipBytes() then fromZipBytes() reconstructs identical contents", async () => {
    const a = new ZipDriver();
    await a.write("data.json", bytes('{"schemaVersion":1}'));
    await a.write("assets/8e3a7f.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    await a.write("DEPLOY.md", bytes("# Deploy\n"));

    const buf = a.toZipBytes();
    const b = ZipDriver.fromZipBytes(buf);

    expect(await b.list()).toEqual(await a.list());
    for (const path of await a.list()) {
      const aBytes = Array.from(await a.read(path));
      const bBytes = Array.from(await b.read(path));
      expect(bBytes).toEqual(aBytes);
    }
  });

  test("toZipBytes is deterministic across calls (same input → same bytes)", async () => {
    const driver = new ZipDriver();
    await driver.write("z.txt", bytes("z"));
    await driver.write("a.txt", bytes("a"));
    await driver.write("m.txt", bytes("m"));

    const first = driver.toZipBytes();
    const second = driver.toZipBytes();
    expect(Array.from(second)).toEqual(Array.from(first));
  });

  test("toZipBytes is order-insensitive (write order does not affect output)", async () => {
    const a = new ZipDriver();
    await a.write("z.txt", bytes("z"));
    await a.write("a.txt", bytes("a"));
    await a.write("m.txt", bytes("m"));

    const b = new ZipDriver();
    await b.write("a.txt", bytes("a"));
    await b.write("m.txt", bytes("m"));
    await b.write("z.txt", bytes("z"));

    expect(Array.from(b.toZipBytes())).toEqual(Array.from(a.toZipBytes()));
  });

  test("fromZipBytes throws on garbage input", () => {
    const garbage = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(() => ZipDriver.fromZipBytes(garbage)).toThrow(/zip:/);
  });

  test("fromZipBytes throws on a truncated zip", async () => {
    const driver = new ZipDriver();
    await driver.write("a.txt", bytes("payload"));
    const buf = driver.toZipBytes();
    const truncated = buf.slice(0, Math.floor(buf.byteLength / 2));
    expect(() => ZipDriver.fromZipBytes(truncated)).toThrow(/zip:/);
  });

  test("fromZipBytes preserves zero-byte entries", async () => {
    const a = new ZipDriver();
    await a.write("dist/.gitkeep", new Uint8Array(0));
    await a.write("data.json", bytes('{"schemaVersion":1}'));

    const b = ZipDriver.fromZipBytes(a.toZipBytes());
    expect((await b.read("dist/.gitkeep")).byteLength).toBe(0);
    expect(new TextDecoder().decode(await b.read("data.json"))).toBe('{"schemaVersion":1}');
  });

  test("fromZipBytes round-trips binary data byte-for-byte", async () => {
    const a = new ZipDriver();
    const allBytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) allBytes[i] = i;
    await a.write("bin/all-bytes.bin", allBytes);

    const b = ZipDriver.fromZipBytes(a.toZipBytes());
    const back = await b.read("bin/all-bytes.bin");
    expect(Array.from(back)).toEqual(Array.from(allBytes));
  });
});
