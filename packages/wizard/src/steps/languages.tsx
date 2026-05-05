/**
 * Step 5 — Languages. Single or bilingual; the secondary language is
 * picked when the user switches to bilingual mode.
 *
 * v1 ships RO-default with optional EN counterpart per PRD; the wizard
 * keeps that decision pliant by surfacing both as user choices instead
 * of hard-coding RO.
 */
import type { JSX } from "preact";

import type { LanguagesData, LanguagesMode } from "../state-machine.js";

export interface LanguagesStepProps {
  readonly data: LanguagesData;
  readonly onPatch: (partial: Partial<LanguagesData>) => void;
}

const LANGUAGES: ReadonlyArray<{ id: string; label: string }> = [
  { id: "ro", label: "Romanian" },
  { id: "en", label: "English" },
  { id: "fr", label: "French" },
  { id: "de", label: "German" },
  { id: "es", label: "Spanish" },
];

export function LanguagesStep(props: LanguagesStepProps): JSX.Element {
  const mode: LanguagesMode = props.data.mode ?? "single";
  const defaultLanguage = props.data.defaultLanguage ?? "ro";
  const secondaryLanguage = props.data.secondaryLanguage;

  return (
    <fieldset data-testid="languages-step">
      <legend>Languages</legend>
      <p>Pick the default language. Add a second language now or later.</p>

      <label>
        <span>Mode</span>
        <select
          data-field="languages.mode"
          value={mode}
          onChange={(e) =>
            props.onPatch({
              mode: (e.currentTarget as HTMLSelectElement).value as LanguagesMode,
            })
          }
        >
          <option value="single">Single language</option>
          <option value="bilingual">Bilingual</option>
        </select>
      </label>

      <label>
        <span>Default language</span>
        <select
          data-field="languages.defaultLanguage"
          value={defaultLanguage}
          onChange={(e) =>
            props.onPatch({
              defaultLanguage: (e.currentTarget as HTMLSelectElement).value,
            })
          }
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      {mode === "bilingual" && (
        <label>
          <span>Secondary language</span>
          <select
            data-field="languages.secondaryLanguage"
            value={secondaryLanguage ?? ""}
            onChange={(e) =>
              props.onPatch({
                secondaryLanguage: (e.currentTarget as HTMLSelectElement).value,
              })
            }
          >
            <option value="">— pick one —</option>
            {LANGUAGES.filter((l) => l.id !== defaultLanguage).map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </fieldset>
  );
}
