# Editor theming UI — handoff

**State as of handoff (2026-05-07):**

- Spec committed and pushed: `docs/superpowers/specs/2026-05-07-editor-theming-ui-design.md` (commit `6b56e73`).
- Plan committed and pushed: `docs/superpowers/plans/2026-05-07-editor-theming-ui.md` (commit `5cb8a8d`).
- `main` is at `5cb8a8d`, up to date with `origin/main`.
- **No implementation has started.** Five PRs are queued; nothing is on a branch yet.

This file is **untracked** — don't commit. Delete when implementation is complete.

The pre-existing `MERGE_HANDOFF.md` from the prior orchestration is **also still
present and unfinished** (its three follow-ups never landed). Read both files at
the start of the next session — `MERGE_HANDOFF.md` follow-up #2 is a transitive
blocker for this plan's PR 5.

---

## TL;DR — what's left

```
1. (optional, but recommended) Land MERGE_HANDOFF.md follow-ups #1 + #2
2. PR 1: Theme registry (@sosb/themes)                  — pure additive
3. PR 2: Contrast util (@sosb/editor-app)               — pure additive
4. PR 3: <ThemeEditor> component (@sosb/editor-app)     — pure additive (not yet mounted)
5. PR 4: spine-form carve-out                           — UI is now visible to users
6. PR 5: e2e theming spec                               — round-trip test conditional on #2
```

Five PRs. Each is its own commit per the plan. Each contains TDD-shaped tasks
(write failing test → run, confirm fail → implement → run, confirm pass →
commit). The plan document is self-contained — it has full code for every
step and exact `pnpm` / `git` commands.

The plan invites the user to fill in three small content/judgment-call
sections during PR 1 + PR 3 (theme RO/EN descriptions, density/radius scale
values, font dropdown candidates). All three are marked `TODO:` in the
prepared code so they're easy to find.

---

## Where everything is

| Artifact                            | Path                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------- |
| Spec (design)                       | `docs/superpowers/specs/2026-05-07-editor-theming-ui-design.md`            |
| Plan (5 PRs, TDD steps, full code)  | `docs/superpowers/plans/2026-05-07-editor-theming-ui.md`                   |
| PRD (source of truth)               | `docs/PRD.md` — §41–46 covers the theming user stories                     |
| Existing renderer theme constants   | `packages/renderer/src/themes/*.ts`                                        |
| Existing token pipeline (untouched) | `packages/renderer/src/tokens.ts` (`emitTokenRoot`)                        |
| Existing schema (untouched)         | `packages/schema/src/site.ts` (`ThemeTokensSchema`, `ThemeSchema`)         |
| Existing wizard theme picker        | `packages/wizard/src/steps/identity.tsx` (PR 1 replaces its local THEMES)  |
| Existing editor spine-form          | `packages/editor-app/src/spine-form.tsx` (PR 4 adds the carve-out)         |
| Per-theme axe-core gate (must pass) | `e2e/a11y.spec.ts` (must keep passing — PR 1 is the only refactor it sees) |

---

## Hard prerequisites before starting

1. **Branch hygiene.** Each PR lands on its own branch off `main`. Use the
   project's pattern (the prior orchestration used `issue/N-feature` names;
   for this work, `theming/pr-1-registry`, `theming/pr-2-contrast`, etc., is
   fine since these aren't tied to existing GitHub issues).
2. **Prerequisites pass.** Before opening any PR, run
   `pnpm typecheck && pnpm lint && pnpm test`. CI runs the same checks; pre-
   running locally avoids review-cycle churn.
3. **`gh pr edit --base main` reflex.** Per `MERGE_HANDOFF.md`'s lessons-
   learned: any PR with a non-`main` base gets retargeted before
   `gh pr merge`. Apply unconditionally to avoid the lost-merge bug that
   bit #54 / #59 / #62.

---

## PR-by-PR scope and risk

### PR 1 — Theme registry (low risk)

**Files changed:**

- New: `packages/themes/src/registry.ts`, `packages/themes/test/registry.test.ts`
- Modified: `packages/themes/src/index.ts`, `packages/wizard/src/steps/identity.tsx`,
  `packages/wizard/package.json`, `pnpm-lock.yaml`

**Why low risk:** Pure additive at the package-export level. The wizard's
theme picker behavior is preserved exactly (same `data-field` attributes,
same `data-testid="theme-list"`, same patches). The renderer is untouched.

**The one thing that could surprise you:** Modern theme stores its tokens
inline in the CSS string today (no exported record). The registry hardcodes
`MODERN_INLINE_DEFAULTS` and the registry test asserts they match what the
renderer actually emits. If the assertion fails after this PR, someone
edited modern.ts's CSS without updating the inline copy — fix one or the
other.

