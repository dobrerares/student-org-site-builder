/**
 * Document upload pipeline tests — exercise `uploadDocument` against a
 * real `MemoryDriver` VFS. The orchestration mirrors `uploadAsset` for
 * images: detect mime → hash stored bytes → write asset + metadata
 * sidecar → return a `DocumentRef`. Documents are stored as-is (no
 * re-encoding) so the path is independent of the image processor.
 *
 * Acceptance criteria mapped to these tests:
 *
 * - Whitelisted document types accepted (PDF, ZIP, DOCX, etc.).
 * - Executables / unsupported types rejected.
 * - 25MB per-file cap enforced; clear error code when exceeded.
 * - Metadata sidecar carries `mimeType`, `byteSize`, `originalName`.
 * - Dedup: identical bytes → same `<hash>` path.
 * - Delete removes both the asset and the sidecar.
 */

import { describe, expect, test } from "vitest";

import { MemoryDriver } from "@sosb/vfs";

import { AssetError } from "../src/errors.js";
import {
  DEFAULT_DOCUMENT_MAX_BYTES,
  deleteDocument,
  readDocumentMetadata,
  uploadDocument,
} from "../src/document-pipeline.js";
import type { DocumentMetadata } from "../src/document-types.js";

const PDF_HEADER = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]); // "%PDF-1.4\n"
const ZIP_HEADER = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

function pad(prefix: Uint8Array, length: number): Uint8Array {
  const out = new Uint8Array(length);
  out.set(prefix, 0);
  // Fill the rest with low-entropy bytes; size-cap tests don't care
  // about content, only length.
  for (let i = prefix.length; i < length; i++) {
    out[i] = (i * 31) & 0xff;
  }
  return out;
}

describe("uploadDocument — accepts whitelisted document types", () => {
  test("PDF: stores the input bytes verbatim (no re-encoding)", async () => {
    const vfs = new MemoryDriver();
    const bytes = pad(PDF_HEADER, 1024);
    const ref = await uploadDocument(
      { kind: "bytes", bytes, name: "regulament.pdf", label: "Regulament" },
      vfs,
    );
    expect(ref.mime).toBe("application/pdf");
    expect(ref.path.endsWith(".pdf")).toBe(true);
    expect(ref.byteSize).toBe(bytes.byteLength);

    const stored = await vfs.read(ref.path);
    expect(Array.from(stored)).toEqual(Array.from(bytes));
  });

  test("DOCX: ZIP magic + .docx extension is recognised as DOCX and stored", async () => {
    const vfs = new MemoryDriver();
    const bytes = pad(ZIP_HEADER, 4096);
    const ref = await uploadDocument(
      { kind: "bytes", bytes, name: "note.docx", label: "Note" },
      vfs,
    );
    expect(ref.mime).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(ref.path.endsWith(".docx")).toBe(true);
  });

  test("CSV: text bytes with .csv extension are recognised", async () => {
    const vfs = new MemoryDriver();
    const bytes = new TextEncoder().encode("name,role\nAna,President\n");
    const ref = await uploadDocument(
      { kind: "bytes", bytes, name: "members.csv", label: "Members" },
      vfs,
    );
    expect(ref.mime).toBe("text/csv");
    expect(ref.path.endsWith(".csv")).toBe(true);
    expect(ref.byteSize).toBe(bytes.byteLength);
  });

  test("ZIP: bare zip with .zip extension is accepted as application/zip", async () => {
    const vfs = new MemoryDriver();
    const bytes = pad(ZIP_HEADER, 256);
    const ref = await uploadDocument(
      { kind: "bytes", bytes, name: "bundle.zip", label: "Bundle" },
      vfs,
    );
    expect(ref.mime).toBe("application/zip");
  });
});

