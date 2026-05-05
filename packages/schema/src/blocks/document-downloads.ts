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
  files: z.array(DocumentDownloadFileSchema).min(1),
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
