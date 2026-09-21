/** @jsxImportSource react */
/**
 * Step 1 — Basics. Org name (required), tagline, founded year.
 *
 * The only required field is `name`; the state machine refuses to
 * advance past 'basics' until it is set.
 */
import type { JSX } from "react";

import type { BasicsData } from "../state-machine.js";
import { Input } from "@sosb/ui";

export interface BasicsStepProps {
  readonly data: BasicsData;
  readonly onPatch: (partial: Partial<BasicsData>) => void;
}

export function BasicsStep(props: BasicsStepProps): JSX.Element {
  return (
    <fieldset data-testid="basics-step">
      <legend>Basics</legend>
      <p>
        Tell us about your organization. Only the name is required — everything else can be added
        later.
      </p>

      <label>
        <span>Organization name *</span>
        <Input
          type="text"
          data-field="basics.name"
          value={props.data.name ?? ""}
          onInput={(e) => props.onPatch({ name: (e.currentTarget as HTMLInputElement).value })}
          required
        />
      </label>

      <label>
        <span>Tagline (optional)</span>
        <Input
          type="text"
          data-field="basics.tagline"
          value={props.data.tagline ?? ""}
          onInput={(e) =>
            props.onPatch({
              tagline: (e.currentTarget as HTMLInputElement).value,
            })
          }
        />
      </label>

      <label>
        <span>Founded year (optional)</span>
        <Input
          type="number"
          data-field="basics.foundedYear"
          value={props.data.foundedYear ?? ""}
          onInput={(e) => {
            const raw = (e.currentTarget as HTMLInputElement).value;
            if (raw === "") return;
            const parsed = Number.parseInt(raw, 10);
            if (Number.isNaN(parsed)) return;
            props.onPatch({ foundedYear: parsed });
          }}
        />
      </label>
    </fieldset>
  );
}
