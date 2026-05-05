/**
 * The reference type that image-bearing blocks (#14, #17, #21, #46)
 * carry instead of an inline byte buffer. An `AssetRef` is a content-
 * addressed pointer to bytes in the VFS plus the metadata required to
 * render the image accessibly (width, height, alt).
 *
 * Equality semantics: two `AssetRef`s are interchangeable iff they have
 * the same `hash`. Identical input bytes always produce the same hash,
 * so dedup at upload-time means dedup at reference-time too.
 */

import type { SupportedMime } from "./mime.js";

export interface AssetRef {
  /** SHA-256 prefix — the content-address of the asset. */
  hash: string;
  /** VFS path of the asset bytes (e.g. `assets/8e3a7f9b1c0d2e4f.jpg`). */
  path: string;
  /** VFS path of the metadata sidecar (e.g. `assets/8e3a7f9b1c0d2e4f.metadata.json`). */
  metadataPath: string;
  /** Output content type. */
  mime: SupportedMime;
  /** Pixel dimensions of the stored asset (post-resize for raster, intrinsic for SVG when known). */
  width: number;
  height: number;
  /** Mandatory alt text. */
  alt: string;
}

/**
 * The shape of `<hash>.metadata.json` on disk. `dimensions` mirrors the
 * raster pixel dimensions after resize; for SVG without intrinsic
 * dimensions this can be `{ w: 0, h: 0 }`.
 */
export interface AssetMetadata {
  /** The user-supplied filename (e.g. `team-photo.jpg`). */
  originalName: string;
  /** The output content type. */
  mimeType: SupportedMime;
  dimensions: { w: number; h: number };
  /** Mandatory alt text. */
  alt: string;
}

/**
 * Inputs to `uploadAsset`. The pipeline accepts either a `File` or a
 * raw `Uint8Array` plus a name; this lets callers pass through the
 * editor's file-input value unchanged or run programmatic uploads
 * (tests, fixtures, drag-drop bridges).
 */
export type AssetUploadInput =
  | { kind: "file"; file: File; alt: string }
  | { kind: "bytes"; bytes: Uint8Array; name: string; declaredMime?: string; alt: string };
