# Plan 005: Bring README/CONTRIBUTING back in line with reality; retire stale handoff files

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 176e34e..HEAD -- README.md CONTRIBUTING.md`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/004-browser-shell-dev-server.md (the CONTRIBUTING
  section documents the `pnpm dev` loop that plan creates)
- **Category**: docs
- **Planned at**: commit `176e34e`, 2026-06-12

## Why this matters

The two front-door documents are actively wrong, which is worse than missing:
`README.md`'s Status section says several packages "are placeholders" when
all 15 have landed real implementations (191 test files, 1912 passing tests),
and `CONTRIBUTING.md`'s "Running locally" section says the host shells "are
still being implemented" and promises a `pnpm dev` script that was never
added. A contributor following these docs mis-plans their work and dead-ends
on a non-existent script. Separately, three _untracked_ handoff files at the
repo root (`MERGE_HANDOFF.md`, `THEMING_HANDOFF.md`, `ASSET_PICKER_HANDOFF.md`)
describe work that has since shipped; each says "delete when done" — they are
done, and leaving them misleads every future agent session that reads the
repo root.

## Current state

- `README.md:128-137` — the stale Status section:

```markdown
## Status

This repository was created from an architectural grilling session that
produced the v1 specification. Several core packages have landed
(`@sosb/schema`, `@sosb/renderer`, `@sosb/vfs`, `@sosb/zip`, `@sosb/build`,
`@sosb/editor-state`, `@sosb/preview-bridge`, `@sosb/editor-app` and others
are placeholders); the remaining 15 blocks, 5 themes, multi-language flow,
and host shells are tracked in the issues backlog. Track v1 progress via
the [issues backlog](../../issues), with [`docs/PRD.md`](docs/PRD.md) as the
source of truth.
```

Reality (verified at planning time): all 15 packages under `packages/`
have real implementations; the 15 blocks, 5 themes (`minimal`, `modern`,
`editorial`, `civic`, `academic` + the `stub` dev fixture), i18n (RO/EN),
both host shells, the wizard, and the universal asset picker have landed;
`pnpm typecheck && pnpm test` is green (1912 tests).

- `CONTRIBUTING.md:39-55` — the stale "Running locally" section. It currently
  says: "There is no top-level 'run the app' script today: the editor app
  (`@sosb/editor-app`) is composed by a host shell … and those shells are
  still being implemented … When the host shells land they will expose
  `pnpm dev` entry points; that will be added here in the same PR." After
  Plan 004 lands, the real commands are:

  - `pnpm dev` (root) → Vite dev server for the browser editor at
    `http://localhost:5173`, seeded with the HISTORIPOL demo template,
    ephemeral session (no OPFS persistence in dev).
  - `pnpm --filter @sosb/browser-shell build:archival` → single-file
    `packages/browser-shell/dist/archival/builder.html` you can open
    directly in a browser.

