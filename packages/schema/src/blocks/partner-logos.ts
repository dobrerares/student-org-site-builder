import { z } from "zod";

/**
 * partnerLogos block — sponsor / partner credit grid.
 *
 * Tracks issue #17. Per the PRD ("an org officer with sponsors or partners,
 * I want a partner-logos block with optional links, so that I can credit our
 * supporters"), v1 ships a flat list with an optional title and optional URL
 * per partner.
 *
 * Each partner carries:
 *  - `name` (mandatory) — also serves as the source of truth for accessible
 *    naming (alt text on the image, aria-label on the wrapping anchor when a
 *    URL is set).
 *  - `logo` (mandatory `AssetRef`) — content-addressed pointer into the VFS
 *    plus the metadata needed to render the image accessibly. The shape
 *    mirrors `@sosb/assets`'s `AssetRef` interface; `@sosb/schema` cannot
 *    take a runtime dependency on the assets package (the schema runs in
 *    every consumer, including ones that never touch the upload pipeline)
 *    so we redeclare the shape here as a Zod schema.
 *  - `url` (optional) — when present the renderer wraps the logo in an
 *    anchor element with the partner name as `aria-label`.
 *
 * Tier groupings (gold / silver / bronze) and marquee/carousel layouts are
 * out of scope for v1 per the issue triage. Unknown fields on a partner
 * survive a round-trip (see `preserve-unknown-keys` test) so future tiers
 * can be added additively without a schema bump.
 */

/**
 * The four MIME types the asset pipeline emits, mirroring
 * `@sosb/assets`'s `SupportedMime`. Keeping the literal list in sync is a
 * v1-acceptable cost (zero churn risk: the set is pinned by ADR 0004).
 */
const AssetMimeSchema = z.enum(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);

/**
 * Schema mirror of `@sosb/assets`'s `AssetRef` interface. SVG entries may
 * legitimately have `width` / `height` of 0 because SVGs without intrinsic
 * dimensions report `{ w: 0, h: 0 }` from the upload pipeline.
 */
export const AssetRefSchema = z.looseObject({
  hash: z.string().min(1),
  path: z.string().min(1),
  metadataPath: z.string().min(1),
  mime: AssetMimeSchema,
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  alt: z.string().min(1),
});

const PartnerSchema = z.looseObject({
  name: z.string().min(1),
  url: z.string().min(1).optional(),
  logo: AssetRefSchema,
});

export const PartnerLogosDataSchema = z.looseObject({
  title: z.string().optional(),
  partners: z.array(PartnerSchema).min(1),
});

export const PartnerLogosBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("partnerLogos"),
  version: z.literal(1),
  data: PartnerLogosDataSchema,
});

export const PARTNER_LOGOS_BLOCK_VERSION = 1 as const;

export type AssetRefValue = z.infer<typeof AssetRefSchema>;
export type Partner = z.infer<typeof PartnerSchema>;
export type PartnerLogosBlock = z.infer<typeof PartnerLogosBlockSchema>;
export type PartnerLogosData = z.infer<typeof PartnerLogosDataSchema>;
