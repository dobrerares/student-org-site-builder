/** @jsxImportSource preact */
import type { RichTextBlock } from "@sosb/schema";
import { markdownToHtml } from "@sosb/markdown";

/**
 * RichText block — markdown-prose section rendered structurally.
 *
 * The component owns the semantic and accessibility shape of the block
 * (a `<section>` with the `rich-text` content container) and delegates the
 * actual prose-to-HTML translation to `@sosb/markdown`. Theme-specific
 * styling lives in the theme's CSS.
 *
 * Forward-compat: data is consumed tolerantly. Unknown extra fields on
 * `data` are ignored without throwing — the schema's preserve-unknown-keys
 * carries them through to round-trip persistence; the renderer simply
 * doesn't surface them. Empty markdown is allowed (placeholder block) and
 * renders an empty container.
 *
 * SECURITY NOTE: the markdown rendered here is XSS-safe by construction.
 * `markdownToHtml` returns HTML built from a typed AST — raw HTML in the
 * input is escaped, dangerous URL schemes are dropped, and only the
 * whitelisted set of elements (p, strong, em, code, a, ul, ol, li, h2, h3,
 * h4, blockquote) ever appears in the output. The component sets the
 * container's innerHTML from that already-safe string, NOT from user-
 * controlled markup. The XSS corpus in `@sosb/markdown` exercises this
 * contract; the renderer's `richtext-block.test.ts` re-asserts it at the
 * page level.
 */
export function RichText(props: { block: RichTextBlock }): preact.JSX.Element {
  const { id, data } = props.block;
  const markdownSource = typeof data.markdown === "string" ? data.markdown : "";
  const html = markdownToHtml(markdownSource);

  return (
    <section data-block="richText" data-block-id={id}>
      <div class="rich-text" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}
