import { describe, expect, test } from "vitest";
import {
  STEPS,
  createInitialState,
  next,
  back,
  jumpTo,
  patch,
  reset,
  isStepValid,
  isStepOptional,
  isStepComplete,
  type WizardData,
  type WizardState,
  type WizardStep,
} from "../src/state-machine.js";

/**
 * Wizard state machine — covers AC for issue #33:
 *
 *   - Wizard renders all six steps with appropriate forms.
 *   - Back/Next navigation preserves state per step.
 *   - State persists across page reloads / app restarts mid-wizard
 *     (state-machine half — persistence module owns the IO).
 *   - "Skip" available on optional steps.
 *   - Final confirm step previews the site, then "Create" opens it in
 *     the editor.
 *   - Wizard can be cancelled at any step (with confirmation).
 *
 * The state machine is the pure-function half: 6 step ids, deterministic
 * transitions, per-step validity. The Preact shell (wizard.tsx) renders
 * the matching step component per state.
 */

describe("STEPS — six-step ordering", () => {
  test("declares the six PRD-mandated steps in canonical order", () => {
    expect(STEPS).toEqual(["basics", "identity", "sections", "content", "languages", "confirm"]);
  });

  test("the first step is 'basics' and the last is 'confirm'", () => {
    expect(STEPS[0]).toBe("basics");
    expect(STEPS[STEPS.length - 1]).toBe("confirm");
  });
});

describe("createInitialState", () => {
  test("starts on the 'basics' step with no captured data", () => {
    const state = createInitialState();
    expect(state.step).toBe("basics");
    expect(state.data.basics).toBeUndefined();
    expect(state.data.identity).toBeUndefined();
    expect(state.data.sections).toBeUndefined();
    expect(state.data.content).toBeUndefined();
    expect(state.data.languages).toBeUndefined();
  });

  test("returns a fresh object each call (no aliasing)", () => {
    const a = createInitialState();
    const b = createInitialState();
    expect(a).not.toBe(b);
    expect(a.data).not.toBe(b.data);
  });
});

describe("next() — forward transitions", () => {
  test("advances through the six steps in order from a fully-completed state", () => {
    let state: WizardState = createInitialState();
    state = patch(state, "basics", { name: "HISTORIPOL" });
    expect(state.step).toBe("basics");

    state = next(state);
    expect(state.step).toBe("identity");
    state = next(state);
    expect(state.step).toBe("sections");
    state = next(state);
    expect(state.step).toBe("content");
    state = next(state);
    expect(state.step).toBe("languages");
    state = next(state);
    expect(state.step).toBe("confirm");
  });

  test("next() on the final step is a no-op (stays on 'confirm')", () => {
    let state: WizardState = createInitialState();
    state = { ...state, step: "confirm" };
    const advanced = next(state);
    expect(advanced.step).toBe("confirm");
  });

  test("next() refuses to advance from 'basics' when basics data is invalid (no org name)", () => {
    const state = createInitialState();
    // No basics.name patched yet — state-machine 'basics' step is invalid.
    expect(isStepValid(state, "basics")).toBe(false);
    const advanced = next(state);
    expect(advanced.step).toBe("basics");
  });
});

describe("back() — backward transitions", () => {
  test("goes back one step at a time", () => {
    let state: WizardState = createInitialState();
    state = patch(state, "basics", { name: "Org" });
    state = next(state); // identity
    state = next(state); // sections
    expect(state.step).toBe("sections");

    state = back(state);
    expect(state.step).toBe("identity");
    state = back(state);
    expect(state.step).toBe("basics");
  });

  test("back() on the first step is a no-op (stays on 'basics')", () => {
    const state = createInitialState();
    const backed = back(state);
    expect(backed.step).toBe("basics");
  });

  test("back/forward preserves data captured in each step", () => {
    let state: WizardState = createInitialState();
    state = patch(state, "basics", { name: "HISTORIPOL", foundedYear: 2024 });
    state = next(state);
    state = patch(state, "identity", { themeId: "academic" });
    state = next(state);
    expect(state.step).toBe("sections");

    state = back(state);
    expect(state.step).toBe("identity");
    expect(state.data.identity).toEqual({ themeId: "academic" });

    state = back(state);
    expect(state.step).toBe("basics");
    expect(state.data.basics).toEqual({
      name: "HISTORIPOL",
      foundedYear: 2024,
    });
  });
});

describe("jumpTo()", () => {
  test("can jump back to any earlier step (e.g. via the step indicator)", () => {
    let state: WizardState = createInitialState();
    state = patch(state, "basics", { name: "Org" });
    state = next(state);
    state = next(state);
    state = next(state); // content

    const jumped = jumpTo(state, "basics");
    expect(jumped.step).toBe("basics");
    // Forward state preserved on the data side.
    expect(jumped.data.basics?.name).toBe("Org");
  });

  test("refuses to jump forward past steps that are not yet valid", () => {
    const state = createInitialState();
    // basics is empty → cannot jump to identity
    const jumped = jumpTo(state, "identity");
    expect(jumped.step).toBe("basics");
  });

  test("can jump forward to a later step when all intermediate steps are valid or optional-skipped", () => {
    let state: WizardState = createInitialState();
    state = patch(state, "basics", { name: "Org" });
    // identity, sections, content, languages are optional
    const jumped = jumpTo(state, "confirm");
    expect(jumped.step).toBe("confirm");
  });
});

