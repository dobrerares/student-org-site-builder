import { describe, expect, test } from "vitest";

import {
  detectDocumentMime,
  isSupportedDocumentMime,
  type SupportedDocumentMime,
} from "../src/document-mime.js";

/**
 * Magic-byte fixtures for the whitelisted document types.
 *
 * Real PDF / Office bytes are extensive; for detection we only need the
 * first ~16 bytes plus enough of the ZIP central-directory hint to
 * disambiguate Office Open XML containers from a plain ZIP.
 */
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"

// All Office Open XML files (DOCX, XLSX, PPTX) and ODF files (ODT, ODS) are
// ZIP containers. The leading 4 bytes are the ZIP local-file-header magic.
const ZIP_LOCAL_FILE_HEADER = [0x50, 0x4b, 0x03, 0x04];

// DOC (binary) — D0 CF 11 E0 A1 B1 1A E1 (OLE2 / CFBF)
const DOC_OLE_MAGIC = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const PLAIN_ZIP = new Uint8Array(ZIP_LOCAL_FILE_HEADER);

describe("detectDocumentMime — magic-byte detection", () => {
  test("detects PDF from the %PDF- header", () => {
    expect(detectDocumentMime(PDF_MAGIC, undefined, "report.pdf")).toBe("application/pdf");
  });

  test("detects ZIP from the ZIP local-file-header", () => {
    expect(detectDocumentMime(PLAIN_ZIP, undefined, "archive.zip")).toBe("application/zip");
  });

  test("detects legacy DOC from OLE / CFBF magic", () => {
    expect(detectDocumentMime(DOC_OLE_MAGIC, undefined, "letter.doc")).toBe("application/msword");
  });
});

describe("detectDocumentMime — extension disambiguates Office Open XML and ODF containers", () => {
  test("detects DOCX when the file is a zip container with a .docx extension", () => {
    expect(detectDocumentMime(PLAIN_ZIP, undefined, "deck.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  test("detects XLSX from a .xlsx extension", () => {
    expect(detectDocumentMime(PLAIN_ZIP, undefined, "budget.xlsx")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  test("detects PPTX from a .pptx extension", () => {
    expect(detectDocumentMime(PLAIN_ZIP, undefined, "talk.pptx")).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
  });

  test("detects ODT from a .odt extension", () => {
    expect(detectDocumentMime(PLAIN_ZIP, undefined, "doc.odt")).toBe(
      "application/vnd.oasis.opendocument.text",
    );
  });

  test("detects ODS from a .ods extension", () => {
    expect(detectDocumentMime(PLAIN_ZIP, undefined, "sheet.ods")).toBe(
      "application/vnd.oasis.opendocument.spreadsheet",
    );
  });
});

describe("detectDocumentMime — text-shaped types", () => {
  test("detects TXT from a .txt extension on plain UTF-8 text", () => {
    const txt = new TextEncoder().encode("Hello, world.\nThis is a plain document.\n");
    expect(detectDocumentMime(txt, undefined, "notes.txt")).toBe("text/plain");
  });

  test("detects CSV from a .csv extension", () => {
    const csv = new TextEncoder().encode("name,role\nAna,President\n");
    expect(detectDocumentMime(csv, undefined, "members.csv")).toBe("text/csv");
  });
});

describe("detectDocumentMime — rejection paths", () => {
  test("returns null for an unknown extension on a plain zip", () => {
    expect(detectDocumentMime(PLAIN_ZIP, undefined, "mystery.bin")).toBeNull();
  });

  test("returns null for binary bytes with no recognisable signature and no useful name", () => {
    const garbage = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(detectDocumentMime(garbage, undefined, "blob")).toBeNull();
  });

  test("returns null for an executable signature even with a deceptively-named .pdf file", () => {
    // ELF magic.
    const elf = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]);
    expect(detectDocumentMime(elf, undefined, "trojan.pdf")).toBeNull();
  });

  test("returns null for the PE/EXE magic regardless of declared MIME", () => {
    const pe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // "MZ" header
    expect(detectDocumentMime(pe, "application/pdf", "thing.pdf")).toBeNull();
  });

  test("magic-byte detection trumps the file extension when they conflict", () => {
    // A PDF body byte-for-byte saved as "doc.docx". Magic wins.
    expect(detectDocumentMime(PDF_MAGIC, undefined, "secretly-a-pdf.docx")).toBe("application/pdf");
  });
});

describe("isSupportedDocumentMime", () => {
  test.each<SupportedDocumentMime>([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "text/plain",
    "text/csv",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
  ])("accepts whitelisted %s", (mime) => {
    expect(isSupportedDocumentMime(mime)).toBe(true);
  });

  test("rejects executables", () => {
    expect(isSupportedDocumentMime("application/x-msdownload")).toBe(false);
    expect(isSupportedDocumentMime("application/x-elf")).toBe(false);
  });

  test("rejects images (those go through the image pipeline)", () => {
    expect(isSupportedDocumentMime("image/jpeg")).toBe(false);
    expect(isSupportedDocumentMime("image/png")).toBe(false);
  });

  test("rejects video and audio", () => {
    expect(isSupportedDocumentMime("video/mp4")).toBe(false);
    expect(isSupportedDocumentMime("audio/mpeg")).toBe(false);
  });
});
