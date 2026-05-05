import { z } from "zod";

/**
 * Hero block — the mandatory page-opening block.
 *
 * Per the PRD, the hero contains a title and subtitle and may carry an
 * optional eyebrow and a background image with alt text. The schema is
 * declared with `looseObject` so unknown fields survive a round-trip
 * read-write-read; this is the v1 forward-compatibility contract.
 */
export const HeroDataSchema = z.looseObject({
  eyebrow: z.string().optional(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  backgroundImage: z.string().optional(),
  backgroundAlt: z.string().optional(),
});

export const HeroBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("hero"),
  version: z.literal(1),
  data: HeroDataSchema,
});

export const HERO_BLOCK_VERSION = 1 as const;

export type HeroBlock = z.infer<typeof HeroBlockSchema>;
export type HeroData = z.infer<typeof HeroDataSchema>;
