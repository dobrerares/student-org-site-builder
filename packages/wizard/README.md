# @sosb/wizard

6-step state machine + Preact UI for guided onboarding.

Tracking issue: #33. ADR 0007 records the design.

## Public surface

- `<Wizard initial onProgress onComplete onCancel />` — the Preact shell.
  The host (browser-shell / electron-shell) wires `onProgress` to
  `saveWizardProgress` for resume-across-reload, `onComplete` to its
  "open in editor" flow, and `onCancel` to the welcome-screen restore.
- State machine primitives — pure functions, framework-agnostic:
  `STEPS`, `createInitialState`, `next`, `back`, `jumpTo`, `patch`,
  `reset`, `isStepValid`, `isStepOptional`, `isStepComplete`.
- `buildSiteFromWizard(data)` — pure mapper from `WizardData` to a
  `Site` validated by `@sosb/schema`'s `validate()`.
- VFS-backed persistence: `WIZARD_PROGRESS_PATH`, `loadWizardProgress`,
  `saveWizardProgress`, `clearWizardProgress`.

## Six steps

1. **Basics** — org name (required), tagline, founded year.
2. **Identity** — theme pick (academic / modern / editorial / civic / minimal).
3. **Sections** — pick mandatory blocks for the home page.
4. **Content** — initial hero copy, or skip.
5. **Languages** — single or bilingual.
6. **Confirm** — preview summary, then "Create site" hands the host a
   valid `Site` object.

## Persistence

The wizard is resume-safe: every state transition fires `onProgress`,
which the host writes to a VFS via `saveWizardProgress`. On the next
launch the host calls `loadWizardProgress` and seeds `<Wizard initial>`
from the result. The VFS abstraction lets the browser host pick
localStorage / IndexedDB / OPFS and the Electron host pick real-FS,
without `@sosb/wizard` knowing.
