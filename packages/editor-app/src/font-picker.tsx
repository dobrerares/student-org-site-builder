/**
 * Font picker — structural form override for `theme.tokens.fontHeadline`
 * and `theme.tokens.fontBody` (ADR 0043).
 *
 * Renders a `<select>` populated from the active theme's curated font
 * list in the theme catalog (T1). The catalog exposes per-theme
 * `fonts.headline` and `fonts.body` arrays so the same component handles
 * both slots via the `kind` prop.
 *
 * Value semantics:
 *  - `undefined` → the theme's default font is used by the renderer.
 *    The `<select>` shows "(use theme default)" as the selected option,
 *    whose underlying value is the empty string.
 *  - A named value (e.g. `"Inter"`) that is present in the catalog list
 *    selects that option.
 *  - A named value that is NOT in the catalog list (typical when the
 *    user picked a font under a different theme and then switched theme)
 *    is preserved as a "stale" option labelled "Custom: <value>". This
 *    upholds ADR 0044's invariant: never silently lose the user's value.
 *    The user can switch back to "(use theme default)" or any catalog
 *    option to clear it.
 *
 * Per ADR 0044 (no technical field escape hatches) this component never
 * renders a raw `<input type="text">` — the picker is the only way to
 * change the font slot from the editor.
 */
import type { JSX } from "preact";

import { buildThemeCatalog } from "./theme-catalog.js";

export interface FontPickerProps {
  readonly themeId: string;
  readonly kind: "headline" | "body";
  readonly value: string | undefined;
  readonly onChange: (next: string | undefined) => void;
  readonly label?: string;
}

export function FontPicker(props: FontPickerProps): JSX.Element {
  const catalog = buildThemeCatalog();
  const entry = catalog.entryFor(props.themeId);
  const catalogFonts = entry.fonts[props.kind];

  // Build the option list. The empty-string value carries
  // `undefined` semantics through the select (no `selected` attribute
  // is needed — the underlying `value=""` matches when `props.value`
  // is undefined).
  const trimmed = props.value ?? "";
  const isCustom = trimmed !== "" && !catalogFonts.includes(trimmed);

  const handleChange = (event: JSX.TargetedEvent<HTMLSelectElement>): void => {
    const next = event.currentTarget.value;
    props.onChange(next === "" ? undefined : next);
  };

  return (
    <div data-testid="font-picker" data-kind={props.kind}>
      <select value={trimmed} onChange={handleChange} aria-label={props.label ?? undefined}>
        <option value="">(use theme default)</option>
        {catalogFonts.map((font) => (
          <option key={font} value={font}>
            {font}
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
