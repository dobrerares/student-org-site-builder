import { z } from "zod";
import {
  RICH_TEXT_ALIGNMENTS,
  RichTextDocumentSchema,
  type RichTextAlignment,
} from "../rich-text-doc.js";

export { RICH_TEXT_ALIGNMENTS };
export type { RichTextAlignment };

const RichTextAlignmentSchema = z.enum(RICH_TEXT_ALIGNMENTS);

/**
 * RichText block — prose section carrying a structured Rich-text document.
 *
 * Version 2 (ADR 0048, issue #100) replaces version 1's `markdown` string
 * with `doc`, a versioned structured document. The rationale is in the ADR:
 * headings, lists, quotes and inline marks were already expressible in
 * Markdown, but images by asset reference and internal links by target
 * identity are not, and a lossy Markdown round trip cannot carry them.
 *
 * Legacy `{ markdown }` blocks convert automatically on load — see the
 * `richText` entry in `BLOCK_MIGRATIONS` (`migrate.ts`). The conversion is
 * meaning-preserving: `@sosb/markdown`'s converter and the Renderer's
 * document serialiser together reproduce the byte-exact HTML the Markdown
 * renderer produced, which is asserted by the migration golden tests.
 *
 * `titleAlign` / `paragraphAlign` survive unchanged. They are Block-level
 * presentation defaults consumed by Themes as data attributes; per-node
 * `align` in the document overrides them for individual paragraphs.
 *
 * ADR 0034 still governs the Markdown fields of *other* Blocks (FAQ answers,
 * quote text). This migration is scoped to the Rich-text Block only.
 */
export const RichTextDataSchema = z.looseObject({
  doc: RichTextDocumentSchema,
  titleAlign: RichTextAlignmentSchema.optional(),
  paragraphAlign: RichTextAlignmentSchema.optional(),
});

export const RichTextBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("richText"),
  version: z.literal(2),
  data: RichTextDataSchema,
});

export const RICH_TEXT_BLOCK_VERSION = 2 as const;

export type RichTextBlock = z.infer<typeof RichTextBlockSchema>;
export type RichTextData = z.infer<typeof RichTextDataSchema>;
