import { z } from "zod";

/**
 * Canonical `AssetRef` schema for image assets — the single Zod declaration
 * that every image-bearing block schema MUST import.
 *
 * Why this file exists
 * --------------------
 * The editor's form-generator (ADR 0043) dispatches custom renderers via a
 * schema-identity map keyed on Zod object references (`Map<ZodType, string>`).
 * Reference equality is the only mechanism that survives Zod's opaque
 * internals, so a single dispatch entry like
 *
 *     [[AssetRefSchema, "asset-picker"]]
 *
 * only fires when EVERY block-data schema embeds the EXACT SAME ZodObject
 * instance. Re-declaring the structurally-identical shape in another file
 * creates a reference-distinct ZodObject, the map miss silently falls through
 * to the default object walker, and the editor renders the AssetRef's
 * structural leaves (hash, path, metadataPath, mime, width, height, alt) as
 * a fieldset of plain text inputs — exactly the UX failure mode ADR 0044
 * prohibits.
 *
 * Therefore: every image-AssetRef-bearing block schema imports
 * `AssetRefSchema` from this file. Do NOT redeclare locally.
 *
 * Mirrors `@sosb/assets`'s runtime `AssetRef` interface
 * ----------------------------------------------------
 * `@sosb/schema` is the lowest-level workspace package and cannot import
 * `@sosb/assets` (that would invert the dependency direction and pull
 * browser/Canvas/sharp runtime deps into the schema package, which every
 * downstream consumer needs to be free of). The shape mirrors
 * `packages/assets/src/types.ts`'s `AssetRef`; the field set is pinned by
 * ADR 0004 and stays in sync as an explicit v1 contract.
 *
 * SVG entries may legitimately have `width` / `height` of 0 — the upload
 * pipeline reports `{ w: 0, h: 0 }` for SVGs without intrinsic dimensions —
 * so the dimension checks are `nonnegative()`, not `positive()`.
 *
 * `alt` is mandatory and non-empty at the schema layer. This matches the
 * upload pipeline's hard-error contract (`asset.alt.missing` is thrown when
 * alt is empty at upload time, see `packages/assets/src/variant-pipeline.ts`).
 *
 * Distinct (intentionally NOT consolidated) shapes
 * -----------------------------------------------
 *  - `CtaBannerAssetRefSchema` (`cta-banner.ts`): looser `mime` (z.string),
 *    looser `width`/`height` (no `int()`), looser `alt` (no min). The CTA
 *    banner block treats an empty alt as a warning-not-error so a stale
 *    import does not hard-fail; its rule-pass surfaces the issue.
 *  - `DocumentAssetRefSchema` (`document-downloads.ts`): a different concept
 *    entirely. Carries `byteSize` (not `width`/`height`/`alt`) because
 *    document assets are non-image files (PDFs, ZIPs, etc.).
 *  - `ActivityImageRefSchema` (`activities-list.ts`) and `PersonPhotoSchema`
 *    (`team-grid.ts`): differently-named, locally-tuned shapes (looser
 *    mime, divergent alt rules). Kept distinct because each block's
 *    validation surface tunes the alt strictness to that block's
 *    placeholder / stale-data tolerance.
 *
 * Future work (not addressed in this PR): `hero.backgroundImage` and
 * `quote.authorImage` are still typed as `z.string().optional()`
 * (path-only references with sibling `*Alt` text fields). Converting them
 * to AssetRef-shaped objects would carry the same upload-pipeline
 * benefits (dedup, dimensions, mime, alt-on-the-asset) as every other
 * image-bearing block, but the change requires a v1→v2 data migration
 * for existing sites and is intentionally out of scope for the
 * form-overrides-and-pickers feature branch. Tracked as a follow-up.
 */

const AssetMimeSchema = z.enum(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);

export const AssetRefSchema = z.looseObject({
  hash: z.string().min(1),
  path: z.string().min(1),
  metadataPath: z.string().min(1),
  mime: AssetMimeSchema,
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  alt: z.string().min(1),
});

/**
 * Inferred TypeScript type for the canonical AssetRef. Two named aliases
 * (`AssetRefValue` and `AssetRefLike`) are re-exported from this type for
 * historical reasons: partner-logos consumers refer to `AssetRefValue`,
 * image-gallery consumers refer to `AssetRefLike`. They are the same type;
 * the aliases are preserved so existing imports keep working.
 */
export type AssetRef = z.infer<typeof AssetRefSchema>;
