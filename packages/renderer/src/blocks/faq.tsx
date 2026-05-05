/** @jsxImportSource preact */
import type { FaqBlock, FaqItem } from "@sosb/schema";
import { markdownToHtml } from "@sosb/markdown";

/**
 * FAQ block — list of question/answer pairs rendered as an accordion.
 *
 * The accordion uses the native `<details>`/`<summary>` HTML elements rather
 * than a custom ARIA-tabs widget. This is a deliberate choice (see ADR
 * 0007):
 *
 *  - Native semantics: screen readers announce expand/collapse state out of
 *    the box; keyboard support (Enter/Space toggles, Tab navigates) is
 *    built in.
 *  - No ARIA roles needed for the basic accordion behaviour. axe-core is
 *    happy with the structural markup as-is.
 *  - Works with JS disabled. The optional vanilla-JS enhancement (#18 AC:
 *    "Accordion JS under 2kb minified") only adds smooth open/close
 *    transitions — the block's *functionality* is JS-free.
 *
 * Markdown semantics:
 *
 *  - The `question` text is rendered as plain text inside `<summary>`. We do
 *    not run it through `markdownToHtml` because the question is short prose
 *    and inline markdown inside `<summary>` interacts badly with native
 *    accordion focus rings. Static-HTML escaping is sufficient.
 *  - The `answer` is rendered through `@sosb/markdown` (issue #9) so authors
 *    can use bold, italic, links, lists, and the rest of the whitelist
 *    subset. The output is XSS-safe by construction.
 *
 * Forward-compat: data is consumed tolerantly. Unknown extra fields on
 * `data` and on each item are ignored without throwing — the schema's
 * preserve-unknown-keys carries them through to round-trip persistence; the
 * renderer simply doesn't surface them. Empty `items` lists render an empty
 * accordion container (placeholder block).
 *
 * SECURITY NOTE: the markdown rendered for answers is XSS-safe by
 * construction, mirroring the richText block's contract. `markdownToHtml`
 * returns HTML built from a typed AST — raw HTML in the input is escaped,
 * dangerous URL schemes are dropped, and only the whitelisted set of
 * elements (p, strong, em, code, a, ul, ol, li, h2, h3, h4, blockquote)
 * ever appears in the output. The component sets the answer container's
 * inner HTML from that already-safe string, NOT from user-controlled
 * markup. The XSS corpus in `@sosb/markdown` exercises this contract; the
 * renderer's `faq-block.test.ts` re-asserts it at the page level. The
 * question text is plain JSX text content, which Preact escapes
 * automatically — no inner-HTML injection for the summary.
 */

function FaqItemRow(props: {
  item: FaqItem;
  open: boolean;
  index: number;
  blockId: string;
}): preact.JSX.Element {
  const { item, open, index, blockId } = props;
  const itemId = `${blockId}__item-${index}`;
  const answerHtml = markdownToHtml(typeof item.answer === "string" ? item.answer : "");

  // Boolean attribute handling: Preact emits `open` only when the value is
  // truthy. Passing `false` removes the attribute, which is the standard
  // closed state for `<details>`.
  const detailsProps = open
    ? ({ open: true } as const)
    : ({} as Record<string, never>);

  return (
    <details class="faq__item" id={itemId} {...detailsProps}>
      <summary class="faq__question">{item.question}</summary>
      <div class="faq__answer" dangerouslySetInnerHTML={{ __html: answerHtml }} />
    </details>
  );
}

export function Faq(props: { block: FaqBlock }): preact.JSX.Element {
  const { id, data } = props.block;
  const title = typeof data.title === "string" && data.title.length > 0 ? data.title : undefined;
  const firstOpen = data.firstOpen === true;
  const items: FaqItem[] = Array.isArray(data.items) ? data.items : [];

  return (
    <section
      data-block="faq"
      data-block-id={id}
      aria-labelledby={title !== undefined ? `${id}__title` : undefined}
    >
      <div class="faq__inner">
        {title !== undefined && (
          <h2 id={`${id}__title`} class="faq__title">
            {title}
          </h2>
        )}
        <div class="faq__list">
          {items.map((item, idx) => (
            <FaqItemRow
              key={`${id}__item-${idx}`}
              item={item}
              index={idx}
              blockId={id}
              open={firstOpen && idx === 0}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