- The three untracked handoff files and their self-declared completion
  criteria (each file says "This file is untracked — don't commit. Delete
  when … done"):

  | File                      | Claims outstanding                                                                                                                           | Verified status at planning time                                                                                                                                                                                           |
  | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `MERGE_HANDOFF.md`        | (1) cta-banner NPE breaking ~27 tests; (2) `packages/assets/src/index.ts` broken from a lost merge; (3) ~30 stale bare "ADR NNNN" references | (1) fixed — full suite green; (2) recovered — `packages/assets/src/index.ts` is the real pipeline (mime detect, hash, dedup, sidecar, alt enforcement); (3) **never done — must be captured before deletion** (see Step 3) |
  | `THEMING_HANDOFF.md`      | 5 theming-UI PRs queued, "no implementation has started"                                                                                     | Shipped — ThemeForm, theme picker, font/density/radius pickers, theme catalog all on `main` (commits `742ccdb`, `cff09ab`, `9832b34`, `854e3fe`, `11b5d69`, `652dc5d`)                                                     |
  | `ASSET_PICKER_HANDOFF.md` | Universal asset-picker rollout (scope D)                                                                                                     | Shipped — merged via `176e34e` ("Merge branch 'feat/universal-asset-picker'")                                                                                                                                              |

- Repo conventions: README/CONTRIBUTING are Prettier-formatted (`pnpm format`);
  prose links are relative; the project vocabulary comes from `CONTEXT.md`
  (say "Template" for the HISTORIPOL seed, "Site"/"Page"/"Block" capitalized
  as terms of art).

## Commands you will need

| Purpose               | Command                           | Expected on success |
| --------------------- | --------------------------------- | ------------------- |
| Format check          | `pnpm format:check`               | exit 0              |
| Format write          | `pnpm format`                     | exit 0              |
| Full suite (sanity)   | `pnpm test`                       | exit 0              |
| Verify handoff claims | `pnpm vitest run packages/assets` | all pass            |

## Scope

**In scope**:

- `README.md` (Status section only)
- `CONTRIBUTING.md` ("Running locally" section only)
- Deletion of `MERGE_HANDOFF.md`, `THEMING_HANDOFF.md`,
  `ASSET_PICKER_HANDOFF.md` (untracked files at repo root)
- `plans/README.md` (record the carried-over follow-up, Step 3)

**Out of scope** (do NOT touch):

- Any other README/CONTRIBUTING section (the i18n, a11y, release sections are
  accurate).
- `docs/PRD.md`, `CONTEXT.md`, ADRs — immutable/source-of-truth documents.
- The ~30 stale bare "ADR NNNN" references themselves (MERGE_HANDOFF
  follow-up #3) — capturing the task is in scope; doing the renumbering
  sweep is not.

## Git workflow

- Branch: `advisor/005-docs-truth-refresh`
- One commit, verb-first, e.g. `Update README status + CONTRIBUTING run
instructions to match shipped reality`.
- Deleting the three handoff files needs no git action (they are untracked) —
  but double-check with `git status` that they are indeed untracked before
  deleting.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Rewrite the README Status section

Replace the body of `## Status` in `README.md` (lines ~128-137) with text to
this effect (adjust wording freely, keep the facts):

> v1 implementation is substantially complete: all 15 workspace packages have
> landed real implementations — schema, renderer (15 blocks × 5 themes with a
> golden-file matrix), markdown, vfs, assets, zip round-trip, build pipeline,
> i18n (RO/EN), editor state, preview bridge, editor app with the universal
> Asset picker, wizard, themes, and both host shells (browser + Electron).
> Current work focuses on the theme visual refresh
> (`docs/superpowers/specs/2026-05-28-themes-pizzaz-design.md`) and items in
> the [issues backlog](../../issues). [`docs/PRD.md`](docs/PRD.md) remains the
> source of truth for scope.

**Verify**: `grep -n "are placeholders" README.md` → no matches.

### Step 2: Rewrite the CONTRIBUTING "Running locally" section

Replace the stale paragraph and bullet list at `CONTRIBUTING.md:39-55` with
the real instructions. Keep the existing bullets about `pnpm test`,
`pnpm test:watch`, `pnpm test:e2e`, and package-scoped builds (they are
correct); replace only the "no top-level run script / shells still being
implemented / will expose pnpm dev" prose with:

> - `pnpm dev` starts the browser editor on a local Vite server
>   (`http://localhost:5173`), seeded with the HISTORIPOL demo Template.
>   Dev sessions are ephemeral (no OPFS persistence); zip export/import
>   works normally.
> - `pnpm --filter @sosb/browser-shell build:archival` produces the
>   single-file editor at `packages/browser-shell/dist/archival/builder.html`
>   — open it directly in any browser.

**Precondition**: confirm Plan 004 actually landed (check that
`grep -n "\"dev\"" package.json` hits at the root). If it has not landed,
STOP — this step would document a script that doesn't exist, recreating the
original problem.

**Verify**: `grep -n "still being implemented" CONTRIBUTING.md` → no matches;
`pnpm format:check` → exit 0 (run `pnpm format` first if needed).

### Step 3: Capture MERGE_HANDOFF follow-up #3 before deleting

`MERGE_HANDOFF.md` follow-up #3 (cosmetic, never done): after the ADR
renumbering to slots 0032–0041, ~30 bare "ADR NNNN" references across the
repo may point at old numbers. Before deleting the file, append this entry to
the "Findings considered and rejected / carried over" section of
`plans/README.md`:

> - Carried over from MERGE_HANDOFF.md: sweep bare "ADR NNNN" references for
>   staleness after the 0032–0041 renumbering (~30 sites, cosmetic). Not
>   planned — low impact; grep `ADR 00(2[3-9]|3[0-1])` and spot-check if it
>   ever matters.

**Verify**: `grep -n "Carried over from MERGE_HANDOFF" plans/README.md` → one match.

### Step 4: Verify completion criteria, then delete the three handoff files

Run the verification for each file's claims:

1. `pnpm vitest run packages/assets` → all pass (MERGE_HANDOFF #2 recovered).
2. `pnpm test` → exit 0 (MERGE_HANDOFF #1's "~27 failures" are gone).
3. `ls packages/editor-app/src/theme-form.tsx packages/editor-app/src/asset-picker.tsx packages/themes/src/theme-catalog.ts` → all three files exist (THEMING + ASSET_PICKER work shipped).
4. `git status --short MERGE_HANDOFF.md THEMING_HANDOFF.md ASSET_PICKER_HANDOFF.md` → all three show `??` (untracked).

Only if ALL four checks pass, delete the three files.

**Verify**: `ls *HANDOFF*.md` → no matches.

## Test plan

No code changes — the gates are the grep/format checks per step plus one full
`pnpm test` run to back the claims written into the README.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "are placeholders" README.md` → no matches
- [ ] `grep -n "still being implemented" CONTRIBUTING.md` → no matches
- [ ] `ls *HANDOFF*.md` → no matches
- [ ] `grep -n "Carried over from MERGE_HANDOFF" plans/README.md` → one match
- [ ] `pnpm format:check` exits 0
- [ ] `pnpm test` exits 0
- [ ] `git status` shows only README.md, CONTRIBUTING.md (and plans/README.md) modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 004 has not landed (Step 2 precondition fails) — do Steps 1, 3, 4
  only, mark this plan BLOCKED on 004 in the index, and report.
- Any of Step 4's verification checks fails — the corresponding handoff file
  describes work that is NOT done; keep that file, report which check failed.
- Any handoff file shows as tracked in `git status` (someone committed it
  since planning) — deletion then needs a git decision from the maintainer.
- The README/CONTRIBUTING excerpts don't match the live files (drift).

## Maintenance notes

- The README Status section will go stale again — it describes a moving
  target. Reviewer may prefer phrasing that ages well ("see the issues
  backlog") over enumerations; the plan text above keeps one enumeration
  because it corrects a specific false claim.
- The handoff-file pattern ("untracked, delete when done") failed here
  precisely because nothing forced the deletion. If the team keeps using it,
  consider adding handoff files to `.gitignore` with a `*_HANDOFF.md` pattern
  plus a line in `AGENTS.md` telling agents to verify-and-delete stale ones
  at session start (not in scope for this plan).
