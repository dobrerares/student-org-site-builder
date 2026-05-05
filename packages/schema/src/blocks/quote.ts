import { z } from "zod";

/**
 * Quote block — pull-quote with attribution.
 *
 * Per the PRD (User Stories #28, Implementation Decisions → Block library),
 * the quote block carries a quote text and optional author / role / image.
 * The PRD pins the quote text to the markdown subset (italic emphasis is the
 * common case for pull-quotes); the inline whitelist from `@sosb/markdown`
 * (bold, italic, inline code, links) is what the renderer applies. Block-
 * level markdown constructs (headings, lists, blockquotes inside a quote)
 * are not part of this block — the renderer treats the `text` as a single
 * paragraph of inline markdown.
 *
 * The schema is declared with `looseObject` so unknown fields survive a
 * round-trip read-write-read (the v1 forward-compatibility contract).
 *
 * `text` is required and non-empty. Unlike richText where empty markdown is
 * an allowed placeholder, a pull-quote with no quote text is structurally
 * meaningless (there is nothing to attribute to), so the schema rejects an
 * empty string outright.
 *
 * `authorImage` is the asset reference that the asset pipeline (#6) will
 * resolve to a hash-named file. `authorImageAlt` carries the alt text for
 * screen readers; missing alt when `authorImage` is set is a
 * quality-warning, not a hard error (mirrors the hero `backgroundAlt`
 * nudge).
 */
export const QuoteDataSchema = z.looseObject({
  text: z.string().min(1),
  author: z.string().optional(),
  authorRole: z.string().optional(),
  authorImage: z.string().optional(),
  authorImageAlt: z.string().optional(),
});

export const QuoteBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("quote"),
  version: z.literal(1),
  data: QuoteDataSchema,
});

export const QUOTE_BLOCK_VERSION = 1 as const;

export type QuoteBlock = z.infer<typeof QuoteBlockSchema>;
export type QuoteData = z.infer<typeof QuoteDataSchema>;
