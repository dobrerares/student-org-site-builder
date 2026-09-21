/** @jsxImportSource react */
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
 * It is a thin wrapper over `@sosb/ui`'s `<Hint>`, and it earns its keep by
 * being the single place that knows three editor-specific facts:
 *
 *  - **Absent means absent.** `undefined` renders nothing, so every caller
 *    can drop it into its markup unconditionally instead of repeating a
 *    ternary.
 *  - **The `field-hint` class.** `editor-app-css.ts` targets it, and that
 *    stylesheet is unlayered, so it outranks the shared package's layered
 *    defaults. Losing the class would silently restyle every hint.
 *  - **The `field-hint` test id.** The hint assertions across the form
 *    tests key off it.
 *
 * Every hint in the editor goes through here — including the ADR 0043
 * override widgets (colour, font and named-value pickers), which used to
 * hand-roll the same paragraph and drift from it.
 */
import type { JSX } from "react";
import { Hint } from "@sosb/ui";

export interface FieldHintProps {
  /** Advisory text; when `undefined`, nothing renders. */
  readonly hint: string | undefined;
}

export function FieldHint(props: FieldHintProps): JSX.Element | null {
  if (props.hint === undefined) return null;
  return (
    <Hint className="field-hint" data-testid="field-hint">
      {props.hint}
    </Hint>
  );
}
