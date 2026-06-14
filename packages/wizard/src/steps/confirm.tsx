/**
 * Step 6 — Confirm. Renders a preview summary of the captured wizard
 * data plus a 'Create site' button (in the parent `<Wizard>` shell).
 */
import type { JSX } from "preact";
import type { Site } from "@sosb/schema";
import { buildThemeCatalog } from "@sosb/themes";
import type { WizardState } from "../state-machine.js";

export interface ConfirmStepProps {
  readonly state: WizardState;
  readonly site: Site;
}

export function ConfirmStep(props: ConfirmStepProps): JSX.Element {
  const { site } = props;
  const themeLabel = buildThemeCatalog().entryFor(site.theme.id).label;

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
        <dd>{themeLabel}</dd>

        <dt>Languages</dt>
        <dd>{site.languages.map(languageLabel).join(", ")}</dd>

        <dt>Default language</dt>
        <dd>{languageLabel(site.defaultLanguage)}</dd>

        <dt>Pages</dt>
        <dd>{site.pages.length}</dd>

        <dt>Starter sections</dt>
        <dd>{starterSectionLabels(site).join(", ")}</dd>
      </dl>
    </fieldset>
  );
}

function languageLabel(lang: string): string {
  switch (lang) {
    case "ro":
      return "Română";
    case "en":
      return "English";
    default:
      return lang.toUpperCase();
  }
}

function starterSectionLabels(site: Site): string[] {
  const blocks = site.pages[0]?.blocks ?? [];
  return blocks.map((block) => {
    switch (block.type) {
      case "hero":
        return "Top page header";
      case "richText":
        return "About text";
      case "valueList":
        return "Values";
      case "activitiesList":
        return "Activities";
      case "teamGrid":
        return "Team";
      case "contactCard":
        return "Contact";
      default:
        return block.type;
    }
  });
}
