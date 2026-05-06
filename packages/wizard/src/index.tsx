/**
 * `@sosb/wizard` — 6-step state machine + Preact UI for guided
 * onboarding.
 *
 * Tracking issue: #33. ADR 0007 records the design.
 *
 * Public surface (v1):
 *
 *   - `<Wizard initial onProgress onComplete onCancel />` — the Preact
 *     shell. The host wires `onProgress` to `saveWizardProgress` for
 *     resume-across-reload, `onComplete` to its own "open in editor"
 *     flow, and `onCancel` to the welcome-screen restore.
 *   - State machine primitives — pure functions, framework-agnostic:
 *     `STEPS`, `createInitialState`, `next`, `back`, `jumpTo`, `patch`,
 *     `reset`, `isStepValid`, `isStepOptional`, `isStepComplete`.
 *   - `buildSiteFromWizard(data)` — pure mapper from `WizardData` to a
 *     `Site` validated by `@sosb/schema`'s `validate()`.
 *   - VFS-backed persistence:
 *     `WIZARD_PROGRESS_PATH`, `loadWizardProgress`,
 *     `saveWizardProgress`, `clearWizardProgress`.
 */

export { Wizard, type WizardProps } from "./wizard.js";

export {
  STEPS,
  createInitialState,
  next,
  back,
  jumpTo,
  patch,
  reset,
  isStepValid,
  isStepComplete,
  isStepOptional,
  type WizardStep,
  type WizardData,
  type WizardState,
  type BasicsData,
  type IdentityData,
  type SectionsData,
  type ContentData,
  type LanguagesData,
  type LanguagesMode,
} from "./state-machine.js";

export { buildSiteFromWizard } from "./build-site.js";

export {
  WIZARD_PROGRESS_PATH,
  loadWizardProgress,
  saveWizardProgress,
  clearWizardProgress,
} from "./persistence.js";

// i18n contract (#42) — step ids and the catalog-key mapping the wizard
// UI uses to translate per-step titles and the back/next/skip/finish
// action labels. ADR 0028 records the design.
export {
  WIZARD_STEPS,
  WIZARD_STEP_TITLE_KEY,
  WIZARD_ACTION_KEYS,
  type WizardStepId,
} from "./steps.js";
