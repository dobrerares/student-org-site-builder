import { z } from "zod";

/**
 * FAQ block — list of question/answer pairs rendered as an accordion.
 *
 * Per the PRD (user story #31, Implementation Decisions → Block library), an
 * FAQ block lets a student org surface common questions ("Cum mă pot
 * înscrie?", "Care sunt costurile?") with collapsible answers. The answer
 * field carries markdown using the strict whitelist subset from `@sosb/markdown`
 * (#9), so authors can include bold, italic, links, and lists in their
 * replies without writing HTML.
 *
 * Field semantics:
 *
 *  - `title` — optional section heading (e.g. "Întrebări frecvente"). When
 *    set, the renderer emits an `<h2>` above the accordion.
 *  - `items` — ordered list of `{ question, answer }`. Empty list is allowed
 *    at the schema layer (placeholder block); a quality-nudge warning lives
 *    in `validate()`.
 *  - `firstOpen` — when `true`, the first item is rendered with the `open`
 *    attribute on `<details>` so the page lands with the first answer
 *    visible. Defaults to `false` (all-closed) when omitted.
 *
 * Each item's `question` is required (non-empty); the `answer` is a string
 * that may be empty (placeholder) but the renderer treats it as markdown.
 *
 * The schema uses `looseObject` so unknown fields survive a round-trip
 * read-write-read — the v1 forward-compatibility contract.
 */
export const FaqItemSchema = z.looseObject({
  question: z.string().min(1),
  answer: z.string(),
});

export const FaqDataSchema = z.looseObject({
  title: z.string().optional(),
  firstOpen: z.boolean().optional(),
  items: z.array(FaqItemSchema),
});

export const FaqBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("faq"),
  version: z.literal(1),
  data: FaqDataSchema,
});

export const FAQ_BLOCK_VERSION = 1 as const;

export type FaqItem = z.infer<typeof FaqItemSchema>;
export type FaqData = z.infer<typeof FaqDataSchema>;
export type FaqBlock = z.infer<typeof FaqBlockSchema>;
