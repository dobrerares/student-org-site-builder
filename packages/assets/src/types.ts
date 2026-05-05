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
  /**
   * Responsive variant descriptors. Populated by the Electron-side
   * pipeline (`uploadAssetWithVariants`) and absent from browser-side
   * single-output uploads. Sorted ascending by `width`.
   */
  variants?: readonly AssetVariantDescriptor[];
}

/**
 * One responsive-variant entry. Each variant is a separate file in the
 * VFS and a separate `srcset` candidate at render time.
 */
export interface AssetVariantDescriptor {
  /** Pixel width of the variant image. */
  readonly width: number;
  /** Pixel height of the variant image. */
  readonly height: number;
  /** Output content type. */
  readonly mime: SupportedMime;
  /** VFS path of the variant bytes (e.g. `assets/8e3a7f9b1c0d2e4f.800.webp`). */
  readonly path: string;
  /** Encoded byte size — useful for editor "preview budget" surfaces. */
  readonly bytes: number;
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
  /**
   * Responsive variant entries on disk. Populated by the Electron-side
   * pipeline; absent for browser-side single-output uploads (#8) and
   * for SVG (vectors don't need rasterised variants). Sorted ascending
   * by `width` to match the `<img srcset>` candidate order.
   */
  variants?: readonly AssetVariantDescriptor[];
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
