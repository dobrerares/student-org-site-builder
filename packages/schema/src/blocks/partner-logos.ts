import { z } from "zod";
import { AssetRefSchema } from "./asset-ref.js";

export { AssetRefSchema };

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
 *    mirrors `@sosb/assets`'s `AssetRef` interface; the canonical Zod
 *    declaration lives in `./asset-ref.ts` so the editor's schema-identity
 *    dispatch (ADR 0043) sees the same `ZodType` reference here and in
 *    every other image-bearing block schema.
 *  - `url` (optional) — when present the renderer wraps the logo in an
 *    anchor element with the partner name as `aria-label`.
 *
 * Tier groupings (gold / silver / bronze) and marquee/carousel layouts are
 * out of scope for v1 per the issue triage. Unknown fields on a partner
 * survive a round-trip (see `preserve-unknown-keys` test) so future tiers
 * can be added additively without a schema bump.
 */

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
