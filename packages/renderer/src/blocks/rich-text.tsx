/** @jsxImportSource preact */
import type { RichTextBlock, RichTextDocument } from "@sosb/schema";
import { isEmptyRichTextDocument } from "@sosb/schema";
import type preact from "preact";
import { renderRichTextDocToHtml, type RichTextRenderContext } from "../rich-text-html.js";

/**
 * RichText block — structured prose (ADR 0048).
 *
 * The document is serialised to a string by `renderRichTextDocToHtml` and
 * handed to `dangerouslySetInnerHTML`, as the Markdown version always did.
 * The string is built tag by tag with every text and attribute escaped, so
 * "dangerously" names the API, not the risk.
 */
export function RichText(props: {
  block: RichTextBlock;
  variant?: string | undefined;
  context?: RichTextRenderContext | undefined;
}): preact.JSX.Element | null {
  const { id, data } = props.block;
  const doc = data.doc as RichTextDocument | undefined;

  // Empty-state suppression: a richText with no meaningful content renders
  // nothing rather than an empty styled container. Unchanged behaviour from
  // the Markdown version, where whitespace-only source counted as empty.
  if (isEmptyRichTextDocument(doc)) return null;

  const html = renderRichTextDocToHtml(doc, props.context ?? {});
  if (html === "") return null;

  const titleAlign = readAlignment(data.titleAlign);
  const paragraphAlign = readAlignment(data.paragraphAlign);

  return (
    <section
      data-block="richText"
      data-variant={props.variant}
      data-block-id={id}
      data-title-align={titleAlign}
      data-paragraph-align={paragraphAlign}
    >
      <div class="rich-text" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}

function readAlignment(value: unknown): "left" | "center" | "right" | "justify" | undefined {
  return value === "left" || value === "center" || value === "right" || value === "justify"
    ? value
    : undefined;
}
