/**
 * Wizard state machine — pure-function half of `@sosb/wizard`.
 *
 * The wizard is a 6-step flow whose AC require deterministic transitions
 * (Back/Next), per-step validation, "skip" on optional steps, and
 * resume-from-saved-state semantics. This module encodes the machine as
 * a discriminated tuple of step ids + per-step data, with `next` /
 * `back` / `jumpTo` / `patch` / `reset` as the public transitions.
 *
 * The module has zero framework dependencies — no Preact, no DOM. The
 * Preact shell (`wizard.tsx`) renders one step component per `state.step`.
 *
 * Tracking issue: #33. ADR 0007 records the design.
 */

/**
 * The six wizard steps in canonical order, per the PRD's wizard
 * description: "basics → identity → sections → content → languages →
 * confirm". The order is part of the contract — the persistence module
 * stores the step id and the resume path matches the same sequence.
 */
export const STEPS = ["basics", "identity", "sections", "content", "languages", "confirm"] as const;

export type WizardStep = (typeof STEPS)[number];

/**
 * Per-step user input. Each slot is independent; the transition functions
 * never collapse two steps into one.
 *
 * `basics`     — org name (required), tagline, founded year.
 * `identity`   — theme id (skip = use default).
 * `sections`   — set of mandatory blocks the user wants on the home page.
 * `content`    — initial content per section, OR `skip: true` to skip
 *                content entry entirely (a wizard goal: "fill in basics
 *                and skip the long-form content").
 * `languages`  — single or bilingual; if bilingual, second language id.
 * `confirm`    — no input; the step is a preview.
 */
export interface BasicsData {
  name?: string;
  tagline?: string;
  foundedYear?: number;
}

export interface IdentityData {
  themeId?: string;
}

export interface SectionsData {
  mandatory?: readonly string[];
}

export interface ContentData {
  skip?: boolean;
  heroTitle?: string;
  heroSubtitle?: string;
}

export type LanguagesMode = "single" | "bilingual";

export interface LanguagesData {
  mode?: LanguagesMode;
  defaultLanguage?: string;
  secondaryLanguage?: string;
}

export interface WizardData {
  basics?: BasicsData;
  identity?: IdentityData;
  sections?: SectionsData;
  content?: ContentData;
  languages?: LanguagesData;
}

export interface WizardState {
  readonly step: WizardStep;
  readonly data: WizardData;
}

/**
 * Map a `(state, step)` to the per-step data slot. Used by `patch` and
 * by the per-step validators below.
 */
type StepDataKey = "basics" | "identity" | "sections" | "content" | "languages";
const STEP_TO_KEY: Record<WizardStep, StepDataKey | null> = {
  basics: "basics",
  identity: "identity",
  sections: "sections",
  content: "content",
  languages: "languages",
  confirm: null, // confirm has no per-step data; it's the preview step
};

/**
 * Steps that can be skipped via the "Skip" button. Per the PRD: "Each
 * wizard step skippable when optional, so I can defer hard choices."
 */
const OPTIONAL_STEPS: ReadonlySet<WizardStep> = new Set<WizardStep>([
  "identity",
  "sections",
  "content",
  "languages",
]);

export function createInitialState(): WizardState {
  return {
    step: "basics",
    data: {},
  };
}

export function reset(): WizardState {
  return createInitialState();
}

/**
 * Merge `partial` into the per-step data slot. Returns a fresh state
 * object — the function never mutates its input.
 */
export function patch<S extends StepDataKey>(
  state: WizardState,
  step: S,
  partial: Partial<NonNullable<WizardData[S]>>,
): WizardState {
  const prev = state.data[step] ?? ({} as NonNullable<WizardData[S]>);
  return {
    ...state,
    data: {
      ...state.data,
      [step]: { ...prev, ...partial },
    },
  };
}

/**
 * Advance to the next step. Refuses to advance if the active step is
 * mandatory and not yet valid. Returns the same state in that case
 * (the UI surfaces the validation error).
 */
export function next(state: WizardState): WizardState {
  if (!isStepValid(state, state.step)) {
    // Mandatory step not yet satisfied — caller stays put. Optional
    // steps are always valid, so this branch never blocks them.
    if (!OPTIONAL_STEPS.has(state.step)) {
      return state;
    }
  }
  const idx = STEPS.indexOf(state.step);
  if (idx === -1 || idx === STEPS.length - 1) return state;
  const nextStep = STEPS[idx + 1];
  if (nextStep === undefined) return state;
  return { ...state, step: nextStep };
}

export function back(state: WizardState): WizardState {
  const idx = STEPS.indexOf(state.step);
  if (idx <= 0) return state;
  const prevStep = STEPS[idx - 1];
  if (prevStep === undefined) return state;
  return { ...state, step: prevStep };
}

/**
 * Jump to an arbitrary step. The contract:
 *   - jumping back is always allowed (the user is reviewing earlier
 *     entries).
 *   - jumping forward is allowed only when every intermediate step is
 *     valid (mandatory steps satisfied, optional steps trivially valid).
 */
export function jumpTo(state: WizardState, target: WizardStep): WizardState {
  const currentIdx = STEPS.indexOf(state.step);
  const targetIdx = STEPS.indexOf(target);
  if (targetIdx === -1) return state;
  if (targetIdx <= currentIdx) {
    return { ...state, step: target };
  }
  // Forward jump: every step from current..target-1 must be valid.
  for (let i = currentIdx; i < targetIdx; i += 1) {
    const intermediate = STEPS[i];
    if (intermediate === undefined) return state;
    if (!isStepValid(state, intermediate)) return state;
  }
  return { ...state, step: target };
}

/**
 * Per-step validity. Optional steps are always valid (skipping is fine).
 * Mandatory steps require their constraints met.
 */
export function isStepValid(state: WizardState, step: WizardStep): boolean {
  switch (step) {
    case "basics":
      return isBasicsValid(state.data.basics);
    case "identity":
      return true; // optional
    case "sections":
      return true; // optional
    case "content":
      return true; // optional
    case "languages":
      return isLanguagesValid(state.data.languages);
    case "confirm":
      // The confirm step is valid when the wizard's required data is in
      // place (i.e. basics is set). Without basics, "Create" can't run.
      return isBasicsValid(state.data.basics);
    default: {
      const _exhaustive: never = step;
      void _exhaustive;
      return false;
    }
  }
}

/**
 * A step is "complete" when validity passes AND the user has supplied
 * any meaningful data. For optional steps, "no data" is also complete
 * (skipping is the natural completion).
 */
export function isStepComplete(state: WizardState, step: WizardStep): boolean {
  return isStepValid(state, step);
}

export function isStepOptional(step: WizardStep): boolean {
  return OPTIONAL_STEPS.has(step);
}

// --- Per-step validators ----------------------------------------------------

function isBasicsValid(data: BasicsData | undefined): boolean {
  if (data === undefined) return false;
  const name = data.name ?? "";
  return name.trim().length > 0;
}

function isLanguagesValid(data: LanguagesData | undefined): boolean {
  if (data === undefined) return true; // optional, default-fills downstream
  if (data.mode === "bilingual") {
    if (data.defaultLanguage === undefined || data.secondaryLanguage === undefined) {
      // Step still valid in 'partial' state (the user is mid-input);
      // they just haven't filled both fields yet. We treat this as
      // valid so they can navigate forward and come back later.
      // The build-site mapper falls back to single-language defaults
      // for missing fields.
      return true;
    }
    return data.defaultLanguage !== data.secondaryLanguage;
  }
  return true;
}

export { STEP_TO_KEY };
