/**
 * FieldHint — advisory helper text rendered beneath a form field.
 *
 * Soft guidance only (Guardrail 1): a length nudge or phrasing tip that
 * helps authors aim for good content, NOT validation. Nothing here
 * counts characters, blocks input, or truncates — the engine already
 * keeps over-length copy from breaking layout (measure caps, wrapping,
 * fluid type). The hint text comes from a field's `field-metadata`
 * entry (`FieldOverride.hint`), threaded through the form-generator's
 * `FieldNode.hint`.
 *
 * Renders nothing when there is no hint, so callers can drop it into
 * every field's markup unconditionally.
 */
import type { JSX } from "preact";

export interface FieldHintProps {
  /** Advisory text; when `undefined`, nothing renders. */
  readonly hint: string | undefined;
}

export function FieldHint(props: FieldHintProps): JSX.Element | null {
  if (props.hint === undefined) return null;
  return (
    <p class="field-hint" data-testid="field-hint">
      {props.hint}
    </p>
  );
}
