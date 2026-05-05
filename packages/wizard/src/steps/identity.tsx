/**
 * Step 2 — Identity. Theme pick (logo upload + token customisation are
 * deferred to the editor; the wizard stays narrow per PRD).
 *
 * Themes the v1 editor ships, per PRD §"Five themes ship in v1":
 *   academic, modern, editorial, civic, minimal.
 */
import type { JSX } from "preact";

import type { IdentityData } from "../state-machine.js";

export interface IdentityStepProps {
  readonly data: IdentityData;
  readonly onPatch: (partial: Partial<IdentityData>) => void;
}

const THEMES: ReadonlyArray<{ id: string; label: string; description: string }> = [
  {
    id: "academic",
    label: "Academic",
    description: "Serious, scholarly look — think research society or honors program.",
  },
  {
    id: "modern",
    label: "Modern",
    description: "Clean, bright, contemporary — fits youth-focused programs.",
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "Magazine-style typography for storytelling-heavy orgs.",
  },
  {
    id: "civic",
    label: "Civic",
    description: "Civically engaged feel — campaigns, advocacy, community.",
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Quiet, neutral, gets out of your content's way.",
  },
];

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
