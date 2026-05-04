import { z } from "zod";
import { HeroBlockSchema } from "./hero.js";

export { HeroBlockSchema, HeroDataSchema, HERO_BLOCK_VERSION } from "./hero.js";
export type { HeroBlock, HeroData } from "./hero.js";

/**
 * The block envelope is `{ id, type, version, data }`. This generic envelope
 * accepts any string `type` and any positive `version`, so unknown block
 * types from a future editor version still parse and round-trip without
 * losing data. Known types (e.g. hero) are validated against their specific
 * schemas inside `validateBlock`.
 */
export const BlockEnvelopeSchema = z.looseObject({
  id: z.string().min(1),
  type: z.string().min(1),
  version: z.number().int().positive(),
  data: z.looseObject({}),
});

export type BlockEnvelope = z.infer<typeof BlockEnvelopeSchema>;

/**
 * Registry of known block schemas keyed by `type`. Future block types land
 * in this registry without changing the envelope or call sites. Unknown
 * types are intentionally not in this map — they fall through to envelope
 * validation only.
 */
export const KnownBlockSchemas = {
  hero: HeroBlockSchema,
} as const;

export type KnownBlockType = keyof typeof KnownBlockSchemas;

export function isKnownBlockType(type: string): type is KnownBlockType {
  return Object.prototype.hasOwnProperty.call(KnownBlockSchemas, type);
}
