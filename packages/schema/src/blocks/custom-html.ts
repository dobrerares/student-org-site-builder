import { z } from "zod";

/**
 * customHTML block — the power-user escape hatch.
 *
 * Per the PRD (User Story 35-36, Implementation Decisions → Block library),
 * this is the lone escape-hatch block that lets a power user paste raw HTML
 * for a niche embed need that the curated block set does not cover.
 *
 * The block is security-sensitive. The schema models the security toggle:
 *
 * - `sanitize: true` (the default) — the renderer runs the input through
 *   DOMPurify with a strict policy. Scripts, event handlers, and other
 *   active content are stripped before rendering.
 * - `sanitize: false` — the user has explicitly opted into "danger mode".
 *   The editor surfaces a persistent warning UI; the renderer emits the
 *   raw HTML byte-equal so a power user can intentionally embed a
 *   trusted custom widget.
 *
 * Schema-level validation only enforces shape (boolean, string). The
 * sanitize-off → warning record is layered in `validate.ts` so the Site
 * Health panel and validation report pick it up alongside the editor's
 * inline warning.
 */
export const CustomHtmlDataSchema = z.looseObject({
  html: z.string(),
  sanitize: z.boolean(),
});

export const CustomHtmlBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("customHTML"),
  version: z.literal(1),
  data: CustomHtmlDataSchema,
});

export const CUSTOM_HTML_BLOCK_VERSION = 1 as const;

export type CustomHtmlBlock = z.infer<typeof CustomHtmlBlockSchema>;
export type CustomHtmlData = z.infer<typeof CustomHtmlDataSchema>;
