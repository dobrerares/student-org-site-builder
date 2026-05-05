/**
 * Step 6 — Confirm. Renders a preview summary of the captured wizard
 * data plus a 'Create site' button (in the parent `<Wizard>` shell).
 */
import type { JSX } from "preact";
import type { Site } from "@sosb/schema";
import type { WizardState } from "../state-machine.js";

export interface ConfirmStepProps {
  readonly state: WizardState;
  readonly site: Site;
}

export function ConfirmStep(props: ConfirmStepProps): JSX.Element {
  const { site } = props;

  return (
    <fieldset data-testid="confirm-step">
      <legend>Ready to create</legend>
      <p>Review your starter site, then click "Create site" to open the editor.</p>

      <dl data-testid="confirm-summary">
        <dt>Organization</dt>
        <dd>{site.org.name}</dd>

        {site.org.tagline ? (
          <>
            <dt>Tagline</dt>
            <dd>{site.org.tagline}</dd>
          </>
        ) : null}

        {site.org.foundedYear !== undefined ? (
          <>
            <dt>Founded</dt>
            <dd>{site.org.foundedYear}</dd>
          </>
        ) : null}

        <dt>Theme</dt>
        <dd>{site.theme.id}</dd>

        <dt>Languages</dt>
        <dd>{site.languages.join(", ")}</dd>

        <dt>Default language</dt>
        <dd>{site.defaultLanguage}</dd>

        <dt>Pages</dt>
        <dd>{site.pages.length}</dd>

        <dt>Initial blocks on home page</dt>
        <dd>
          {site.pages[0]?.blocks.length ?? 0}
          {site.pages[0] ? ` (${site.pages[0].blocks.map((b) => b.type).join(", ")})` : ""}
        </dd>
      </dl>
    </fieldset>
  );
}
