import { z } from "zod";
import { AssetRefSchema } from "./asset-ref.js";

export { AssetRefSchema };

/**
 * imageGallery block — semantic image grid with optional vanilla-JS lightbox.
 *
 * Per the PRD (user story #27, blocks list, accessibility commitments) and
 * issue #14:
 *
 *  - Optional title (header for the gallery; the renderer wires
 *    `aria-labelledby` to it when present).
 *  - `layout: "grid" | "masonry"` controls how the renderer's CSS lays the
 *    images out. Theme CSS reads the `data-layout` attribute and the
 *    `--gallery-columns` custom property the renderer emits.
 *  - `columns: 1..6` is a sensible bound — narrower than 1 makes no sense,
 *    wider than 6 does not survive the PRD's mobile-first breakpoints.
 *  - `lightbox: boolean` toggles the click-to-enlarge UI. When false, the
 *    renderer ships no lightbox JS and no dialog scaffold.
 *  - `images: { asset, caption?, alt }[]`. Alt text is mandatory at the
 *    block level — the asset pipeline (#8) enforces alt at upload time, but
 *    the block reasserts because a) alt can describe a different aspect of
 *    the same image when it is reused in different contexts, and b) the
 *    block can be hand-edited in the JSON (no upload step) and we want a
 *    schema-level guarantee.
 *
 * Both the envelope and the data schema are `looseObject`-style, so unknown
 * future fields (e.g. `focusPoint`, `spacing`) survive a round-trip. This is
 * the v1 forward-compatibility contract shared with the hero block (#3).
 */

/**
 * The image-gallery block embeds `AssetRefSchema` from `./asset-ref.ts`.
 * That declaration is the canonical AssetRef shape; the editor's
 * schema-identity dispatch (ADR 0043) relies on every image-bearing block
 * importing the SAME ZodType reference — never redeclaring locally.
 */
export const GalleryImageSchema = z.looseObject({
  asset: AssetRefSchema,
  caption: z.string().optional(),
  /** Mandatory, non-empty after trim — the AC for #14. */
  alt: z
    .string()
    .min(1)
    .refine((s) => s.trim().length > 0, "alt must be non-empty"),
});

export const ImageGalleryDataSchema = z.looseObject({
  title: z.string().optional(),
  layout: z.enum(["grid", "masonry"]),
  /** 1..6 inclusive — see file-level rationale. */
  columns: z.number().int().min(1).max(6),
  lightbox: z.boolean(),
  images: z.array(GalleryImageSchema),
});

export const ImageGalleryBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("imageGallery"),
  version: z.literal(1),
  data: ImageGalleryDataSchema,
});

export const IMAGE_GALLERY_BLOCK_VERSION = 1 as const;

export type ImageGalleryBlock = z.infer<typeof ImageGalleryBlockSchema>;
export type ImageGalleryData = z.infer<typeof ImageGalleryDataSchema>;
export type GalleryImage = z.infer<typeof GalleryImageSchema>;
export type AssetRefLike = z.infer<typeof AssetRefSchema>;
