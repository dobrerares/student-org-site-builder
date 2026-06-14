import { describe, expect, test } from "vitest";

import { MemoryDriver } from "@sosb/vfs";
import { ZIP_IMPORT_MAX_ENTRIES, ZipDriver } from "@sosb/vfs/zip-driver";

import historipol from "./fixtures/historipol.json" with { type: "json" };
import { exportToZip, importFromZip, ZipImportError } from "../src/index.js";

const enc = new TextEncoder();

function bytes(s: string): Uint8Array {
  return enc.encode(s);
}

describe("importFromZip — corrupted input handling", () => {
  test("throws ZipImportError with code zip.invalid for non-zip bytes", async () => {
    const garbage = new Blob([new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04])], {
      type: "application/zip",
    });
    try {
      await importFromZip(garbage);
      throw new Error("expected ZipImportError but no error was thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ZipImportError);
      expect((err as ZipImportError).code).toBe("zip.invalid");
      expect((err as ZipImportError).message).toMatch(/zip|valid|decode/i);
    }
  });

  test("throws ZipImportError with code zip.invalid for a truncated zip", async () => {
    const driver = new ZipDriver();
    await driver.write("data.json", bytes("{}"));
    const buf = driver.toZipBytes();
    const truncated = buf.slice(0, Math.floor(buf.byteLength / 2));
    try {
      await importFromZip(new Blob([truncated]));
      throw new Error("expected ZipImportError");
    } catch (err) {
      expect(err).toBeInstanceOf(ZipImportError);
      expect((err as ZipImportError).code).toBe("zip.invalid");
    }
  });

  test("throws ZipImportError with code zip.limitsExceeded when import limits are exceeded", async () => {
    const driver = new ZipDriver();
    await driver.write("data.json", bytes("{}"));
    for (let i = 0; i < ZIP_IMPORT_MAX_ENTRIES; i++) {
      await driver.write(`assets/${String(i).padStart(4, "0")}.txt`, bytes("x"));
    }

    const buf = driver.toZipBytes();
    try {
      await importFromZip(new Blob([buf]));
      throw new Error("expected ZipImportError");
    } catch (err) {
      expect(err).toBeInstanceOf(ZipImportError);
      expect((err as ZipImportError).code).toBe("zip.limitsExceeded");
      expect((err as ZipImportError).code).not.toBe("zip.invalid");
    }
  });

  test("throws ZipImportError with code zip.dataJson.missing when data.json is absent", async () => {
    const driver = new ZipDriver();
    await driver.write("DEPLOY.md", bytes("# Deploy"));
    await driver.write("assets/a.png", bytes("png"));
    // No data.json.
    const buf = driver.toZipBytes();
    try {
      await importFromZip(new Blob([buf]));
      throw new Error("expected ZipImportError");
    } catch (err) {
      expect(err).toBeInstanceOf(ZipImportError);
      expect((err as ZipImportError).code).toBe("zip.dataJson.missing");
    }
  });

  test("throws ZipImportError with code zip.dataJson.invalidJson when data.json is not JSON", async () => {
    const driver = new ZipDriver();
    await driver.write("data.json", bytes("not actually json {{{"));
    const buf = driver.toZipBytes();
    try {
      await importFromZip(new Blob([buf]));
      throw new Error("expected ZipImportError");
    } catch (err) {
      expect(err).toBeInstanceOf(ZipImportError);
      expect((err as ZipImportError).code).toBe("zip.dataJson.invalidJson");
    }
  });

  test("throws ZipImportError with code zip.dataJson.invalidShape when validate fails", async () => {
    const driver = new ZipDriver();
    // Valid JSON but missing required `org`, `theme`, etc.
    await driver.write("data.json", bytes('{"schemaVersion":1}'));
    const buf = driver.toZipBytes();
    try {
      await importFromZip(new Blob([buf]));
      throw new Error("expected ZipImportError");
    } catch (err) {
      expect(err).toBeInstanceOf(ZipImportError);
      expect((err as ZipImportError).code).toBe("zip.dataJson.invalidShape");
      // The validation result should be attached so callers can show details.
      expect((err as ZipImportError).validation?.errors.length).toBeGreaterThan(0);
    }
  });

  test("throws ZipImportError with code zip.dataJson.versionTooNew when schemaVersion is from the future", async () => {
    const driver = new ZipDriver();
    const future = structuredClone(historipol) as { schemaVersion: number };
    future.schemaVersion = 999;
    await driver.write("data.json", bytes(JSON.stringify(future)));
    const buf = driver.toZipBytes();
    try {
      await importFromZip(new Blob([buf]));
      throw new Error("expected ZipImportError");
    } catch (err) {
      expect(err).toBeInstanceOf(ZipImportError);
      expect((err as ZipImportError).code).toBe("zip.dataJson.versionTooNew");
    }
  });

  test("a valid export imports cleanly (sanity: the corrupted-input tests are not over-broad)", async () => {
    const blob = await exportToZip(historipol, new MemoryDriver());
    const { siteData } = await importFromZip(blob);
    expect(siteData).toEqual(historipol);
  });
});
