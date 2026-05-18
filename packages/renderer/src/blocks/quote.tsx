/** @jsxImportSource preact */
import type { QuoteBlock } from "@sosb/schema";
import { markdownInlineToHtml } from "@sosb/markdown";
import { assetRefAlt, assetRefPath } from "../asset-ref-path.js";

/**
 * Quote block — pull-quote with attribution.
 *
 * Semantic shape:
 *   <figure data-block="quote">
 *     <blockquote class="quote__text"><p>{markdown-emphasised text}</p></blockquote>
 *     <figcaption class="quote__attribution">                ← only when author/role/image present
 *       <img class="quote__photo" .../>                       ← only when authorImage set
 *       <cite class="quote__author">{author}</cite>           ← only when author set
 *       <span class="quote__role">{authorRole}</span>         ← only when authorRole set
 *     </figcaption>
 *   </figure>
 *
 * Notes:
 *  - The `<figure>` + `<blockquote>` + `<figcaption>` + `<cite>` shape is the
 *    accessibility-recommended structure for an attributed pull-quote (per
 *    the HTML Living Standard's blockquote/cite guidance and ARIA APG). It
 *    keeps the citation programmatically associated with the quote without
 *    needing extra ARIA.
 *  - `data-block="quote"` is set on the <figure> root (one root per block,
 *    per the renderer's pattern). Theme CSS targets it via
 *    `[data-block="quote"]`.
 *  - Quote text passes through `markdownInlineToHtml` from `@sosb/markdown`
 *    — the same XSS-safe-by-construction pipeline used by richText, but at
 *    the inline level only (italic/bold/inline code/links). Block-level
 *    markdown (headings, lists, nested blockquotes) is not part of this
 *    block — pull-quote text is conventionally a single paragraph of
 *    inline-emphasised prose. ADR 0008 records why.
 *  - Empty `text` is rejected at the schema layer (`z.string().min(1)`); the
 *    renderer trusts that gate. If a malformed block somehow arrives here,
 *    the inline pipeline produces an empty string and the markup degrades
 *    gracefully to an empty <p>.
 *  - Forward-compat: unknown extra fields on `data` are silently ignored.
 *
 * SECURITY NOTE: the only `dangerouslySetInnerHTML` use here is on the
 * inline-rendered HTML for the quote text. That HTML is built by
 * `markdownInlineToHtml` from a typed walker — every literal `<`, `>`, `&`
 * in the input passes through `escapeText`, dangerous URL schemes are
 * dropped, and only the inline whitelist (em, strong, code, a) ever
 * appears. Author / role / image-alt are passed through Preact's normal
 * text/attribute interpolation, which escapes them. Author image URL is
 * the asset reference resolved by the asset pipeline (#6); it is not
 * user-arbitrary HTML.
 */
export function Quote(props: { block: QuoteBlock }): preact.JSX.Element {
  const { id, data } = props.block;
  const text = typeof data.text === "string" ? data.text : "";
  const author =
    typeof data.author === "string" && data.author.length > 0 ? data.author : undefined;
  const authorRole =
    typeof data.authorRole === "string" && data.authorRole.length > 0 ? data.authorRole : undefined;
  const authorImage = assetRefPath(data.authorImage);
  const authorImageAlt =
    typeof data.authorImageAlt === "string" && data.authorImageAlt.length > 0
      ? data.authorImageAlt
      : assetRefAlt(data.authorImage);

  const inlineHtml = markdownInlineToHtml(text);
  const hasAttribution =
    author !== undefined || authorRole !== undefined || authorImage !== undefined;

  return (
    <figure data-block="quote" data-block-id={id}>
      <blockquote class="quote__text">
        <p dangerouslySetInnerHTML={{ __html: inlineHtml }} />
      </blockquote>
      {hasAttribution && (
        <figcaption class="quote__attribution">
          {authorImage !== undefined && (
            <img class="quote__photo" src={authorImage} alt={authorImageAlt} loading="lazy" />
          )}
          {author !== undefined && <cite class="quote__author">{author}</cite>}
          {authorRole !== undefined && <span class="quote__role">{authorRole}</span>}
        </figcaption>
      )}
    </figure>
  );
}
