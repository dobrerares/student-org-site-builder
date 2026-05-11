/**
 * ColorPicker — structural form override for `theme.tokens.color*`
 * (ADR 0043). Wraps the browser's native `<input type="color">` and
 * extends it with a tri-state convention the raw control does not
 * support: `value: string | undefined`.
 *
 * Why tri-state matters: theme tokens fall back to the active theme's
 * built-in palette when no user override is set. A token slot with no
 * user value (`undefined`) should not be confused with a token slot
 * explicitly pinned to `#000000`. The native `<input type="color">`
 * cannot represent "no value" — it always reports SOME hex — so we
 * layer two affordances on top:
 *
 *  1. When `value === undefined`, the underlying input falls back to
 *     `#000000` (so the browser swatch renders something), but the
 *     component shows a "(using theme default)" note. The user sees
 *     immediately that the swatch is not their choice.
 *  2. When `value` is a hex string, a "Reset to default" button
 *     appears next to the swatch and fires `onChange(undefined)` so
 *     the user can revert to the theme default without typing.
 *
 * Per ADR 0044 (no raw technical fields), the user never types a hex
 * string by hand — the native picker is the only path to a colour
 * value. `onInput` is used (not `onChange`) so the parent sees the
 * latest hex as the user drags inside the OS colour wheel, matching
 * the responsive feel of the native control.
 *
 * Hex normalisation: browsers report the picked value in lowercase
 * (`#ff00aa`), but spec-wise it is case-insensitive. We pass it
 * through unchanged so the test assertion on `"#ff0000"` holds. If a
 * future browser surprises us with uppercase output we can wrap in
 * `.toLowerCase()` here without rippling.
 */
import type { JSX } from "preact";

export interface ColorPickerProps {
  readonly value: string | undefined;
  readonly onChange: (next: string | undefined) => void;
  /** Optional label rendered above the picker. */
  readonly label?: string;
}

// Browsers refuse to render `<input type="color">` without a 7-char
// hex; using black as a neutral baseline when no value is set.
const FALLBACK_HEX = "#000000";

export function ColorPicker(props: ColorPickerProps): JSX.Element {
  const hasValue = props.value !== undefined;
  const swatchValue = hasValue ? props.value! : FALLBACK_HEX;

  const handleInput = (event: JSX.TargetedEvent<HTMLInputElement>): void => {
    props.onChange(event.currentTarget.value);
  };

  const handleReset = (): void => {
    props.onChange(undefined);
  };

  return (
    <div data-testid="color-picker">
      {props.label !== undefined ? (
        <label data-color-picker-label>{props.label}</label>
      ) : null}
      <input
        type="color"
        value={swatchValue}
        aria-label={props.label}
        onInput={handleInput}
      />
      {hasValue ? (
        <button
          type="button"
          data-testid="color-picker-reset"
          onClick={handleReset}
        >
          Reset to default
        </button>
      ) : (
        <span data-testid="color-picker-default-note" role="status">
          (using theme default)
        </span>
      )}
    </div>
  );
}
