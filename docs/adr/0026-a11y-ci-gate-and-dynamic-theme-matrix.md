# 0026 — Per-theme axe-core a11y CI gate and dynamic theme matrix

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #40

## Context

Issue #40 asks for an accessibility regression CI gate: each theme builds a
fixture site, axe-core runs against every page, the build fails on any
violation. The PRD pins the bar at WCAG 2.2 AA and explicitly calls for
"Zero axe-core violations as a CI gate" (PRD §Quality commitments).

When this work landed, only the stub theme (#46) existed in the renderer
registry. The five real themes were being implemented in parallel
(#28-#31, #47, "Wave 9 batch A"). The framework had to (a) ship today
with the stub theme as the only matrix cell, (b) light up automatically
as theme PRs merged, without re-editing the spec per theme, and (c) be
additive to the existing four-job CI (#2) rather than restructuring it.

The PRD is silent on the specific axe rule set and on whether to use
`@axe-core/playwright`, the standalone `axe-core` browser bundle, or
jsdom-level checks. ADR 0003 (renderer skeleton) wired a small
jsdom-level axe-core test for the hero-only sample, but that layer cannot
exercise color-contrast or layout-derived rules.

## Decision

### A11y rule set: **WCAG 2.2 AA + best-practice tags, experimental excluded**

The Playwright spec runs `axe.run` with
`runOnly: { type: "tag", values: [...] }` and the following tags:

| Tag             | Why it is included                                                |
| --------------- | ----------------------------------------------------------------- |
| `wcag2a`        | WCAG 2.0 Level A — the floor required for any AA conformance.     |
| `wcag2aa`       | WCAG 2.0 Level AA — text contrast, resize, target labels, etc.    |
| `wcag21a`       | WCAG 2.1 Level A — orientation, identify-purpose, etc.            |
| `wcag21aa`      | WCAG 2.1 Level AA — reflow, content on hover/focus.               |
| `wcag22aa`      | WCAG 2.2 Level AA — target size 24x24, focus-not-obscured.        |
| `best-practice` | Semantic rules with no WCAG mapping but high regression-catch     |
|                 | rate: `landmark-one-main`, `page-has-heading-one`, `region`, etc. |

`experimental` rules are deliberately excluded. Axe ships them as
opt-in pre-stable signals; including them in a no-tolerance gate would
cause flakes whenever Deque tunes a heuristic, with no value to the
project. If a future rule moves out of `experimental` into a stable WCAG
tag, the gate picks it up without code changes.

CONTRIBUTING.md documents this set as the project's a11y commitment so
contributors do not have to read the spec to know what is enforced.

### Dynamic theme matrix: **`KNOWN_THEME_IDS` registry exported from the renderer**

The renderer exports a `KNOWN_THEME_IDS: readonly string[]` constant that
lists the ids it can render. Today this is `[STUB_THEME_ID]`; theme PRs
extend the array as they merge. The Playwright spec iterates this array
at run time, so:

- Adding a new theme is a one-line edit in `packages/renderer/src/index.tsx`,
  and the a11y matrix grows automatically.
- The spec does not hardcode any theme ids beyond reading the registry.
- A regression that removes a theme's id from the registry surfaces as
  the matrix shrinking — visible in CI logs.

Rejected: a theme manifest in `packages/themes/` (the package is empty
today), per-theme `axe.test.ts` files (linear scaling with theme count,
no value over the loop), reading the file system to discover theme
modules (couples test discovery to file layout).

### Test fixture: **deterministic `generateA11yFixture(themeId, blocksPresent[])`**

The fixture generator under `packages/renderer/test/a11y-fixture.ts` is
a pure function of `(themeId, blocksPresent[])`. It returns a
schema-valid `Site` whose home page carries every Romanian diacritic
(Ă/Â/Î/Ș/Ț + lowercase forms), long Romanian copy that exercises hero
line-wrapping in every theme, and an EN counterpart page linked via
reciprocal `localizedAs` (per #24's multi-language switcher). The
generator is deterministic — same input produces byte-identical JSON —
so regressions in the renderer or build pipeline surface against a
stable fixture.

The generator is co-located with the renderer's test suite (rather than
in a new package or in `e2e/`) because:

- It is a test helper, not production code.
- The renderer already declares `axe-core` as a dev dep.
- Vitest's include pattern (`packages/*/test/**`) catches its unit tests
  automatically.
- The Playwright spec imports it through a thin `e2e/a11y.entry.ts`
  bundled by esbuild — the same pattern as `renderer-parity.entry.ts`
  from #46.

Rejected: putting the fixture in `packages/build/test/` (the build is a
chain over the renderer, the fixture is renderer-shaped),
`packages/themes/` (no Site shape there), `e2e/a11y/fixtures/*.json`
(static fixtures cannot encode the `(themeId, blocksPresent[])` axes
without one file per cell).

### Browser axe-core via standalone bundle, no `@axe-core/playwright`

The spec injects `axe-core/axe.min.js` into the page via
`page.addScriptTag` and runs `axe.run(document, ...)` inside
`page.evaluate`. We do not depend on `@axe-core/playwright` because:

- `axe-core` is already a dev dep (renderer's #46 jsdom-level test).
- The Playwright wrapper is a thin convenience layer; the standalone
  bundle works in any browser context including future runs against a
  served `dist/` directory.
- One less version to keep in sync.

The bundle is resolved via `createRequire(import.meta.url).resolve(
"axe-core/axe.min.js")`, which works through pnpm's hoisted modules
without hardcoding the package's on-disk layout.

### CI: **additive `a11y` job alongside the existing four**

The CI workflow (`.github/workflows/ci.yml`) gains a fifth job, `a11y`,
which:

1. Runs `pnpm install --frozen-lockfile` after `corepack enable`.
2. Runs `pnpm exec playwright install --with-deps chromium`.
3. Runs `pnpm exec playwright test e2e/a11y.spec.ts`.
4. On failure, uploads the Playwright report as an artefact.

The job is additive — existing typecheck/lint/test/build are untouched
— so theme work in flight does not block on a CI rewrite.

## Rationale

- **WCAG 2.2 AA** is the PRD's commitment. The tag set picked above is
  axe's published mapping for that level, plus `best-practice` rules
  that catch high-signal semantic regressions for free. `experimental`
  is excluded specifically because the gate is no-tolerance.
- **Dynamic registry** keeps the framework decoupled from the Wave 9
  parallel theme rollout. Each theme PR adds its id, the matrix grows
  automatically; no merge-conflict fights on a single hard-coded array
  in the spec.
- **Pure-function fixture generator** keeps the corpus deterministic and
  schema-validated, so the test failure mode is "this rule now triggers
  on this fixture" and never "the fixture itself is malformed."
- **Standalone axe-core** is the smallest possible dependency surface.
- **Additive CI job** means rolling back the gate is a one-block edit;
  no risk of poisoning the existing four-job baseline.

## Consequences

### Positive

- The a11y bar is enforced today on the stub theme, and as #28-#31 / #47
  merge, every new theme is required to pass on day one.
- The fixture generator is reusable for Lighthouse / visual-regression
  matrices in later issues without reshaping its API.
- Contributors have a documented rule set and a deterministic local
  reproduction path.

### Negative / accepted

- v1's build pipeline is single-page; the EN page is exercised by
  reordering `pages[0]` in a deep-cloned site copy and re-running
  `build()`. When #23 lands real multi-page emission, that workaround
  goes away with a small spec edit.
- The hero is the only block component shipped today (#46). Other block
  types in `blocksPresent[]` round-trip through the schema's loose
  envelope and render as HTML comments — they do not stress per-block
  semantics until #9-#22 land. The matrix dimension is reserved by API
  shape so those later issues can opt in by adding a block type to the
  fixture call.
- `best-practice` rules can change between axe-core minor versions.
  We pin axe-core's version via the lockfile; bumping it is a deliberate
  action with a CI run that surfaces any new violations before merge.

## Alternatives considered

- **Lighthouse-based gate** — heavier, slower, mixes a11y with perf;
  overkill for the no-tolerance accessibility commitment alone.
  Lighthouse lands separately when we wire the perf budget (#41+).
- **Per-theme spec files** — duplicates wiring with no extra coverage.
- **Static `dist/` snapshot under `__golden__/`** — the renderer already
  has a golden-file framework (#46); adding a parallel a11y golden adds
  no signal on top of "axe ran against the live HTML and saw zero
  violations."
- **Skip the gate, rely on manual review** — the PRD explicitly rules
  this out ("Zero axe-core violations as a CI gate").
