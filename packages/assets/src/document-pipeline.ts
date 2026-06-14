/**
 * Document upload / delete orchestration for non-image files.
 *
 * The `documentDownloads` block (#21) extends the asset pipeline to
 * non-image files: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, ZIP, TXT, CSV,
 * ODT, ODS. Documents are stored verbatim (no resize / re-encode), so
 * the pipeline is simpler than its image sibling — no `ImageProcessor`
 * seam, just MIME-detect → size-cap → hash → write.
 *
 * Flow:
 *
 * 1. Validate label (mandatory, non-empty after trim).
 * 2. Enforce the per-file byte cap (default 25 MiB, configurable).
 * 3. Detect MIME from magic bytes + filename extension; reject
 *    unsupported / executable types.
 * 4. Hash the stored bytes with SHA-256 and write
 *    `assets/<hash>.<ext>` plus `assets/<hash>.metadata.json`.
 * 5. Return a `DocumentRef`.
 *
 * Dedup is automatic: identical input bytes produce the same hash and
 * therefore the same paths.
 *
 * Constraint: every byte stored on disk must round-trip exactly.
 * Tests assert byte-equality between input and stored output.
 */

import type { Vfs } from "@sosb/vfs";

import { AssetError } from "./errors.js";
import {
  detectDocumentMime,
  isSupportedDocumentMime,
  type SupportedDocumentMime,
} from "./document-mime.js";
import { sha256HexPrefix } from "./hash.js";
import type { DocumentMetadata, DocumentRef, DocumentUploadInput } from "./document-types.js";

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * The PRD-pinned per-document byte cap. 25 MiB is the v1 default;
 * callers can override via `UploadDocumentOptions.maxBytes`.
 */
export const DEFAULT_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

export interface UploadDocumentOptions {
  /** Override the per-document byte cap. Defaults to {@link DEFAULT_DOCUMENT_MAX_BYTES}. */
  maxBytes?: number;
}

/**
 * The single programmatic upload entrypoint for documents. Returns a
 * `DocumentRef` that the `documentDownloads` block carries by reference.
 *
 * Throws `AssetError`:
 *   - `asset.label.missing`     label is empty or whitespace-only.
 *   - `asset.size.exceeded`     bytes exceed the active byte cap.
 *   - `asset.mime.unsupported`  bytes are neither a recognised document
 *                                 type nor on the document whitelist.
 */
export async function uploadDocument(
  input: DocumentUploadInput,
  vfs: Vfs,
  options?: UploadDocumentOptions,
): Promise<DocumentRef> {
  const maxBytes = options?.maxBytes ?? DEFAULT_DOCUMENT_MAX_BYTES;

  // 1. Coerce input to a uniform shape.
  const { bytes, name, declaredMime, label, description } = await normaliseInput(input);

  // 2. Label enforcement (parallel to alt enforcement on images).
  if (!label || label.trim().length === 0) {
    throw new AssetError(
      "asset.label.missing",
      "Document label is mandatory. Provide a non-empty `label`.",
    );
  }

  // 3. Size cap.
  if (bytes.byteLength > maxBytes) {
    const capMib = (maxBytes / (1024 * 1024)).toFixed(maxBytes % (1024 * 1024) === 0 ? 0 : 1);
    throw new AssetError(
      "asset.size.exceeded",
      `Document is ${formatMib(bytes.byteLength)} which exceeds the ${capMib} MiB per-file cap. ` +
        `Compress the file or split it into smaller pieces.`,
    );
  }

  // 4. MIME detection.
  const mime = detectDocumentMime(bytes, declaredMime ?? null, name);
  if (mime === null || !isSupportedDocumentMime(mime)) {
    throw new AssetError(
      "asset.mime.unsupported",
      `Unsupported document type${declaredMime ? ` (declared "${declaredMime}")` : ""} for ` +
        `"${name}". The pipeline accepts PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, ZIP, TXT, ` +
        `CSV, ODT, ODS. Executables are not allowed.`,
    );
  }

  // 5. Hash the stored bytes.
  const hash = await sha256HexPrefix(bytes);
  const ext = extensionFor(mime);
  const path = `assets/${hash}.${ext}`;
  const metadataPath = `assets/${hash}.metadata.json`;

  // 6. Write asset bytes (verbatim) and the sidecar.
  await vfs.write(path, bytes);
  const metadata: DocumentMetadata = {
    originalName: name,
    mimeType: mime,
    byteSize: bytes.byteLength,
    label,
    ...(description !== undefined ? { description } : {}),
  };
  await vfs.write(metadataPath, enc.encode(JSON.stringify(metadata, null, 2) + "\n"));

  return { hash, path, metadataPath, mime, byteSize: bytes.byteLength, originalName: name };
}

