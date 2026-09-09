/**
 * NamedValueSelect — generic structural form override for tri-state
 * named-value slots (ADR 0043). Two consumers in ThemeForm:
 *  - `theme.tokens.density`  (compact / normal / comfortable)
 *  - `theme.tokens.radius`   (sharp / soft / round)
 *
 * The component is intentionally agnostic — it knows nothing about
 * density or radius semantics. Callers pass a `{ value, label }[]` list
 * and the component renders a `<select>` with one option per entry plus
 * a `(use theme default)` sentinel for the undefined case. This keeps
 * the per-slot vocabulary in one place (the consumer) rather than
 * scattered across widget files.
 *
 * Value semantics:
 *  - `undefined` → the theme's default is used by the renderer. The
 *    select shows "(use theme default)" as the selected option, whose
 *    underlying value is the empty string.
 *  - A named value present in `options` selects that option.
 *  - A named value NOT in `options` is preserved as a "Custom: <value>"
 *    option, mirroring the FontPicker pattern (sibling widget T14).
 *    This upholds ADR 0044's invariant: never silently lose the user's
 *    value, even if the option list shifts under it (e.g. a future
 *    schema change that drops a density token).
 *
 * Per ADR 0044 (no technical field escape hatches) this component
 * never renders a raw `<input type="text">` — the select is the only
 * way to change the slot from the editor.
 *
 * `nameKey` is a test/data-attribute hook so a form that mounts two
 * instances of this component (density + radius) can target each one
 * unambiguously via `[data-name-key="density"]`.
 */
import type { JSX } from "preact";
import { useId } from "preact/hooks";

export interface NamedValueOption {
  readonly value: string;
  readonly label: string;
}

export interface NamedValueSelectProps {
  readonly value: string | undefined;
  readonly onChange: (next: string | undefined) => void;
  readonly options: readonly NamedValueOption[];
  readonly label?: string;
  /** Optional one-line explanation rendered under the label. */
  readonly hint?: string;
  /** Test/data-attribute hook so multiple instances in one form can be differentiated. */
  readonly nameKey?: string;
}

export function NamedValueSelect(props: NamedValueSelectProps): JSX.Element {
  const selectId = useId();
  // The empty-string value carries `undefined` semantics through the
  // select (no `selected` attribute is needed — the underlying
  // `value=""` matches when `props.value` is undefined).
  const trimmed = props.value ?? "";
  const isCustom = trimmed !== "" && !props.options.some((o) => o.value === trimmed);

  const handleChange = (event: JSX.TargetedEvent<HTMLSelectElement>): void => {
    const next = event.currentTarget.value;
    props.onChange(next === "" ? undefined : next);
  };

  return (
    <div data-testid="named-value-select" data-name-key={props.nameKey ?? ""} data-picker-field>
      {props.label !== undefined ? (
        <label data-picker-field-label for={selectId}>
          {props.label}
        </label>
      ) : null}
      {props.hint !== undefined ? <p class="field-hint">{props.hint}</p> : null}
      <select
        id={selectId}
        value={trimmed}
        onChange={handleChange}
        aria-label={props.label ?? undefined}
      >
        <option value="">Theme default</option>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {isCustom && (
          <option key={`__custom-${trimmed}`} value={trimmed}>
            Custom: {trimmed}
          </option>
        )}
      </select>
    </div>
  );
}