describe("uploadDocument — content-addressed dedup", () => {
  test("uploading identical bytes twice produces a single VFS entry per file (asset + sidecar)", async () => {
    const vfs = new MemoryDriver();
    const bytes = pad(PDF_HEADER, 2048);

    const first = await uploadDocument({ kind: "bytes", bytes, name: "a.pdf", label: "A" }, vfs);
    const second = await uploadDocument(
      { kind: "bytes", bytes, name: "ignored.pdf", label: "B" },
      vfs,
    );

    expect(second.hash).toBe(first.hash);
    expect(second.path).toBe(first.path);
    expect(second.metadataPath).toBe(first.metadataPath);

    const paths = await vfs.list("assets/");
    expect(paths.length).toBe(2);
    expect(paths).toContain(first.path);
    expect(paths).toContain(first.metadataPath);
  });
});

describe("uploadDocument — metadata sidecar", () => {
  test("sidecar carries originalName, mimeType, byteSize, label, and optional description", async () => {
    const vfs = new MemoryDriver();
    const bytes = pad(PDF_HEADER, 512);
    const ref = await uploadDocument(
      {
        kind: "bytes",
        bytes,
        name: "regulament-2026.pdf",
        label: "Regulament 2026",
        description: "Regulamentul intern, ediția 2026.",
      },
      vfs,
    );

    const sidecarBytes = await vfs.read(ref.metadataPath);
    const sidecar: DocumentMetadata = JSON.parse(new TextDecoder().decode(sidecarBytes));
    expect(sidecar.originalName).toBe("regulament-2026.pdf");
    expect(sidecar.mimeType).toBe("application/pdf");
    expect(sidecar.byteSize).toBe(bytes.byteLength);
    expect(sidecar.label).toBe("Regulament 2026");
    expect(sidecar.description).toBe("Regulamentul intern, ediția 2026.");
  });

  test("sidecar path follows the <hash>.metadata.json convention", async () => {
    const vfs = new MemoryDriver();
    const bytes = pad(PDF_HEADER, 256);
    const ref = await uploadDocument({ kind: "bytes", bytes, name: "doc.pdf", label: "Doc" }, vfs);
    expect(ref.metadataPath).toBe(`assets/${ref.hash}.metadata.json`);
  });
});

describe("uploadDocument — rejection paths", () => {
  test("rejects an unsupported binary type with asset.mime.unsupported", async () => {
    const vfs = new MemoryDriver();
    // ELF magic — not on the document whitelist.
    const elf = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]);
    await expect(
      uploadDocument({ kind: "bytes", bytes: elf, name: "tool.bin", label: "Tool" }, vfs),
    ).rejects.toMatchObject({ name: "AssetError", code: "asset.mime.unsupported" });
  });

  test("rejects an executable even when given a deceptive .pdf name", async () => {
    const vfs = new MemoryDriver();
    const pe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // "MZ" header
    await expect(
      uploadDocument({ kind: "bytes", bytes: pe, name: "trojan.pdf", label: "Trojan" }, vfs),
    ).rejects.toMatchObject({ name: "AssetError", code: "asset.mime.unsupported" });
  });

  test("rejects an upload with empty label (parallels alt enforcement on images)", async () => {
    const vfs = new MemoryDriver();
    const bytes = pad(PDF_HEADER, 128);
    await expect(
      uploadDocument({ kind: "bytes", bytes, name: "doc.pdf", label: "" }, vfs),
    ).rejects.toMatchObject({ name: "AssetError", code: "asset.label.missing" });
  });

  test("rejects an upload with whitespace-only label", async () => {
    const vfs = new MemoryDriver();
    const bytes = pad(PDF_HEADER, 128);
    await expect(
      uploadDocument({ kind: "bytes", bytes, name: "doc.pdf", label: "   " }, vfs),
    ).rejects.toBeInstanceOf(AssetError);
  });
});

