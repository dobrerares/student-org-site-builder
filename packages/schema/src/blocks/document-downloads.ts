import { z } from "zod";

/**
 * documentDownloads block — a list of downloadable documents (PDFs,
 * Office documents, ZIPs, plain text) with labels and optional
 * descriptions.
 *
 * Per the PRD (issue #21), the block extends the asset pipeline to
 * non-image files. The schema carries `AssetRef`-shaped pointers
 * (hash, path, metadataPath, mime, byteSize) so the renderer can
 * surface accessible download links with the right file type and size
 * indicators without consulting the VFS at render time.
 *
 * Layout: `list` (vertical anchor list, default) or `cards` (grid of
 * cards). Theme styling lives in the theme CSS; both layouts use the
 * same structural HTML with a layout-marker class.
 *
 * Forward-compat: `looseObject` everywhere on the persistence boundary
 * keeps unknown fields (e.g. a future `icon` field on files) on
 * round-trip read-write-read.
 */

/**
 * Reference to a document asset stored in the VFS. Matches the
 * `DocumentRef` shape produced by `@sosb/assets/uploadDocument`.
 *
 * NB: schema cannot import `@sosb/assets` (would induce a workspace
 * cycle), so the shape is mirrored here with the same field set. The
 * fields stay in sync with `packages/assets/src/document-types.ts`.
 */
export const DocumentAssetRefSchema = z.looseObject({
  hash: z.string().min(1),
  path: z.string().min(1),
  metadataPath: z.string().min(1),
  mime: z.string().min(1),
  byteSize: z.number().int().positive(),
  originalName: z.string().optional(),
});

export const DocumentDownloadFileSchema = z.looseObject({
  asset: DocumentAssetRefSchema,
  label: z.string().min(1),
  description: z.string().optional(),
});

const DocumentDownloadsLayoutSchema = z.enum(["list", "cards"]);

export const DocumentDownloadsDataSchema = z.looseObject({
  title: z.string().optional(),
  intro: z.string().optional(),
  layout: DocumentDownloadsLayoutSchema.optional(),
  /**
   * The files array MAY be empty.
   *
   * Earlier the array carried `.min(1)` to reject blocks with no files.
   * The form-overrides plan (T19, 2026-05-11) loosens this so a
   * freshly-added `documentDownloads` block can ship with `files: []`
   * instead of a fabricated placeholder document carrying
   * `hash: "placeholder"` — ADR 0044 Corollary 2 prohibits fake pipeline
   * metadata in snapshots. The editor's DocumentPicker (T18) and the
   * BlockForm's array editor own the empty-state UX, so the user adds
   * files one at a time through the picker without ever seeing a
   * synthetic DocumentAssetRef.
   *
   * The renderer iterates `files` via `.map()` and renders an empty
   * `<ul>` for the empty case (no crash). A future validate-rules pass
   * may surface a `warning` for empty downloads blocks; that is out of
   * scope here.
   */
  files: z.array(DocumentDownloadFileSchema),
});

export const DocumentDownloadsBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("documentDownloads"),
  version: z.literal(1),
  data: DocumentDownloadsDataSchema,
});

export const DOCUMENT_DOWNLOADS_BLOCK_VERSION = 1 as const;

export type DocumentAssetRef = z.infer<typeof DocumentAssetRefSchema>;
export type DocumentDownloadFile = z.infer<typeof DocumentDownloadFileSchema>;
export type DocumentDownloadsData = z.infer<typeof DocumentDownloadsDataSchema>;
export type DocumentDownloadsBlock = z.infer<typeof DocumentDownloadsBlockSchema>;
