/**
 * `<Wizard />` — Preact UI shell wrapping the state machine.
 *
 * Layout responsibilities:
 *   - Top: a step indicator showing all six steps with the active one
 *     highlighted. Indicators are clickable to jump to earlier steps;
 *     forward jumps require the intermediate steps to be valid.
 *   - Middle: the active step's form (one of six step components).
 *   - Bottom: navigation strip — Cancel always, Back / Next on every
 *     step, Skip on optional steps, Create on the final 'confirm' step.
 *
 * State responsibilities:
 *   - Hold a `WizardState` (initial = prop or fresh state).
 *   - On every transition, call `onProgress(newState)` so the host can
 *     persist via `saveWizardProgress`.
 *   - On 'Create' (confirm step), build a `Site` via
 *     `buildSiteFromWizard` and fire `onComplete(site)`.
 *
 * Tracking issue: #33.
 */

import type { JSX } from "preact";
import { useState, useCallback } from "preact/hooks";
import type { Site } from "@sosb/schema";

import {
  STEPS,
  back,
  createInitialState,
  isStepOptional,
  isStepValid,
  jumpTo,
  next,
  patch,
  type WizardState,
  type WizardStep,
} from "./state-machine.js";
import { buildSiteFromWizard } from "./build-site.js";
import { BasicsStep } from "./steps/basics.js";
import { IdentityStep } from "./steps/identity.js";
import { SectionsStep } from "./steps/sections.js";
import { ContentStep } from "./steps/content.js";
import { LanguagesStep } from "./steps/languages.js";
import { ConfirmStep } from "./steps/confirm.js";

export interface WizardProps {
  /** Resume from a persisted state. Optional — defaults to a fresh wizard. */
  readonly initial?: WizardState;
  /** Fired on every state change (after edits, navigation, or skips). */
  readonly onProgress?: (state: WizardState) => void;
  /** Fired when the user clicks 'Create' on the confirm step. */
  readonly onComplete?: (site: Site) => void;
  /** Fired when the user clicks 'Cancel' on any step. */
  readonly onCancel?: () => void;
}

const STEP_LABELS: Record<WizardStep, string> = {
  basics: "Basics",
  identity: "Identity",
  sections: "Sections",
  content: "Content",
  languages: "Languages",
  confirm: "Confirm",
};

export function Wizard(props: WizardProps): JSX.Element {
  const [state, setState] = useState<WizardState>(() => props.initial ?? createInitialState());

  const apply = useCallback(
    (transformed: WizardState): void => {
      setState(transformed);
      props.onProgress?.(transformed);
    },
    [props],
  );

  const handlePatch = useCallback(
    (
      step: "basics" | "identity" | "sections" | "content" | "languages",
      partial: Record<string, unknown>,
    ): void => {
      apply(
        patch(
          state,
          step,
          partial as never, // each step's component knows its own shape
        ),
      );
    },
    [apply, state],
  );

  const handleNext = useCallback((): void => apply(next(state)), [apply, state]);
  const handleBack = useCallback((): void => apply(back(state)), [apply, state]);
  const handleSkip = useCallback((): void => apply(next(state)), [apply, state]);
  const handleJumpTo = useCallback(
    (target: WizardStep): void => apply(jumpTo(state, target)),
    [apply, state],
  );

  const handleCreate = useCallback((): void => {
    const site = buildSiteFromWizard(state.data);
    props.onComplete?.(site);
  }, [props, state]);

  const handleCancel = useCallback((): void => {
    props.onCancel?.();
  }, [props]);

  const onCurrentStep = state.step;
  const stepIndex = STEPS.indexOf(onCurrentStep);
  const isFirstStep = stepIndex === 0;
  const isFinalStep = onCurrentStep === "confirm";
  const canAdvance = isStepValid(state, onCurrentStep);
  const canSkip = isStepOptional(onCurrentStep);

  return (
    <div data-testid="wizard" data-wizard-step={onCurrentStep}>
      <StepIndicator state={state} onJumpTo={handleJumpTo} />

      <div data-wizard-step={onCurrentStep} data-testid="wizard-step">
        {onCurrentStep === "basics" && (
          <BasicsStep data={state.data.basics ?? {}} onPatch={(p) => handlePatch("basics", p)} />
        )}
        {onCurrentStep === "identity" && (
          <IdentityStep
            data={state.data.identity ?? {}}
            onPatch={(p) => handlePatch("identity", p)}
          />
        )}
        {onCurrentStep === "sections" && (
          <SectionsStep
            data={state.data.sections ?? {}}
            onPatch={(p) => handlePatch("sections", p)}
          />
        )}
        {onCurrentStep === "content" && (
          <ContentStep data={state.data.content ?? {}} onPatch={(p) => handlePatch("content", p)} />
        )}
        {onCurrentStep === "languages" && (
          <LanguagesStep
            data={state.data.languages ?? {}}
            onPatch={(p) => handlePatch("languages", p)}
          />
        )}
        {onCurrentStep === "confirm" && (
          <ConfirmStep state={state} site={buildSiteFromWizard(state.data)} />
        )}
      </div>

      <div data-testid="wizard-nav">
        <button type="button" data-action="cancel" onClick={handleCancel}>
          Cancel
        </button>
        <button type="button" data-action="back" disabled={isFirstStep} onClick={handleBack}>
          Back
        </button>
        {canSkip && !isFinalStep && (
          <button type="button" data-action="skip" onClick={handleSkip}>
            Skip
          </button>
        )}
        {!isFinalStep && (
          <button type="button" data-action="next" disabled={!canAdvance} onClick={handleNext}>
            Next
          </button>
        )}
        {isFinalStep && (
          <button type="button" data-action="create" disabled={!canAdvance} onClick={handleCreate}>
            Create site
          </button>
        )}
      </div>
    </div>
  );
}

interface StepIndicatorProps {
  readonly state: WizardState;
  readonly onJumpTo: (target: WizardStep) => void;
}

function StepIndicator(props: StepIndicatorProps): JSX.Element {
  return (
    <ol data-testid="step-indicator">
      {STEPS.map((step, idx) => (
        <li key={step}>
          <button
            type="button"
            data-wizard-step-indicator={step}
            data-active={props.state.step === step ? "true" : "false"}
            onClick={() => props.onJumpTo(step)}
          >
            <span>{idx + 1}.</span>
            <span>{STEP_LABELS[step]}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