describe("uploadDocument — 25MB cap (configurable)", () => {
  test("a file exceeding the default 25MB cap is rejected with asset.size.exceeded", async () => {
    const vfs = new MemoryDriver();
    // Just over 25MB.
    const oversized = pad(PDF_HEADER, DEFAULT_DOCUMENT_MAX_BYTES + 1);
    await expect(
      uploadDocument({ kind: "bytes", bytes: oversized, name: "huge.pdf", label: "Huge" }, vfs),
    ).rejects.toMatchObject({ name: "AssetError", code: "asset.size.exceeded" });
  });

  test("the default cap is exactly 25MiB (26_214_400 bytes)", () => {
    expect(DEFAULT_DOCUMENT_MAX_BYTES).toBe(25 * 1024 * 1024);
  });

  test("cap is configurable per call (lower override applies)", async () => {
    const vfs = new MemoryDriver();
    const tenKb = pad(PDF_HEADER, 10_000);
    await expect(
      uploadDocument({ kind: "bytes", bytes: tenKb, name: "big.pdf", label: "Big" }, vfs, {
        maxBytes: 5_000,
      }),
    ).rejects.toMatchObject({ name: "AssetError", code: "asset.size.exceeded" });
  });

  test("size-exceeded error message names the actual cap in MiB so callers can surface it to users", async () => {
    const vfs = new MemoryDriver();
    const oversized = pad(PDF_HEADER, 5 * 1024 * 1024 + 1);
    let captured: AssetError | undefined;
    try {
      await uploadDocument({ kind: "bytes", bytes: oversized, name: "x.pdf", label: "X" }, vfs, {
        maxBytes: 5 * 1024 * 1024,
      });
    } catch (e) {
      captured = e as AssetError;
    }
    expect(captured).toBeInstanceOf(AssetError);
    expect(captured?.code).toBe("asset.size.exceeded");
    // Message mentions the limit so editor UIs and tests can rely on it.
    expect(captured?.message).toMatch(/5\s*MiB|5\s*MB/);
  });

  test("a file exactly at the cap is accepted", async () => {
    const vfs = new MemoryDriver();
    const exact = pad(PDF_HEADER, 1024);
    const ref = await uploadDocument(
      { kind: "bytes", bytes: exact, name: "ok.pdf", label: "Ok" },
      vfs,
      { maxBytes: 1024 },
    );
    expect(ref.byteSize).toBe(1024);
  });
});

describe("deleteDocument", () => {
  test("removes both the asset and its sidecar", async () => {
    const vfs = new MemoryDriver();
    const bytes = pad(PDF_HEADER, 512);
    const ref = await uploadDocument({ kind: "bytes", bytes, name: "doc.pdf", label: "Doc" }, vfs);

    expect(await vfs.has(ref.path)).toBe(true);
    expect(await vfs.has(ref.metadataPath)).toBe(true);

    await deleteDocument(vfs, ref);

    expect(await vfs.has(ref.path)).toBe(false);
    expect(await vfs.has(ref.metadataPath)).toBe(false);
    expect(await vfs.list("assets/")).toEqual([]);
  });

  test("delete throws AssetError(notFound) for an unknown ref", async () => {
    const vfs = new MemoryDriver();
    await expect(
      deleteDocument(vfs, {
        hash: "deadbeefdeadbeef",
        path: "assets/deadbeefdeadbeef.pdf",
        metadataPath: "assets/deadbeefdeadbeef.metadata.json",
        mime: "application/pdf",
        byteSize: 1,
      }),
    ).rejects.toMatchObject({ name: "AssetError", code: "asset.notFound" });
  });
});

describe("readDocumentMetadata", () => {
  test("round-trips the sidecar JSON", async () => {
    const vfs = new MemoryDriver();
    const bytes = pad(PDF_HEADER, 256);
    const ref = await uploadDocument(
      {
        kind: "bytes",
        bytes,
        name: "doc.pdf",
        label: "Doc",
        description: "A short description.",
      },
      vfs,
    );
    const metadata = await readDocumentMetadata(vfs, ref);
    expect(metadata.originalName).toBe("doc.pdf");
    expect(metadata.label).toBe("Doc");
    expect(metadata.description).toBe("A short description.");
  });
});
