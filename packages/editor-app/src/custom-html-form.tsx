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
        Custom code embed
        <span data-testid="custom-html-advanced-marker" data-tone="danger">
          For experts
        </span>
      </legend>

      <p data-testid="custom-html-explainer">
        Paste trusted embed code when the ready-made sections do not cover what you need. The safety
        filter is on by default and removes code that can run in visitors' browsers. Turn it off only
        when someone technical has checked the code.
      </p>

      <label data-field-label="data.html">
        <span>Embed code</span>
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
        <span>Keep safety filter on (recommended)</span>
      </label>

      {!sanitize ? (
        <p data-testid="custom-html-danger" data-tone="danger" role="alert">
          Warning: the safety filter is off. Only download or publish after someone technical has
          checked this code.
        </p>
      ) : null}
    </fieldset>
  );
}
