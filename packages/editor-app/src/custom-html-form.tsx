/**
 * customHTML block form — power-user escape-hatch editor.
 *
 * Per the PRD (User Stories 35-36) and ADR 0006, the customHTML block is the
 * lone block where the user pastes raw HTML. The editor's responsibility for
 * this block is two-fold:
 *
 *  1. Surface the raw HTML in a textarea, the toggle for sanitization, and
 *     copy explaining the trade-offs.
 *  2. When the user has explicitly disabled sanitization, surface a
 *     persistent danger warning so the danger of the choice does not vanish
 *     after the click. The warning carries `role="alert"` so screen readers
 *     announce it on each render.
 *
 * The form is rendered separately from the spine-form auto-generator (block
 * forms are explicitly carved out by ADR 0005 — `blocks` is filtered out of
 * the schema walk). Future block forms (#9-#22) follow the same component
 * pattern that this file establishes.
 *
 * The advanced/danger badge in the block-list label (the
 * `[data-testid="custom-html-advanced-marker"]` element) satisfies the
 * "block-list entry visibly marked as advanced/danger" AC. The full
 * block-list UI is still part of the future block-list issue; the marker
 * markup lives here so it travels with the form component.
 */
import type { JSX } from "preact";
import type { CustomHtmlBlock } from "@sosb/schema";

export interface CustomHtmlBlockFormProps {
  readonly block: CustomHtmlBlock;
  readonly onChange: (block: CustomHtmlBlock) => void;
}

export function CustomHtmlBlockForm(props: CustomHtmlBlockFormProps): JSX.Element {
  const { block, onChange } = props;
  const sanitize = block.data.sanitize !== false;
  const html = typeof block.data.html === "string" ? block.data.html : "";

  function patch(next: Partial<CustomHtmlBlock["data"]>): void {
    onChange({
      ...block,
      data: {
        ...block.data,
        ...next,
      },
    } as CustomHtmlBlock);
  }

  return (
    <fieldset data-block-form="customHTML">
      <legend>
        Custom HTML
        <span data-testid="custom-html-advanced-marker" data-tone="danger">
          Advanced
        </span>
      </legend>

      <p data-testid="custom-html-explainer">
        Paste raw HTML to embed content the curated blocks do not cover. Sanitization is on by
        default and strips scripts, event handlers, iframes, and other active content so the
        rendered output stays safe. Turn sanitization off only when you trust the source of the HTML
        — disabling sanitization renders the raw markup verbatim and exposes visitors to whatever
        the markup does.
      </p>

      <label data-field-label="data.html">
        <span>HTML</span>
        <textarea
          data-field="data.html"
          rows={8}
          value={html}
          onInput={(event: JSX.TargetedEvent<HTMLTextAreaElement>) => {
            patch({ html: event.currentTarget.value });
          }}
        />
      </label>

      <label data-field-label="data.sanitize">
        <input
          type="checkbox"
          data-field="data.sanitize"
          checked={sanitize}
          onChange={(event: JSX.TargetedEvent<HTMLInputElement>) => {
            patch({ sanitize: event.currentTarget.checked });
          }}
        />
        <span>Sanitize HTML (recommended)</span>
      </label>

      {!sanitize ? (
        <p data-testid="custom-html-danger" data-tone="danger" role="alert">
          Warning: sanitization is OFF. The raw HTML you provide will be rendered as-is on the
          published site. Scripts, iframes, and event handlers will execute. Enable sanitization
          unless you fully trust the HTML source.
        </p>
      ) : null}
    </fieldset>
  );
}
