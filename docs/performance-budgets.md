# Performance budgets

The build pipeline asserts per-page byte budgets every time `build()` runs
and ships an audit report at `dist/_lighthouse-budget.json`. CI also runs
Lighthouse against a representative built fixture and asserts 95+ on every
category. This page explains the budgets, how to read the report, and how
to debug a violation.

The numbers and rationale come from the [v1 PRD](./PRD.md) Performance
quality commitment. The implementation is described in
[ADR 0033](./adr/0033-lighthouse-budget-verification.md).

## The budgets

Per page:

| Metric        | Limit               | What it covers                                                                  |
| ------------- | ------------------- | ------------------------------------------------------------------------------- |
| HTML          | 50 KB               | Raw byte size of each `.html` artefact in the dist Map.                         |
| CSS (gzipped) | 15 KB **post-gzip** | Sum of every inline `<style>` block, plus any `.css` file linked from the page. |
| JavaScript    | 10 KB               | Sum of every inline `<script>` block, plus any `.js` file linked from the page. |
| Hero image    | 200 KB              | Post-optimization byte count of the page's first hero image.                    |

The CSS metric is the only one measured post-gzip -- everything else is a
raw byte count. v1 aims at zero JS, so the JS budget is effectively a "did
you accidentally ship a script?" alarm.

