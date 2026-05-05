import { z } from "zod";

/**
 * RichText block — markdown-prose section with the strict whitelist subset.
 *
 * Per the PRD (Implementation Decisions → Block library), markdown rendering
 * uses a strict whitelist: bold, italic, links, lists, headings (h2-h4),
 * inline code, blockquotes. No raw HTML in markdown. XSS-safe by
 * construction. The actual parsing + sanitisation lives in
 * `@sosb/markdown`; this schema only carries the source string.
 *
 * The schema is declared with `looseObject` so unknown fields survive a
 * round-trip read-write-read (the v1 forward-compatibility contract). The
 * `markdown` field is a string — empty is allowed at the schema layer
 * (placeholder content); future work can add a quality-nudge warning if a
 * richText block is empty when the page is exported.
 */
export const RichTextDataSchema = z.looseObject({
  markdown: z.string(),
});

export const RichTextBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("richText"),
  version: z.literal(1),
  data: RichTextDataSchema,
});

export const RICH_TEXT_BLOCK_VERSION = 1 as const;

export type RichTextBlock = z.infer<typeof RichTextBlockSchema>;
export type RichTextData = z.infer<typeof RichTextDataSchema>;
