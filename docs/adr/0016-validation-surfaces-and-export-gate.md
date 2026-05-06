# 0008 — Validation surfaces (Site Health panel, health footer, export gate)

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #25

## Context

Issue #25 wires the schema's three severity tiers
(`error` / `warning` / `info`, defined by ADR 0002) end-to-end in the
editor:

- Errors, warnings, and info each render distinctly.
- A Site Health panel lists every issue across the site with severity,
  location, and a quick-fix link.
- Clicking an issue navigates the editor to the offending field.
- A pre-export confirmation dialog summarises errors/warnings; errors
  require typed confirmation but never hard-block (manual override per
  PRD).
- A footer indicator shows aggregate counts.
- The build pipeline runs the same validation; errors fail the build,
  warnings are logged.

The PRD pins:

- Severity model and what each tier means (Implementation Decisions →
  Schema validation & severity).
- Manual-override pattern for errors (PRD: "high-friction confirmation,
  but never hard-block").
- Validation lives in `@sosb/schema`'s `validate()` (already shipped
  in #3); this issue is editor-side polish + a build-time gate.

The PRD does **not** pin:

- The DOM shape of the panel / footer / dialog.
- The "manual override" friction mechanism (modal? typed phrase? a
  confirmation chain?).
- How "click an issue" finds the corresponding form field.
- How the build pipeline surfaces warnings.

This ADR records those choices.

## Decision

### Three small Preact components, one shared navigation helper

- `SiteHealthPanel` (`packages/editor-app/src/site-health.tsx`) — renders
  a `ValidationResult` as three grouped lists (Errors / Warnings / Info).
  Every issue is a real `<button>` so it's keyboard-activable and the
  default focus ring lights up.
- `HealthFooter` (`packages/editor-app/src/health-footer.tsx`) — always
  visible. Renders aggregate counts, a single toggle button. ARIA
  disclosure pattern (`aria-controls` + `aria-expanded`) drives the
  panel.
- `ExportConfirmDialog` (`packages/editor-app/src/export-confirm.tsx`) —
  WAI-ARIA dialog (`role="dialog"`, `aria-modal="true"`). Two flows:
  errors-present (typed-phrase gate) vs. warnings-only (single click).
- `navigateToIssue(root, issue)`
  (`packages/editor-app/src/issue-navigate.ts`) — pure helper. Maps a
  `ValidationIssue.path` to a DOM selector and focuses the matching
  spine-form input.

Each component takes a `ValidationResult` plus narrow callbacks
(`onJump`, `onToggle`, `onConfirm`/`onCancel`) — no dependency on the
editor's state, so they unit-test in isolation under jsdom + Preact
without mounting `EditorApp`.

### Markup contract: data attributes, not classes

Every issue row across the panel and the dialog emits the same data
attributes:

```html
<button
  data-issue
  data-severity="error|warning|info"
  data-path="pages.1.slug"
  data-code="site.page.slug.duplicate"
>
  ...
</button>
```

This contract is what the click-to-jump test, the axe-clean test, and
future styling all hook into. Tests assert the contract; classes are
free to change.

The footer mirrors the same idea with `data-count="error|warning|info"`
spans containing the integer + label.

### Click-to-jump strategy: longest-prefix match against `[data-field=...]`

The spine form (#7) emits `[data-field="org.email"]`,
`[data-field="theme.tokens.colorPrimary"]`, etc. for every leaf input.
`navigateToIssue` walks the issue path from longest to shortest and
picks the first selector that resolves. So:

- An issue at `pages.0.slug` lands on `[data-field="pages.0.slug"]`
  once page-form work (a future issue) renders that input.
- Today, the same issue falls back to `[data-field="pages.0"]` →
  `[data-field="pages"]` (the array summary the spine form already
  renders), so the click "does something" rather than nothing.
- An issue at `org.email` lands on the existing
  `[data-field="org.email"]` input — exercised by the
  `editor-validation-wiring` test.

The fallback is the "quick-fix link" of the AC: the user lands as close
to the offending field as the current form surface allows. Block forms
(#9-#22) extend this naturally — they just need to follow the same
`data-field` convention.

Rejected:

- **An explicit issue → field map maintained per-issue-code.** Forces
  every new validation rule to update two places. The `data-field`
  convention is already in place; reusing it is free.
- **Scrolling without focusing.** Fails for keyboard-first users — the
  next Tab press would jump back to the panel rather than continue
  through the form. Focus carries the cursor with it.

### Pre-export gate: typed-phrase override (errors), single-click (warnings)

When the user clicks Export:

| Snapshot state         | Behaviour                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| no errors, no warnings | `onExport` fires immediately, no dialog                                                                    |
| warnings only          | dialog opens; "Export anyway" enabled immediately                                                          |
| errors present         | dialog opens; user must type the literal phrase **`EXPORT`** into a textbox before "Export anyway" enables |

The typed phrase is the "high-friction confirmation" the PRD asks for —
a single-button confirmation is too easy to mis-click; a typed phrase
forces deliberate intent without ever hard-blocking the user (manual
override is preserved).

Rejected:

- **A confirmation chain (two consecutive Yes/No dialogs).** Too easy
  to muscle-memory through both clicks; defeats the friction goal.
- **Disabled Export button until errors are fixed.** Hard-blocks
  publishing — the PRD explicitly forbids that ("never hard-block,
  manual override allowed").
- **Localised override phrases.** Editor i18n is owned by #34; v1 ships
  English-only. The phrase "EXPORT" is acceptable in any language as
  a literal token.

### Validation in the build pipeline

`@sosb/build` now runs `validate(site)` before rendering:

- Errors throw `BuildValidationError` (the new exported class) carrying
  the full error list. Callers (the editor's export path, CI, the
  Electron shell) catch the throw and surface the issues to the user.
- Warnings flow through an optional `onWarning` reporter that the build
  caller plugs in. The default behaviour (no reporter) silently drops
  warnings — same severity model as the editor (warnings don't block).
- A `skipValidation: true` escape hatch exists for callers that have
  already validated and don't want to pay the cost twice.

The build integration is intentionally narrow: the build module does
NOT decide how to log warnings. That's the host's job (the editor's
export flow, the CLI's stderr stream, the CI workflow's summary). This
keeps the build module deterministic and pure: same `(site, options)`
input, same output.

Rejected:

- **`console.warn` inside the build module.** Couples the build module
  to a global side-effect surface that's awkward to test and that
  pollutes tooling that runs many builds. The reporter callback gives
  the same observability without the side effect.
- **`process.exit(1)` on errors.** Makes the build module
  Node-specific. The build runs in the browser editor too — throwing
  is the right unified contract.

### `validate(site)` recomputed inside `EditorApp`, not stored

`EditorApp` keeps the `ValidationResult` in a `useMemo` keyed on the
current snapshot. `validate()` is fast (sub-ms on the v1 fixtures) and
synchronous — no need to background-thread it, no need to cache it
across edits, no need for a separate event channel.

The footer, panel, and export-dialog all read the same memoised result,
so they stay perfectly in sync without any extra plumbing.

## Rationale

The most subtle requirement is the "click navigates editor to the
relevant block/page" AC. Two designs satisfy it:

1. **Symbolic mapping**: every validation rule registers an explicit
   "jump target" alongside its `code`. The panel reads this map to
   navigate.
2. **Path-as-selector**: the issue's `path` is the navigation target.
   The form generator emits `data-field="<dotted.path>"`. The panel
   walks longest-prefix matches.

We chose (2) because (a) it requires no schema-side changes, (b) it
already works for the spine form's outputs, and (c) future block forms
get the navigation behaviour for free — they just need to keep the
`data-field` convention. The cost is that paths into not-yet-rendered
parts of the form (e.g. block-internal fields when block forms haven't
landed) fall back to the closest rendered ancestor — which is "good
enough" navigation for v1 and improves as block forms ship.

The typed-phrase gate is the cheapest design that distinguishes a
deliberate override from an accidental one. It's small, has zero
external dependencies, and screen-readers handle it natively (it's
just a textbox + a button). No modal-management library needed.

The decision to layer validation into the build pipeline (rather than
asking callers to gate themselves) is what closes the AC #6 loop:
errors fail the build everywhere — editor export, CLI, CI — without
each caller having to remember to `validate()` first.

## Consequences

- `pnpm -F @sosb/editor-app add -D axe-core@^4.11.4` is run inside the
  worktree; the editor-app package now carries axe-core as a dev
  dependency for the new accessibility tests (`site-health-axe.test.tsx`).
- `@sosb/editor-app` exports four new symbols
  (`SiteHealthPanel`, `HealthFooter`, `ExportConfirmDialog`,
  `navigateToIssue`) so embedding shells can compose their own chrome
  if they don't want the bundled `EditorApp`.
- `@sosb/build` exports a new `BuildValidationError` class and a new
  `BuildOptions.onWarning` callback. Existing call sites that pass no
  options keep working unchanged (the validation defaults to `on`,
  warnings are silently dropped if no reporter is given).
- Editor-side validation runs `validate()` on every snapshot change.
  On the v1 fixtures this is microseconds; if the site grows large
  enough that this becomes a hotspot, the same memo can be moved
  behind a debounce — the public API stays the same.
- The data-attribute markup contract
  (`data-issue` / `data-severity` / `data-path` / `data-code`) is
  load-bearing: tests assert it, axe relies on the resulting structure,
  and future styling will hook into it.

## Alternatives considered

- **Render the panel inline in the editor pane (no toggle).** Eats
  vertical space and hides the form on narrow viewports. The footer +
  toggle is the better fit for the PRD's narrow-viewport rules.
- **Use a generic dialog component library.** Adds a runtime
  dependency for behaviour we can express in 50 lines. The dialog is
  small enough to hand-code and stays auditable.
- **Hard-block export on errors instead of typed-phrase override.**
  Violates the PRD: "errors require explicit confirmation but never
  hard-block (manual override pattern from PRD)."
- **Live-validate per-field as the user types and surface errors
  inline next to each input.** Out of scope here — this issue is the
  panel + footer + export gate. Per-field markers are a future issue
  (the schema's `validate()` already produces the data; the form
  generator can decorate inputs once that issue lands).

## Out of scope

- Per-field error markers next to inputs (future issue: per-field
  validation UI).
- Localised messages: validation messages remain English in v1; i18n
  is owned by #34 and overlays by `code`.
- Auto-fix actions: only quick-fix navigation (jump to the offending
  field), not modification of the data — explicitly out-of-scope per
  the issue triage notes.
- Validation telemetry / aggregation across sites — out of scope per
  triage.
- Custom severity definitions per org — severity tiers stay fixed at
  error/warning/info per PRD.
