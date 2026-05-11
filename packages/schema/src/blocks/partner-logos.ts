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
  /**
   * The partners array MAY be empty.
   *
   * Earlier the array carried `.min(1)` to reject "meaningless" empty
   * grids. The form-overrides plan (T19, 2026-05-11) loosens this so a
   * freshly-added `partnerLogos` block can ship with `partners: []`
   * instead of a fabricated placeholder logo carrying
   * `hash: "placeholder"` — ADR 0044 Corollary 2 prohibits fake pipeline
   * metadata in snapshots. The editor's AssetPicker (T10) and the
   * BlockForm's array editor own the empty-state UX, so the user adds
   * partners one at a time through the picker without ever seeing a
   * synthetic AssetRef.
   *
   * The renderer iterates `partners` via `.map()` and renders an empty
   * `<ul>` for the empty case (no crash). A future validate-rules pass
   * may surface a `warning` for empty grids; that is out of scope here.
   */
  partners: z.array(PartnerSchema),
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
