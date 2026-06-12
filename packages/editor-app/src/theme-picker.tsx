/**
 * Theme picker — the canonical structural form override that replaces
 * what would otherwise be a raw `<input>` for `theme.id` (ADR 0043).
 *
 * Renders a radio-list of user-facing themes drawn from
 * `buildThemeCatalog()`. The stub theme is intentionally omitted by the
 * catalog (it is a renderer-test fixture). Each option carries the
 * humanised label and a one-line description so the user has enough
 * context to choose.
 *
 * Per ADR 0044 (no technical field escape hatches) this component must
 * never fall back to a raw `<input type="text">` — even if the current
 * value is not in the catalog. In that case we render a status note
 * showing the humanised current value (so the user understands why
 * none of the cataloged options is selected) and the 5 catalog entries
 * with none marked active; the unknown value is preserved by the parent
 * form and the user can pick any cataloged theme to move forward.
 *
 * Markup choice: native `<input type="radio">` wrapped in a `<label>`,
 * matching the prior art in `packages/wizard/src/steps/identity.tsx`.
 * Native radios with a shared `name` form a radiogroup and get arrow-key
 * cycling, focus management, and `:checked` semantics for free — none
 * of which `<button role="radio">` provides. The outer
 * `<div role="radiogroup">` is kept for layout + a labelled wrapper
 * (the `aria-label="Theme"` gives assistive tech a group label).
 */
import type { JSX } from "preact";

import { buildThemeCatalog } from "./theme-catalog.js";

export interface ThemePickerProps {
  readonly value: string;
  readonly onChange: (id: string) => void;
}

// Stable per-page radio-group name. Only one ThemePicker mounts on a
// page (T6), so a hardcoded name is sufficient and avoids the noise of
// `useId()`.
const RADIO_GROUP_NAME = "theme-picker";

export function ThemePicker(props: ThemePickerProps): JSX.Element {
  const catalog = buildThemeCatalog();
  const isKnown = catalog.entries.some((e) => e.id === props.value);

  return (
    <div data-theme-picker-root>
      {!isKnown && (
        <p data-theme-current-unknown role="status">
          Current theme: <code>{catalog.entryFor(props.value).label}</code> — not in the picker.
          Choose a theme below to switch.
        </p>
      )}
      <div data-testid="theme-picker" role="radiogroup" aria-label="Theme">
        {catalog.entries.map((entry) => {
          const isActive = entry.id === props.value;
          return (
            <label
              key={entry.id}
              data-theme-option
              data-theme-id={entry.id}
              data-active={isActive ? "true" : "false"}
            >
              <input
                type="radio"
                name={RADIO_GROUP_NAME}
                value={entry.id}
                checked={isActive}
                onChange={() => props.onChange(entry.id)}
              />
              <span data-theme-option-label>{entry.label}</span>
              <span data-theme-option-description>{entry.description}</span>
              <span data-theme-option-preview aria-hidden="true">
                <span data-theme-preview-swatches>
                  {entry.preview.swatches.map((swatch) => (
                    <span
                      key={swatch}
                      data-theme-preview-swatch
                      style={{ backgroundColor: swatch }}
                    />
                  ))}
                </span>
                <span data-theme-preview-type>
                  <strong>{entry.preview.headlineSample}</strong>
                  <span>{entry.preview.bodySample}</span>
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
