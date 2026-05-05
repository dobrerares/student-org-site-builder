# 0007 — Wizard state machine and progress persistence

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #33

## Context

Issue #33 asks for the **6-step guided onboarding wizard** that the
welcome screen (#32) hands off to. Per the PRD's wizard section:

> Six steps: basics → identity → sections → content → languages →
> confirm. State persisted per step. Output is normal site data (no
> wizard-only schema).

The triage AC explicitly require:

- Wizard renders all six steps with appropriate forms.
- Back/Next navigation preserves state per step.
- State persists across page reloads / app restarts mid-wizard.
- "Skip" available on optional steps.
- Final confirm step previews the site, then "Create" opens it in the
  editor.
- Wizard can be cancelled at any step (with confirmation).

The PRD pins the user-facing shape but does **not** pin:

- The state machine implementation (XState? hand-rolled? `useReducer`?).
- How progress is persisted across reload (`localStorage`, IndexedDB,
  the existing VFS abstraction, a new bespoke store?).
- Where the wizard package lives in the monorepo and what its public
  surface looks like for the host shells.
- How the wizard's output is handed off to the editor.

This ADR records those choices.

## Decision

### Hand-rolled state machine in `@sosb/wizard`, no library

The wizard state is a discriminated record:

```ts
interface WizardState {
  step: "basics" | "identity" | "sections" | "content" | "languages" | "confirm";
  data: WizardData; // per-step slots, all optional
}
```

The transition functions are pure functions over that state:

- `next(state)` — advance one step, refusing if the active step is
  mandatory and not yet valid.
- `back(state)` — retreat one step (no-op on `basics`).
- `jumpTo(state, target)` — jump to any step; forward jumps require
  every intermediate step to be valid.
- `patch(state, step, partial)` — merge partial input into the per-step
  data slot.
- `reset()` — return to a fresh state.
- `isStepValid(state, step)` / `isStepOptional(step)` /
  `isStepComplete(state, step)` — predicates the UI uses to enable
  buttons.

The functions never mutate; each returns a fresh state object. This
matches the project's existing pure-function discipline (`@sosb/schema`,
`@sosb/zip`, `@sosb/build`).

Rejected:

- **XState** — adds a non-trivial runtime dependency (~12kb), an extra
  configuration DSL, and surfaces only a fraction of its features
  (statecharts, parallel states, history) for what is effectively a
  6-node linear FSM with two transitions. The PRD's "Lighthouse 95+,
  no client framework on built sites" stance argues for the lighter
  hand-rolled approach.
- **`useReducer` inside the Preact shell** — keeps the state machine
  framework-bound, breaking node-runnable unit tests and forcing every
  caller to mount Preact even to advance the machine. The current split
  lets `state-machine.ts` run in plain node (the unit tests confirm),
  while `wizard.tsx` is the Preact binding.
- **A separate state machine package** (`@sosb/state-machine`) — the
  machinery is 200 lines and only one consumer exists. Pulling it out
  would invent a cross-package import for no isolation gain.

### VFS-backed persistence, caller-injected driver

The wizard's progress lives in the host's VFS at a stable path:

```ts
WIZARD_PROGRESS_PATH = "wizard/progress.json";
```

`saveWizardProgress(vfs, state)` writes the state to that path;
`loadWizardProgress(vfs)` reads it back; `clearWizardProgress(vfs)`
deletes it (called on "Create" or on host-confirmed "Cancel").

The VFS abstraction means the wizard package itself does not depend on
`localStorage` or IndexedDB or Electron-FS. The host shells inject the
appropriate driver:

