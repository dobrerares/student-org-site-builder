import { zipSync } from "fflate";
import { describe, expect, test } from "vitest";

import { runVfsConformance } from "../src/test-conformance.js";
import { ZipDriver } from "../src/index.js";

runVfsConformance("ZipDriver", () => new ZipDriver());

type ImportLimits = Parameters<typeof ZipDriver.fromZipBytes>[1];

const enc = new TextEncoder();

function bytes(input: string): Uint8Array {
  return enc.encode(input);
}

function kibibytes(count: number): Uint8Array {
  return new Uint8Array(count * 1024);
}

function zip(entries: Record<string, Uint8Array>): Uint8Array {
  return zipSync(entries);
}

function expectZipImportLimitError(input: Uint8Array, limits: ImportLimits): void {
  let thrown: unknown;
  try {
    ZipDriver.fromZipBytes(input, limits);
  } catch (err) {
    thrown = err;
  }

  expect(thrown).toBeInstanceOf(Error);
  expect((thrown as Error).message).toMatch(/zip: import limits exceeded/);
  expect((thrown as Error).message).not.toMatch(/input is not a valid zip/);
}

describe("fromZipBytes import limits", () => {
  test("rejects archives over the entry count limit", () => {
    const input = zip({
      "a.txt": bytes("a"),
      "b.txt": bytes("b"),
      "c.txt": bytes("c"),
    });

    expectZipImportLimitError(input, { maxEntries: 2 });
  });

  test("rejects entries over the per-entry size limit", () => {
    const input = zip({
      "large.bin": kibibytes(1),
    });

    expectZipImportLimitError(input, { maxEntryBytes: 512 });
  });

  test("rejects archives over the total size limit", () => {
    const input = zip({
      "one.bin": kibibytes(1),
      "two.bin": kibibytes(1),
    });

    expectZipImportLimitError(input, { maxTotalBytes: 1024 });
  });

  test("parses the same archives with default limits", async () => {
    const entryCountZip = zip({
      "a.txt": bytes("a"),
      "b.txt": bytes("b"),
      "c.txt": bytes("c"),
    });
    const perEntryZip = zip({
      "large.bin": kibibytes(1),
    });
    const totalSizeZip = zip({
      "one.bin": kibibytes(1),
      "two.bin": kibibytes(1),
    });

    await expect(ZipDriver.fromZipBytes(entryCountZip).list()).resolves.toEqual([
      "a.txt",
      "b.txt",
      "c.txt",
    ]);
    await expect(ZipDriver.fromZipBytes(perEntryZip).list()).resolves.toEqual(["large.bin"]);
    await expect(ZipDriver.fromZipBytes(totalSizeZip).list()).resolves.toEqual([
      "one.bin",
      "two.bin",
    ]);
  });
});
