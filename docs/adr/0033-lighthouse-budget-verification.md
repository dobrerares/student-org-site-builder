# 0033 - Per-page Lighthouse-budget verification in the build pipeline

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #41

## Context

Issue #41 asks the build pipeline to enforce per-page byte budgets and to
hard-assert Lighthouse 95+ in CI, both pinned by the PRD's "Performance"
quality commitment:

> Lighthouse 95+ on all metrics. Per-page budgets: HTML <= 50kb, CSS <= 15kb
> gzipped, JS <= 10kb total, hero image <= 200kb (WebP/AVIF). Native
> `loading="lazy"` for below-the-fold images.

ADR 0004 already pins the build's API surface (`build(site, options) ->
Map<string, string>`) and a binding constraint: no Node-only deps on the
runtime path, so the same code runs in the in-browser editor and in Node.

The PRD and #41 do **not** pin:

- Where the budget engine lives (separate package vs. inside `@sosb/build`).
- How CSS-gzipped is measured given the no-Node-deps constraint.
- How hero-image bytes are measured before #8 lands the asset pipeline.
- Which Lighthouse runner the CI uses (`@lhci/cli`, raw `lighthouse`, or a
  third-party action wrapper).
- How the budget report is shaped on disk and how warnings surface.

This ADR records those choices.

## Decision

### Engine lives inside `@sosb/build`, exposed as a public function

`measureBudgets(dist) -> BudgetReport` is exported from `@sosb/build`
alongside `build()`. `build()` itself calls `measureBudgets` after assembling
the dist Map, attaches the report as `dist/_lighthouse-budget.json`, and
emits `console.warn` lines for every violation; `errorOnBudget: true` upgrades
violations to a thrown `Error`.

Rejected: a separate `@sosb/budget` package. The engine's only inputs are a
`Map<string, string>` and a constants table; splitting it would buy nothing
beyond a second `package.json` to maintain. The PRD's modular layout pins
`build` as the natural home for "build-pipeline including budget verification".

Rejected: a Node-side post-build script invoked from CI. That violates the
parity contract with the in-browser editor (#7), which runs `build()` in
the iframe and would not see the warnings. Folding the engine into `build()`
keeps editor previews honest about budget state.

### Browser-pure gzip via fflate

CSS is measured **post-gzip** (the PRD pins "<=15kb gzipped"). The
measurement code runs on the same `build()` runtime path that the in-browser
editor uses, so it cannot import `node:zlib`. Two browser-pure options were
weighed:

1. **fflate**'s `gzipSync` - 8KB minified, zero deps, zero Node imports.
2. **DecompressionStream / CompressionStream** - Web standard, available in
   modern browsers and Node 18+.

We chose fflate. It produces deterministic byte-identical output across
runs and engines (CompressionStream is permitted to vary the deflate trailer
in some implementations), and the no-Node-imports test (`packages/build/test/no-node-imports.test.ts`)
already verifies it tree-shakes cleanly. fflate is also the gzip backend
slated for the upcoming `@sosb/zip` package (#8 / #21), so adopting it here
avoids a second compression dep.

Rejected: pako. Heavier than fflate (~25KB vs ~8KB minified) and ships a
subset that is nominally "Node-friendly" but harder to audit for browser
purity.

### Hero metric is "skipped" in v1, with a documented note

The hero-image budget threshold (200KB post-optimization) is part of #41's
contract, but in v1 the dist Map carries only string artefacts -- binary
asset bytes land in #8 / #21. We surface the hero metric in every report
with `status: "skipped"` and a one-line `note` explaining why; the metric
activates automatically once the asset pipeline starts emitting binary
entries (no code change here is needed).

Rejected: omit the hero metric from the report until #8 lands. The PRD pins
it as a budget; surfacing it as "skipped" with a pointer to the issue keeps
the contract visible in every build, so a regression that disables hero
measurement after #8 lands stands out as a missing key rather than a
silently-passing audit.

Rejected: synthesize a hero byte count by HTTP-fetching the referenced URL.
Adds network I/O to a deterministic, offline-capable build. Out of bounds.

### Report shape: JSON, deterministic, single artefact at `_lighthouse-budget.json`

```jsonc
{
  "status": "pass" | "warn",
  "pages": {
    "<dist-path>": {
      "status": "pass" | "warn",
      "metrics": {
        "html": { "status": "pass" | "warn", "limitBytes": N, "bytes": N },
        "css":  { "status": "pass" | "warn", "limitBytes": N, "bytes": N },
        "js":   { "status": "pass" | "warn", "limitBytes": N, "bytes": N },
        "hero": { "status": "skipped",        "limitBytes": N, "note": "..." }
      }
    }
  }
}
```

Pretty-printed with two-space indent (matches the project's prettier
config) so the artefact reads naturally in PR diffs and editor tabs. Sorted
key order on the `pages` map keeps the file byte-deterministic across
rebuilds, preserving ADR 0004's "same input -> same output" contract.

The leading underscore signals "build metadata, not a hostable page". Static
hosts (Cloudflare Pages, GitHub Pages) serve the file but search engines
generally skip underscore-prefixed paths.

Rejected: a separate `dist/lighthouse-budget/` directory with one JSON per
page. v1 is single-page; the directory shape is premature, and a single
JSON is easier to read and to diff.

### Warning format: `[budget] <path> <metric>: <bytes>B exceeds limit of <limit>B (over by NB)`

One line per violation, sorted by page path then metric name. Stable across
rebuilds. The format is plain text rather than ANSI-colored because the
build output may be captured by the editor's preview pane, by CI logs, and
by a future Electron build dialog -- ANSI escapes would render as garbage
in the Electron window.

### `errorOnBudget` defaults to `false`

Editor and demo builds need to draft a site even if a stylesheet is
temporarily over budget; CI flips the option to `true` so a regression
breaks the build. The script that materialises the Lighthouse fixture for
CI sets `errorOnBudget: true` so a budget regression fails CI before
Lighthouse ever runs (catches the cause faster than waiting on the audit).

### Lighthouse runner: `treosh/lighthouse-ci-action@v12`

The action wraps `@lhci/cli` with sensible defaults: serves the static dist
on a local port, runs Lighthouse 3 times, asserts against
`lighthouserc.json`, and uploads HTML reports as artefacts. Three runs
smooths over single-run jitter that occasionally trips the 0.95 score
threshold for entirely-virtual fixtures.

Rejected: invoke `@lhci/cli` directly. Same engine, more YAML. The action
also sets up a public-storage upload toggle that we explicitly disable
(`temporaryPublicStorage: false`) so audit results stay private to the CI
run; doing this without the action requires extra plumbing.

Rejected: raw `lighthouse` CLI. Lacks the multi-run averaging and the
assertion engine. We would have to reimplement both.

### CI fixture: `packages/build/test/fixtures/lighthouse-fixture.json`

A small, single-page, single-language site with one hero block (no image,
no JS). The intent is "representative real-ish site" not "stress test" --
the budget engine and the renderer's golden-file tests cover the stress
side. A live-browser audit on a real-ish site catches the categories that
static measurement cannot (Accessibility category includes contrast and
focus, SEO category includes crawlability and meta tags).

The fixture is materialised to `./lighthouse-dist` by
`scripts/build-lighthouse-fixture.mjs` (a Node-only helper -- it bundles
the browser-pure build pipeline through esbuild, then dynamically imports
the bundle, mirroring the technique the no-Node-imports test already uses).

## Rationale

The two non-obvious choices are (1) keeping the engine inside `@sosb/build`
rather than splitting it out, and (2) the "skipped" hero metric.

(1) Splitting the engine would create a circular dependency: the editor
preview needs to display budget state alongside the rendered iframe, and
that pane already imports `@sosb/build`; pulling the budget engine into a
separate package would force the editor to import both. Keeping the engine
co-located keeps the editor's import surface unchanged and fits the PRD's
"Build emits per-page budget report" sentence verbatim.

(2) The hero "skipped" status is a small bet that surfacing the missing
measurement is more valuable than hiding it. A future contributor reading
`_lighthouse-budget.json` for the first time sees four metrics, one of
which is "skipped" with a note pointing at #8. That is a clearer
introduction to the contract than a three-metric report would be -- it
encodes the planned shape of the v2 report into the v1 artefact.

## Consequences

- `@sosb/build` gains a `fflate` runtime dep (~8KB minified, browser-pure).
  The no-Node-imports test gates it.
- `@sosb/build` exports `BUDGET_LIMITS`, `measureBudgets`, `formatBudgetViolations`,
  and the `BuildOptions.errorOnBudget` / `_testInjectExtraCss` fields.
- A new dist artefact `_lighthouse-budget.json` ships with every build. The
  one pre-existing test that asserts an exhaustive list of dist keys is
  updated to include it; new snapshot files cover the artefact for the
  with-siteUrl and no-siteUrl golden cases.
- A new GitHub Actions job `lighthouse` runs after `build`, materialises a
  representative fixture, and audits it. The job adds ~2-3 minutes to a CI
  run; we accept this for the regression coverage on the four Lighthouse
  categories.
- `lighthouserc.json` lives at the repo root and pins the four-category
  thresholds.
- `scripts/build-lighthouse-fixture.mjs` is a Node-only helper; no other
  scripts use this directory yet but the convention scales naturally.
- A new docs page `docs/performance-budgets.md` explains the budgets and
  how to debug violations; CONTRIBUTING.md gains a one-line pointer to it.

## Alternatives considered

- **Use `node:zlib` only at build time and ship a stub for the browser.**
  Re-introduces the Node-vs-browser parity gap that ADR 0004 closed. The
  editor preview would display "budget unavailable" for CSS, defeating the
  point.
- **Snapshot the budget JSON byte-for-byte against a golden file.** Done --
  see `__golden__/with-site-url/_lighthouse-budget.json` and `__golden__/no-site-url/_lighthouse-budget.json`.
  Updating the snapshot when the fixture genuinely grows is the cost; the
  benefit is that any silent change to the byte count of the rendered HTML
  shows up in the snapshot diff immediately.
- **Run Lighthouse on every PR via a self-hosted runner.** Rejected --
  the CI cost is small enough that the public-runner approach scales; a
  self-hosted runner is a future option if our PR volume grows.
- **Fail the budget check at the renderer rather than the build pipeline.**
  Rejected -- the renderer is a pure `(data, themeId) -> HTML` function and
  doesn't see the dist Map, so it can't reason about per-page totals or
  cross-file size budgets.

## Out of scope

- **Per-page Lighthouse audits across multiple pages.** v1 is single-page;
  multi-page Lighthouse coverage lands when #23 introduces multi-page
  output (one URL per page in `lighthouserc.json`'s `url` array).
- **RUM / production telemetry.** Bound out by the issue's triage brief.
- **Image optimization.** #8 / #37.
- **Third-party script auditing.** Out of bounds for v1.
- **Budget thresholds per theme.** All themes share the same thresholds;
  if a future theme legitimately needs 20KB of CSS, that's a PRD-level
  conversation, not a build-pipeline-level escape hatch.