**Reference user contribution:** Theme RO/EN descriptions in
`packages/themes/src/registry.ts`. The plan ships my best guess; the user
may want punchier copy. ~120 words total across 5 themes × 2 langs.

### PR 2 — Contrast util (low risk)

**Files changed:**

- New: `packages/editor-app/src/contrast.ts`, `packages/editor-app/test/contrast.test.ts`
- Modified: `packages/editor-app/package.json` (add `@sosb/themes` dep),
  `packages/themes/test/registry.test.ts` (drift guard), `pnpm-lock.yaml`

**Why low risk:** Standalone module, no UI integration. WCAG luminance
formula is well-defined; the test corpus (black/white, identical, symmetric,
yellow-on-white, malformed input) covers the failure modes.

**The bg-override table.** `PER_THEME_BG_OVERRIDES` in `contrast.ts`
duplicates "academic ships parchment, civic ships warm-cream" — both
already declared in their respective theme modules. The drift test
asserts this stays in sync. If a theme PR ever changes its bg, both
places update.

### PR 3 — `<ThemeEditor>` component (medium risk)

**Files changed:**

- New: `packages/editor-app/src/theme-editor.tsx`, `packages/editor-app/test/theme-editor.test.tsx`

**Why medium risk:** The largest of the five. Four sub-components
(`<ThemePicker>`, `<TokenForm>`, `<ContrastWarning>`,
`<ResetToThemeDefaults>`), each with its own tests. The plan splits this
into 8 tasks (3.1–3.8) so each sub-component lands in a small, testable
slice before the next one starts.

**Not yet mounted.** This PR adds the component but does not yet wire it
into `spine-form`. PR 4 does that. Keeping mount and component as
separate PRs lets you test the component in isolation before exposing it
to users.

**Reference user contributions:**

- `DENSITY_OPTIONS` and `RADIUS_OPTIONS` arrays — the named-scale values
  are designer judgment.
- `FONT_OPTIONS` array — system-font stacks chosen for cross-platform
  niceness. PRD §80 forbids third-party scripts (so no Google Fonts).

### PR 4 — Spine-form carve-out (low risk, high visibility)

**Files changed:**

- Modified: `packages/editor-app/src/spine-form.tsx` (two-line change in
  the `case "object":` branch)
- Modified: `packages/editor-app/test/theme-editor.test.tsx` (add the
  spine-form integration test)

**Why low risk in code, high in visibility:** The diff is two lines. But
it's the moment the new UI appears in the editor for end users. Manual
smoke test: open the editor, confirm `<fieldset legend="Theme">` is
visible inline in the spine form.

**Watch out for:** The carve-out is by-path (`["theme"]`), not by-name.
If the schema's `theme` field were ever renamed, the carve-out silently
fails open and the spine form goes back to rendering generic inputs.
v1.x is additive-only per PRD, so this is theoretical.

### PR 5 — E2E + site-CSS round-trip (medium risk, partially blocked)

**Files changed:**

- New: `e2e/theming.spec.ts`
- Modified (untracked): `MERGE_HANDOFF.md` (append a re-enable breadcrumb
  for the skipped test)

**Why medium risk:**

1. Playwright e2e tests are environment-fragile. The first test (theme
   switch updates iframe preview) depends on the browser-shell entry
   selectors. If they've shifted, the spec needs `getByRole`/
   `getByTestId` adjustments.
2. The second test (custom token → exported `dist/index.html`) is
   `test.skip`'d because the export path runs through
   `packages/assets/src/canvas-processor.ts` etc. — files that don't
   exist on `main` per `MERGE_HANDOFF.md` follow-up #2. Re-enabling this
   test requires that follow-up to land first.

**The site-CSS verification piece** the user explicitly called out
("don't forget site css") is captured by this skipped test plus a
breadcrumb in `MERGE_HANDOFF.md` so it gets re-enabled later.

---

## Three "user contribution" sites — quick reference

These are decisions the plan punts to the user during implementation. Each
is 5–10 lines of code. The plan ships defaults that work, but the user
flagged interest in shaping them.

### 1. Theme RO/EN descriptions

Where: `packages/themes/src/registry.ts` (PR 1, Task 1.2).

Defaults shipped (English):

- Academic — "Institutional, restrained — fits research societies and honors programs."
- Modern — "Clean, contemporary, breathing room — fits youth-focused programs."
- Editorial — "Magazine-style typography for storytelling-heavy orgs."
- Civic — "Civic, institutional tone — campaigns, advocacy, community."
- Minimal — "Quiet, neutral — gets out of your content's way."

Trade-off: punchy ("Senate-floor gravitas") risks pretentious; bland
("Blue with serif headings") fails to differentiate. The defaults aim
between.

### 2. Density / radius scale values