The hero metric is currently `skipped` for every page because the asset
pipeline (#8 / #21) hasn't landed yet -- the dist Map carries no binary
asset bytes. The metric activates automatically as soon as the asset
pipeline starts emitting binary entries; no code change is needed here.

## The report

Every `build()` call returns a dist Map that includes
`_lighthouse-budget.json`. Reading it:

```json
{
  "status": "pass",
  "pages": {
    "index.html": {
      "status": "pass",
      "metrics": {
        "html": { "status": "pass", "limitBytes": 51200, "bytes": 2496 },
        "css": { "status": "pass", "limitBytes": 15360, "bytes": 541 },
        "js": { "status": "pass", "limitBytes": 10240, "bytes": 0 },
        "hero": {
          "status": "skipped",
          "limitBytes": 204800,
          "note": "hero image 'assets/hero.jpg' not present in dist Map yet (asset pipeline lands in #8)"
        }
      }
    }
  }
}
```

Statuses:

- `pass` -- measured value at or under the limit. No warning fires.
- `warn` -- measured value exceeds the limit. The build prints a
  `console.warn` line per violation; with `errorOnBudget: true`, it throws.
- `skipped` -- the metric could not be measured (e.g. hero image not in
  the dist Map, off-site image URL). A `note` field explains why. Skipped
  metrics never downgrade the page status.

## Configuring the warning behavior

```ts
import { build } from "@sosb/build";

// Default: warn-only. Useful for editor previews where the user is mid-edit.
build(site);

// CI: throw on any violation. The thrown Error names the offending page
// and metric so a CI log surfaces the cause without re-running the build.
build(site, { errorOnBudget: true });
```

The CI `lighthouse` job sets `errorOnBudget: true` on the materialise step
so a budget regression fails the workflow before Lighthouse ever runs.
That keeps the failure feedback loop short -- you see the byte overage
inline in the build log, not buried in a Lighthouse HTML artefact.

## Debugging a violation

The warning line points at the offending file and metric:

```
[budget] index.html css: 17832B exceeds limit of 15360B (over by 2472B)
```

### CSS (gzipped) over budget

Most likely cause: a theme stylesheet grew or a new utility class block
was added without considering compression cost. Steps:

1. Look at `_lighthouse-budget.json` to confirm which page tripped.
2. Open the offending HTML and read the first `<style>` block.
3. The renderer composes CSS from `emitTokenRoot()` plus the active theme.
   If the byte count grew suddenly, check recent changes to
   `packages/renderer/src/themes/<theme>.ts` and `tokens.ts`.
4. Run `pnpm --filter @sosb/build test` -- the budget tests print the gzipped
   size to help you reason about the gzip ratio.
5. Strategies for getting back under budget:
   - Drop redundant utility selectors (deduplicate styles).
   - Merge similar `[data-block]` sections that share most properties.
   - Use shorthand properties (`margin: 0` instead of four edges).
   - Move never-used selectors out of the always-emitted CSS.

### HTML over budget

A single page emitting > 50 KB of HTML usually means an unbounded user
input is rendered without a length cap. v1's renderer is small enough that
this should rarely happen organically. Check:

1. Did a new block type land that emits long inline content?
2. Is a `richText` or `markdown` block embedding very large user content?
3. Did the SEO meta overlay grow (canonical, og:image, og:url)?

The renderer's golden-file tests catch unexpected HTML drift before it
reaches the budget engine; if you see HTML go over budget, the golden-file
diff in the same PR usually shows you exactly which markup grew.

### JavaScript over budget

v1 ships zero JS by default. If the JS budget warns, the build pipeline is
emitting a `<script>` block it shouldn't, or a future block type silently
shipped client-side JS. Audit:

1. `grep -n "<script" packages/renderer/src/`
2. `grep -n "<script" dist/index.html`
3. Read the offending script body. If it is ours, the right answer is
   almost always "move this to a build-time transform".

### Hero image over budget

(After #8 lands -- v1 reports `skipped`.) The hero image exceeded 200 KB
post-optimization. Either:

1. The source asset is too large for the optimizer to reach 200 KB without
   destroying quality -- swap to a smaller source or accept a lower-quality
   variant.
2. The optimizer regressed -- check the asset pipeline's processing chain
   (`packages/assets`) for recent changes.

## CI Lighthouse run

The `lighthouse` job in `.github/workflows/ci.yml` runs after the `build`
job, materialises the
`packages/build/test/fixtures/lighthouse-fixture.json` fixture to disk via
`scripts/build-lighthouse-fixture.mjs`, and audits it with
`treosh/lighthouse-ci-action@v12`. Thresholds live in
[`lighthouserc.json`](../lighthouserc.json) and pin 0.95 minimum on
Performance, Accessibility, Best Practices, and SEO.

To reproduce the audit locally:

```bash
pnpm install
node scripts/build-lighthouse-fixture.mjs ./lighthouse-dist
npx --package=@lhci/cli lhci autorun --config=./lighthouserc.json
```

If a Lighthouse category falls below 0.95, the upload step writes per-run
HTML reports under `./lighthouse-results/`. Open the HTML report in a
browser to see the failed audit names and the per-audit guidance.

Common failure modes:

- **Performance < 0.95.** Almost always a budget violation -- the byte
  budgets exist precisely to catch this before Lighthouse runs.
- **Accessibility < 0.95.** Either a renderer regression (the renderer's
  axe-core test should catch most of these first) or a fixture-content
  problem (e.g. a hero image without alt text).
- **SEO < 0.95.** Usually a missing meta tag in the renderer or a missing
  `siteUrl` in the fixture (canonical / og:url depend on it).
- **Best Practices < 0.95.** Often a console error from a remote-loaded
  resource. The fixture should not load anything off-site -- if it does,
  audit `packages/build/test/fixtures/lighthouse-fixture.json`.

## Where things live

- Engine: `packages/build/src/budget.ts`
- Tests: `packages/build/test/budget.test.ts`,
  `packages/build/test/ci-lighthouse-workflow.test.ts`
- Fixtures (synthetic over-budget dists for unit tests):
  `packages/build/test/fixtures/oversized-dist.ts`
- Lighthouse-CI fixture site: `packages/build/test/fixtures/lighthouse-fixture.json`
- Materialise script: `scripts/build-lighthouse-fixture.mjs`
- Lighthouse config: `lighthouserc.json`
- CI workflow: `.github/workflows/ci.yml` (the `lighthouse` job)
- Decision record: `docs/adr/0033-lighthouse-budget-verification.md`
