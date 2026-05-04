import { z } from "zod";

/**
 * Hero block — the mandatory page-opening block.
 *
 * Per the PRD, the hero contains a title and subtitle and may carry an
 * optional eyebrow and a background image with alt text. The schema is
 * declared with `looseObject` so unknown fields survive a round-trip
 * read-write-read; this is the v1 forward-compatibility contract.
 *
 * # Version history
 *
 * - **v1** (initial) — `{ eyebrow?, title, subtitle?, backgroundImage?, backgroundAlt? }`.
 * - **v2** (issue #26 migration exercise) — adds optional `align` field
 *   (`"left" | "center" | "right"`, default `"left"`). Old v1 blocks are
 *   bumped on load via the migration table in `migrate.ts`. The migration
 *   is purely additive: pre-existing fields are preserved unchanged and
 *   the new `align` field is filled in with `"left"` only when absent.
 */
export const HERO_ALIGN_VALUES = ["left", "center", "right"] as const;
export type HeroAlign = (typeof HERO_ALIGN_VALUES)[number];

export const HERO_ALIGN_DEFAULT: HeroAlign = "left";

export const HeroDataSchema = z.looseObject({
  eyebrow: z.string().optional(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  backgroundImage: z.string().optional(),
  backgroundAlt: z.string().optional(),
  align: z.enum(HERO_ALIGN_VALUES).optional(),
});

export const HERO_BLOCK_VERSION = 2 as const;

export const HeroBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("hero"),
  version: z.literal(HERO_BLOCK_VERSION),
  data: HeroDataSchema,
});

export type HeroBlock = z.infer<typeof HeroBlockSchema>;
export type HeroData = z.infer<typeof HeroDataSchema>;
