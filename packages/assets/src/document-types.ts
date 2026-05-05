/**
 * Document asset shapes.
 *
 * The reference type that the `documentDownloads` block (#21) carries
 * instead of inlining bytes. A `DocumentRef` is a content-addressed
 * pointer to bytes in the VFS plus the metadata required to render an
 * accessible download link (mime, byte-size, label).
 *
 * Equality semantics mirror `AssetRef`: two `DocumentRef`s are
 * interchangeable iff they share a `hash`. The pipeline guarantees that
 * identical input bytes always produce the same hash, so dedup at
 * upload time means dedup at reference time too.
 */

import type { SupportedDocumentMime } from "./document-mime.js";

export interface DocumentRef {
  /** SHA-256 prefix — content-address of the document. */
  hash: string;
  /** VFS path of the document bytes (e.g. `assets/8e3a7f.pdf`). */
  path: string;
  /** VFS path of the metadata sidecar (e.g. `assets/8e3a7f.metadata.json`). */
  metadataPath: string;
  /** Detected document content type. */
  mime: SupportedDocumentMime;
  /** Stored byte length. Documents are not transcoded; this equals input length. */
  byteSize: number;
}

/**
 * Shape of `<hash>.metadata.json` for documents. Documents don't have
 * pixel dimensions; they carry their byte size, mime, original name,
 * and the user-facing label / optional description that the
 * `documentDownloads` block surfaces.
 */
export interface DocumentMetadata {
  /** The user-supplied filename (e.g. `regulament-2026.pdf`). */
  originalName: string;
  /** Detected document content type. */
  mimeType: SupportedDocumentMime;
  /** Stored byte length. */
  byteSize: number;
  /** Mandatory user-facing label (link text). */
  label: string;
  /** Optional descriptive blurb (sentence-length, no formatting). */
  description?: string;
}

/**
 * Inputs to `uploadDocument`. The pipeline accepts either a `File` or a
 * raw `Uint8Array` plus a name; this lets callers pass through the
 * editor's file-input value unchanged or run programmatic uploads
 * (tests, fixtures, drag-drop bridges).
 */
export type DocumentUploadInput =
  | { kind: "file"; file: File; label: string; description?: string }
  | {
      kind: "bytes";
      bytes: Uint8Array;
      name: string;
      declaredMime?: string;
      label: string;
      description?: string;
    };
