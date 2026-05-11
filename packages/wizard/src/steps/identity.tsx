/**
 * Step 2 — Identity. Theme pick (logo upload + token customisation are
 * deferred to the editor; the wizard stays narrow per PRD).
 *
 * Themes the v1 editor ships, per PRD §"Five themes ship in v1":
 *   academic, modern, editorial, civic, minimal.
 *
 * The theme list is read from `buildThemeCatalog()` in `@sosb/themes` so
 * the wizard, editor theme-picker, and font-picker share one source of
 * truth for labels/descriptions/fonts (T17 follow-up to ADR 0043). The
 * catalog returns entries pre-sorted by id; we don't impose a separate
 * order here.
 */
import type { JSX } from "preact";

import { buildThemeCatalog } from "@sosb/themes";

import type { IdentityData } from "../state-machine.js";

export interface IdentityStepProps {
  readonly data: IdentityData;
  readonly onPatch: (partial: Partial<IdentityData>) => void;
}

const THEMES = buildThemeCatalog().entries;

export function IdentityStep(props: IdentityStepProps): JSX.Element {
  return (
    <fieldset data-testid="identity-step">
      <legend>Identity</legend>
      <p>Pick a starting theme. You can switch later in the editor.</p>

      <ul data-testid="theme-list">
        {THEMES.map((theme) => (
          <li key={theme.id}>
            <label>
              <input
                type="radio"
                name="theme"
                value={theme.id}
                data-field={`identity.theme.${theme.id}`}
                checked={props.data.themeId === theme.id}
                onChange={() => props.onPatch({ themeId: theme.id })}
              />
              <span>{theme.label}</span>
              <span>{theme.description}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