describe("patch() — mutating per-step data", () => {
  test("merges into the active step's slot without touching other steps", () => {
    const state = createInitialState();
    const patched = patch(state, "basics", { name: "HISTORIPOL" });
    expect(patched.data.basics).toEqual({ name: "HISTORIPOL" });
    expect(patched.data.identity).toBeUndefined();
  });

  test("subsequent patches merge field-by-field", () => {
    let state: WizardState = createInitialState();
    state = patch(state, "basics", { name: "Org" });
    state = patch(state, "basics", { foundedYear: 2024 });
    expect(state.data.basics).toEqual({ name: "Org", foundedYear: 2024 });
  });

  test("returns a fresh state object (no in-place mutation)", () => {
    const state = createInitialState();
    const patched = patch(state, "basics", { name: "Org" });
    expect(patched).not.toBe(state);
    expect(patched.data).not.toBe(state.data);
  });
});

describe("reset()", () => {
  test("returns to the initial state regardless of progress", () => {
    let state: WizardState = createInitialState();
    state = patch(state, "basics", { name: "Org" });
    state = next(state);
    state = next(state);
    expect(state.step).toBe("sections");

    const fresh = reset();
    expect(fresh.step).toBe("basics");
    expect(fresh.data.basics).toBeUndefined();
  });
});

describe("isStepOptional()", () => {
  test("'basics' is mandatory (org name is required)", () => {
    expect(isStepOptional("basics")).toBe(false);
  });

  test("'identity', 'sections', 'content', 'languages' are optional (skip-able)", () => {
    expect(isStepOptional("identity")).toBe(true);
    expect(isStepOptional("sections")).toBe(true);
    expect(isStepOptional("content")).toBe(true);
    expect(isStepOptional("languages")).toBe(true);
  });

  test("'confirm' is mandatory (the final step always renders)", () => {
    expect(isStepOptional("confirm")).toBe(false);
  });
});

describe("isStepValid()", () => {
  test("'basics' requires a non-empty org name", () => {
    let state: WizardState = createInitialState();
    expect(isStepValid(state, "basics")).toBe(false);

    state = patch(state, "basics", { name: "" });
    expect(isStepValid(state, "basics")).toBe(false);

    state = patch(state, "basics", { name: "Org" });
    expect(isStepValid(state, "basics")).toBe(true);
  });

  test("optional steps are valid even without data (empty == valid)", () => {
    const state = createInitialState();
    expect(isStepValid(state, "identity")).toBe(true);
    expect(isStepValid(state, "sections")).toBe(true);
    expect(isStepValid(state, "content")).toBe(true);
    expect(isStepValid(state, "languages")).toBe(true);
  });

  test("languages step requires the secondary language to differ from the default when bilingual", () => {
    let state: WizardState = createInitialState();
    state = patch(state, "languages", {
      mode: "bilingual",
      defaultLanguage: "ro",
      secondaryLanguage: "ro",
    });
    expect(isStepValid(state, "languages")).toBe(false);

    state = patch(state, "languages", { secondaryLanguage: "en" });
    expect(isStepValid(state, "languages")).toBe(true);
  });

  test("confirm is valid only when basics.name is set", () => {
    let state: WizardState = createInitialState();
    expect(isStepValid(state, "confirm")).toBe(false);

    state = patch(state, "basics", { name: "Org" });
    expect(isStepValid(state, "confirm")).toBe(true);
  });
});

describe("isStepComplete()", () => {
  test("a step is complete when all required fields are filled", () => {
    let state: WizardState = createInitialState();
    expect(isStepComplete(state, "basics")).toBe(false);

    state = patch(state, "basics", { name: "Org" });
    expect(isStepComplete(state, "basics")).toBe(true);
  });

  test("optional steps with no data are complete (skipped == complete)", () => {
    const state = createInitialState();
    expect(isStepComplete(state, "identity")).toBe(true);
  });
});

describe("step ordering helpers", () => {
  test("STEPS round-trips: every step appears exactly once", () => {
    const seen = new Set<WizardStep>();
    for (const step of STEPS) seen.add(step);
    expect(seen.size).toBe(STEPS.length);
  });
});

describe("end-to-end: a happy-path traversal", () => {
  test("a wizard run ends on 'confirm' with all data captured", () => {
    let state: WizardState = createInitialState();

    state = patch(state, "basics", {
      name: "HISTORIPOL",
      tagline: "Studenții care vor să schimbe lumea.",
      foundedYear: 2024,
    });
    state = next(state);
    expect(state.step).toBe("identity");

    state = patch(state, "identity", { themeId: "academic" });
    state = next(state);
    expect(state.step).toBe("sections");

    state = patch(state, "sections", {
      mandatory: ["hero", "richText", "valueList", "activitiesList", "teamGrid", "contactCard"],
    });
    state = next(state);
    expect(state.step).toBe("content");

    state = patch(state, "content", { skip: true });
    state = next(state);
    expect(state.step).toBe("languages");

    state = patch(state, "languages", {
      mode: "single",
      defaultLanguage: "ro",
    });
    state = next(state);
    expect(state.step).toBe("confirm");

    expect(isStepValid(state, "confirm")).toBe(true);
    const data: WizardData = state.data;
    expect(data.basics?.name).toBe("HISTORIPOL");
    expect(data.identity?.themeId).toBe("academic");
  });
});