- Browser shell wires a localStorage-backed VFS (or the future OPFS /
  IndexedDB driver from #35 / #37) once they land.
- Electron shell wires a real-FS VFS driver.
- Tests wire `MemoryDriver`.

This mirrors the persistence strategy of `@sosb/editor-state`'s autosave
(ADR 0005) and `@sosb/editor-app`'s recent-sites store (ADR 0006).
Three persistence surfaces, one storage abstraction.

Rejected:

- **`localStorage` directly inside the wizard module.** Forces a
  browser context on the package, breaks node-runnable tests, and
  would create a third independent storage layer (after editor-state's
  autosave and recent-sites). The VFS is the standardised abstraction.
- **In-memory only, defer persistence to a follow-up.** Would leave
  the AC "State persists across page reloads / app restarts mid-wizard"
  unimplementable.
- **A dedicated wizard storage schema (Dexie, sql.js).** Vastly
  over-engineered for a single-file flow that only ever has one row.

### `loadWizardProgress` returns null on any malformed input

The loader is conservative: it returns `null` if the file is missing,
JSON-malformed, structurally wrong, or carries an unknown `step` id
(e.g. saved by a future wizard version with a renamed step). The
`<Wizard>` shell treats `null` as "start fresh".

This is the safest fallback for a UI surface where corrupted state
should never crash the welcome screen — and aligns with how
`@sosb/editor-app`'s `loadRecentSites` handles malformed files.

### Per-step validators are owned by the state machine, not the UI

Each step has a `isStepValid(state, step)` predicate that the UI
consumes to enable/disable Next, Skip, and Create. Per-step rules:

- `basics` — mandatory; requires non-empty `name`.
- `identity`, `sections`, `content` — optional; always valid.
- `languages` — optional; if user has chosen `bilingual` mode, the
  secondary language must differ from the default.
- `confirm` — mandatory; requires basics to be valid (so the build
  step can produce a Site with a non-empty org name).

Keeping validation in the state machine means the rules are
unit-testable without a DOM, and the same rules drive both the button
state in the UI and the persistence loader's "is this state still
valid after a code change" gate.

### `buildSiteFromWizard(data)` is the handoff to the editor

The Create button does not "open the editor" itself — that is the host's
job. Instead, the wizard builds a `Site` via `buildSiteFromWizard(data)`
and fires `onComplete(site)`. The host:

1. Receives the Site.
2. Persists it via the appropriate VFS.
3. Calls `clearWizardProgress(vfs)` to drop the in-flight wizard state.
4. Mounts `<EditorApp initial={site} />` with the new Site.

The mapper falls back to safe defaults wherever the user skipped a step:

- Missing org name → "My Organization" (covered by the state-machine
  refusing to advance, but the mapper is robust).
- Missing theme → `minimal`.
- Missing languages → single-language Romanian (PRD's primary).
- Missing sections / content → home page with a single hero block,
  matching `createBlankSite()`'s shape.

The output validates clean against `@sosb/schema`'s `validate()`. A
test asserts this on every shape variant the mapper supports.

Rejected:

- **The wizard mounts `<EditorApp>` itself.** Couples the wizard to
  the editor's lifecycle and breaks the host-owns-routing contract
  ADR 0006 already established.
- **The wizard writes the Site directly to the VFS.** Same problem;
  the host owns where new sites live.

### Public surface

```ts
// State machine (framework-agnostic)
STEPS, createInitialState, next, back, jumpTo, patch, reset,
isStepValid, isStepOptional, isStepComplete,
WizardStep, WizardData, WizardState (+ per-step types)

// Mapper
buildSiteFromWizard

// Persistence
WIZARD_PROGRESS_PATH, loadWizardProgress, saveWizardProgress, clearWizardProgress

// Preact shell
<Wizard initial onProgress onComplete onCancel />
```

The host wires `onProgress` to `saveWizardProgress`, `onComplete` to
its open-in-editor flow, and `onCancel` to the welcome-screen restore.

## Rationale

The most subtle requirement is "State persists across page reloads /
app restarts mid-wizard." Two designs satisfy it:

1. The wizard owns persistence directly (writes to localStorage on
   every state change).
2. The wizard fires an `onProgress` callback; the host writes to
   whatever VFS it chose.

We chose (2) because:

- It mirrors the auto-save persistence pattern from ADR 0005 and the
  recent-sites pattern from ADR 0006, keeping one storage abstraction
  across the editor.
- It keeps the wizard package node-testable without a DOM-storage
  polyfill.
- Browser and Electron need different storage backends anyway. The
  caller-chooses-driver pattern lets both hosts share the same wizard
  module.

The hand-rolled state machine (vs. XState) was chosen because:

- The flow is genuinely linear — six nodes, two transitions, no
  parallel states or history. XState's value comes from richer
  topologies.
- The PRD's quality bar ("no client framework on built sites,
  Lighthouse 95+") favours minimal runtime additions.
- The implementation is 200 lines and trivially readable. The pure
  functions transition cleanly across `useState` (UI), JSON (storage),
  and node (tests).

## Consequences

- A new `@sosb/wizard` package ships with two-tsconfig structure
  (build + test) matching every other Preact-using package.
- `pnpm -F @sosb/wizard add preact @sosb/schema @sosb/vfs` and
  `pnpm -F @sosb/wizard add -D @testing-library/preact jsdom
@types/jsdom` — handled by adding the deps to the package.json.
- The wizard's output is byte-identical (modulo the home-page block
  set) to `createBlankSite()` when run with no captured data, which
  keeps two onboarding paths converging on the same minimal shape.
- A future "themes preview" feature on the identity step plugs in
  without state-machine changes — the per-step components own their
  own UI complexity.
- Future host shells (browser-shell, electron-shell) add a tiny
  bootstrap that calls `loadWizardProgress` on welcome-screen mount,
  passes the result as `initial` to `<Wizard>`, and wires `onProgress`
  to `saveWizardProgress`.
- A Playwright `e2e/wizard.spec.ts` covers the wizard in a real
  browser; the unit tests under `packages/wizard/test/*.test.{ts,tsx}`
  cover the same logic against jsdom and node.

## Alternatives considered

- **XState.** See "Rejected" above. Re-evaluate if the wizard ever
  grows parallel states (e.g. an asynchronous "validate org name
  against an existing-orgs list" guard) or if multiple wizards in the
  app start to share machinery.
- **`useReducer` inside the Preact shell.** Forces every consumer to
  mount Preact, breaks pure-function unit tests, and inverts the
  separation of concerns the rest of the project follows.
- **`localStorage` write inside the wizard package.** Same browser-
  context / two-storage-layers problem the recent-sites ADR rejected.
- **A wizard-specific schema (`WizardData` ≠ `Site`).** The PRD
  explicitly says "Output is normal site data (no wizard-only schema)".
  Tracked here for posterity — the chosen design keeps `Site` as the
  single source of truth and `WizardData` as a write-only intermediate
  form.
- **Cancel-with-confirmation prompt inside the wizard.** Triage of #33
  acknowledges "cancellable at any step (with confirmation)" but the
  UX of the confirmation is host-owned (Electron native dialog vs.
  browser modal). The wizard surfaces `onCancel`; the host decides
  whether to confirm before dropping in-flight state.

## Out of scope

- Per-block forms invoked from the wizard's content step — those are
  per-block tickets (#9–#22), and the wizard's content step is
  intentionally a small "skip or write a hero title" affordance.
- Theme/template authoring inside the wizard — explicitly out per the
  triage of #33.
- Authentication / accounts / cloud-saved wizard state — out of scope.
- The host shells (browser-shell, electron-shell) wiring this module
  to a persistent VFS — owned by future issues. The wizard's contract
  is "I write progress through whatever VFS you give me".
- i18n of the wizard's English labels — owned by #34. v1 ships
  English-only.
- A welcome-screen confirmation dialog before launching the wizard —
  the welcome screen's `onWizard` callback already fires synchronously
  and the host can layer a confirmation if it wants.