Where: `packages/editor-app/src/theme-editor.tsx`, `DENSITY_OPTIONS` and
`RADIUS_OPTIONS` arrays (PR 3, Task 3.4).

Defaults: density `0.85 / 1 / 1.15` named compact/comfortable/spacious;
radius `0px / 4px / 8px / 16px` named square/subtle/rounded/soft.

Trade-off: tighter ranges (`0.9 / 1 / 1.1`) look subtle; wider ranges
(`0.7 / 1 / 1.3`) risk visual breakage at the extremes. The shipped
themes' baselines (civic 2/3/4 px, academic 2/4/6 px, modern 8 px,
minimal 0 px) inform what "subtle" / "rounded" should feel like.

### 3. Font dropdown candidates

Where: `packages/editor-app/src/theme-editor.tsx`, `FONT_OPTIONS` array
(PR 3, Task 3.4).

Defaults: 5 stacks — Georgia / Iowan-Charter / system-sans / Inter /
Helvetica. All system-only per PRD §80.

Trade-off: more options = more expressiveness but more rope; fewer =
safer aesthetic outcomes. The current 5 cover serif vs. sans, with
Inter offering a more "modern" sans option.

---

## Outstanding blockers from `MERGE_HANDOFF.md` (still relevant)

These are not new findings — they're carried forward from the prior
orchestration. Reading them here so the next session has full context:

1. **`cta-banner.tsx` NPE on optional button.** 1-line fix at
   `packages/renderer/src/blocks/cta-banner.tsx:34`. Causes ~27 test
   failures across packages/themes/test and packages/build/test. Not a
   blocker for this plan's PRs 1–4, but `pnpm test` will be red until
   it lands. Fix it first if you want green CI during theming work.

2. **`packages/assets/src/index.ts` browser pipeline lost-merge.** Issue
   #54 was reported MERGED but landed on a stacked base, leaving
   `index.ts` re-exporting from non-existent files. **This is the
   blocker for PR 5's site-CSS round-trip test.** Recovery is the same
   pattern as #59: cherry-pick from `origin/issue/8-asset-pipeline-browser`
   onto a fresh branch, resolve conflicts, open PR.

3. **~30 stale bare `ADR NNNN` references.** Cosmetic, deferrable.
   Doesn't affect this plan.

---

## Recommended order for the next session

If green CI matters during the work:

```
A. MERGE_HANDOFF.md #1 (cta-banner NPE)        — 5 min, 27 tests come back
B. MERGE_HANDOFF.md #2 (assets recovery)        — ~30 min, unblocks PR 5
C. THEMING plan PR 1 (registry)                 — pure additive
D. THEMING plan PR 2 (contrast util)            — pure additive
E. THEMING plan PR 3 (ThemeEditor component)    — largest PR
F. THEMING plan PR 4 (spine-form carve-out)     — UI now visible
G. THEMING plan PR 5 (e2e)                      — round-trip test now works
```

If you're comfortable with `pnpm test` red until the very end:

```
A. THEMING plan PR 1 → 4 (theming UI ships)
B. MERGE_HANDOFF.md #1 + #2
C. THEMING plan PR 5 (e2e, both tests now active — remove the .skip)
```

I'd take option (A→G). Five minutes to fix #1 buys you green CI for
every subsequent PR.

---

## What "done" looks like

```bash
cd "C:/Users/rdobr/Documents/anosr-site-builder"

pnpm typecheck && pnpm lint && pnpm test
# expect: 0 failed test files, 0 failed tests

pnpm exec playwright test
# expect: all e2e green; theming round-trip passes (after #2 + .skip removed)

pnpm --filter @sosb/browser-shell dev
# Open the dev URL.
# Walk through the manual checklist in the plan's "After PR 5" section:
#   1. Pick each of the 5 themes; preview updates each time.
#   2. Customize → poor-contrast color → warning appears.
#   3. Reset → confirm dialog → tokens cleared.

# If all green and the manual walkthrough is clean:
rm THEMING_HANDOFF.md
# (and rm MERGE_HANDOFF.md if its three items also done)
```

---

## Lessons from this session worth remembering

1. **The spec became more correct by writing the plan.** The original
   spec implied a renderer refactor that turned out to be unnecessary
   once I read the actual theme files (their token shapes diverge).
   Amending the spec inline rather than carrying the refactor forward
   saved the next session from a wrong architectural premise.
2. **The pre-write security hook fires on substring matches in markdown
   too.** A regex `.match(...)` call rendered in a code-block in the
   plan was enough to trip it — twice. Worth knowing when authoring
   plan documents that include code samples.
3. **PRD §80's "no third-party scripts by default" propagates.** It
   ruled out Google Fonts in the FONT_OPTIONS list before I even got to
   the user. The PRD's discipline pays off when downstream design
   decisions can be answered by reference.