/**
 * Delete a document and its metadata sidecar. Throws
 * `AssetError("asset.notFound")` if neither the bytes nor the sidecar
 * exist; if either is present, the existing one is removed.
 */
export async function deleteDocument(vfs: Vfs, ref: DocumentRef): Promise<void> {
  const hasAsset = await vfs.has(ref.path);
  const hasSidecar = await vfs.has(ref.metadataPath);
  if (!hasAsset && !hasSidecar) {
    throw new AssetError("asset.notFound", `No document at ${ref.path}.`);
  }
  if (hasAsset) await vfs.delete(ref.path);
  if (hasSidecar) await vfs.delete(ref.metadataPath);
}

/**
 * Read the metadata sidecar for a document. Throws
 * `AssetError("asset.notFound")` if the sidecar is missing.
 */
export async function readDocumentMetadata(vfs: Vfs, ref: DocumentRef): Promise<DocumentMetadata> {
  if (!(await vfs.has(ref.metadataPath))) {
    throw new AssetError("asset.notFound", `No metadata sidecar at ${ref.metadataPath}.`);
  }
  const bytes = await vfs.read(ref.metadataPath);
  return JSON.parse(dec.decode(bytes)) as DocumentMetadata;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface NormalisedDocumentInput {
  bytes: Uint8Array;
  name: string;
  declaredMime: string | undefined;
  label: string;
  description: string | undefined;
}

async function normaliseInput(input: DocumentUploadInput): Promise<NormalisedDocumentInput> {
  if (input.kind === "bytes") {
    return {
      bytes: input.bytes,
      name: input.name,
      declaredMime: input.declaredMime,
      label: input.label,
      description: input.description,
    };
  }
  const buffer = await input.file.arrayBuffer();
  return {
    bytes: new Uint8Array(buffer),
    name: input.file.name,
    declaredMime: input.file.type || undefined,
    label: input.label,
    description: input.description,
  };
}

/**
 * Pick a stable file extension per supported document MIME. The
 * extension survives into the VFS path, so editor surfaces and the
 * built site can rely on it without re-detecting.
 */
function extensionFor(mime: SupportedDocumentMime): string {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "application/msword":
      return "doc";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "docx";
    case "application/vnd.ms-excel":
      return "xls";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return "xlsx";
    case "application/vnd.ms-powerpoint":
      return "ppt";
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      return "pptx";
    case "application/zip":
      return "zip";
    case "text/plain":
      return "txt";
    case "text/csv":
      return "csv";
    case "application/vnd.oasis.opendocument.text":
      return "odt";
    case "application/vnd.oasis.opendocument.spreadsheet":
      return "ods";
  }
}

/**
 * Format a byte count as a human-readable MiB string. Used in error
 * messages so the editor / CLI can echo the cap straight from the
 * thrown `AssetError`.
 */
function formatMib(bytes: number): string {
  const mib = bytes / (1024 * 1024);
  if (mib >= 10) return `${Math.round(mib)} MiB`;
  return `${mib.toFixed(1)} MiB`;
}
