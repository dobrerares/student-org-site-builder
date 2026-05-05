/**
 * Step 3 — Sections. Pick mandatory blocks for the home page; the user
 * can skip optional blocks and add them later in the editor.
 *
 * Per PRD §"Block library (15 blocks total)" — the mandatory blocks are
 * already auto-created on a new site; this step lets the user opt out
 * of any they don't want, or trim the default set.
 */
import type { JSX } from "preact";

import type { SectionsData } from "../state-machine.js";

export interface SectionsStepProps {
  readonly data: SectionsData;
  readonly onPatch: (partial: Partial<SectionsData>) => void;
}

const MANDATORY_BLOCKS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "hero", label: "Hero (page intro)" },
  { id: "richText", label: "About (rich text)" },
  { id: "valueList", label: "Values" },
  { id: "activitiesList", label: "Activities" },
  { id: "teamGrid", label: "Team" },
  { id: "contactCard", label: "Contact" },
];

const DEFAULT_SELECTED = MANDATORY_BLOCKS.map((b) => b.id);

export function SectionsStep(props: SectionsStepProps): JSX.Element {
  const selected = props.data.mandatory ?? DEFAULT_SELECTED;

  function toggle(blockId: string): void {
    const set = new Set<string>(selected);
    if (set.has(blockId)) {
      set.delete(blockId);
    } else {
      set.add(blockId);
    }
    // Preserve the canonical order so resume reads stable values.
    const next = MANDATORY_BLOCKS.filter((b) => set.has(b.id)).map((b) => b.id);
    props.onPatch({ mandatory: next });
  }

  return (
    <fieldset data-testid="sections-step">
      <legend>Sections</legend>
      <p>Pick the sections to include on your home page.</p>

      <ul data-testid="sections-list">
        {MANDATORY_BLOCKS.map((block) => (
          <li key={block.id}>
            <label>
              <input
                type="checkbox"
                data-field={`sections.${block.id}`}
                checked={selected.includes(block.id)}
                onChange={() => toggle(block.id)}
              />
              <span>{block.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
