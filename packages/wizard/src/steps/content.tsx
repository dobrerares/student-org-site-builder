/**
 * Step 4 — Content. Per-section initial content, or skip entirely.
 *
 * The wizard goal here is "filling in just enough to make the site
 * credible". The user can write their own hero title/subtitle, or skip
 * and let `buildSiteFromWizard` derive defaults from `basics.name` and
 * `basics.tagline`.
 */
import type { JSX } from "preact";

import type { ContentData } from "../state-machine.js";

export interface ContentStepProps {
  readonly data: ContentData;
  readonly onPatch: (partial: Partial<ContentData>) => void;
}

export function ContentStep(props: ContentStepProps): JSX.Element {
  const skipped = props.data.skip === true;

  return (
    <fieldset data-testid="content-step">
      <legend>Content</legend>
      <p>Add the headline content now, or skip and write it in the editor.</p>

      <label>
        <input
          type="checkbox"
          data-field="content.skip"
          checked={skipped}
          onChange={(e) =>
            props.onPatch({
              skip: (e.currentTarget as HTMLInputElement).checked,
            })
          }
        />
        <span>Skip — I'll write the content in the editor.</span>
      </label>

      {!skipped && (
        <>
          <label>
            <span>Hero title</span>
            <input
              type="text"
              data-field="content.heroTitle"
              value={props.data.heroTitle ?? ""}
              onInput={(e) =>
                props.onPatch({
                  heroTitle: (e.currentTarget as HTMLInputElement).value,
                })
              }
            />
          </label>

          <label>
            <span>Hero subtitle</span>
            <input
              type="text"
              data-field="content.heroSubtitle"
              value={props.data.heroSubtitle ?? ""}
              onInput={(e) =>
                props.onPatch({
                  heroSubtitle: (e.currentTarget as HTMLInputElement).value,
                })
              }
            />
          </label>
        </>
      )}
    </fieldset>
  );
}
