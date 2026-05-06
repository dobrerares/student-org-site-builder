/**
 * Wizard step IDs and metadata.
 *
 * The wizard's six steps are pinned by the PRD: basics → identity →
 * sections → content → languages → confirm. Each step's user-visible title
 * lives in the i18n catalog under `wizard.step.<id>.title`; this module
 * exports the step id list and the catalog-key mapping so #33's UI can
 * iterate steps and look up their titles without hard-coding the key
 * strings.
 *
 * The full Preact wizard UI (state machine + per-step forms) lands in #33;
 * this module is the i18n contract that #33 consumes.
 */

import type { EditorMessageKey } from "@sosb/i18n";

export const WIZARD_STEPS = [
  "basics",
  "identity",
  "sections",
  "content",
  "languages",
  "confirm",
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number];

/**
 * The canonical mapping from a wizard step id to its title's i18n catalog
 * key. The keys themselves are guaranteed to exist by the catalog-parity
 * test in `@sosb/i18n` — adding a step is "extend `WIZARD_STEPS` + add the
 * key in both EN and RO catalogs", a single change visible at code review.
 */
export const WIZARD_STEP_TITLE_KEY: Readonly<Record<WizardStepId, EditorMessageKey>> = {
  basics: "wizard.step.basics.title",
  identity: "wizard.step.identity.title",
  sections: "wizard.step.sections.title",
  content: "wizard.step.content.title",
  languages: "wizard.step.languages.title",
  confirm: "wizard.step.confirm.title",
};

export const WIZARD_ACTION_KEYS = {
  back: "wizard.action.back",
  next: "wizard.action.next",
  skip: "wizard.action.skip",
  finish: "wizard.action.finish",
} as const satisfies Readonly<Record<string, EditorMessageKey>>;
