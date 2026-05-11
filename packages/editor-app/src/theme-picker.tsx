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
 * value is not in the catalog. In that case we render the 5 catalog
 * entries with none marked active; the unknown value is preserved by
 * the parent form and the user can pick any cataloged theme to move
 * forward.
 */
import type { JSX } from "preact";

import { buildThemeCatalog } from "./theme-catalog.js";

export interface ThemePickerProps {
  readonly value: string;
  readonly onChange: (id: string) => void;
}

export function ThemePicker(props: ThemePickerProps): JSX.Element {
  const catalog = buildThemeCatalog();

  return (
    <div
      data-testid="theme-picker"
      role="radiogroup"
      aria-label="Theme"
    >
      {catalog.entries.map((entry) => {
        const isActive = entry.id === props.value;
        return (
          <button
            key={entry.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-pressed={isActive}
            data-theme-option
            data-theme-id={entry.id}
            data-active={isActive ? "true" : "false"}
            onClick={() => props.onChange(entry.id)}
          >
            <strong data-theme-option-label>{entry.label}</strong>
            <span data-theme-option-description>{entry.description}</span>
          </button>
        );
      })}
    </div>
  );
}
