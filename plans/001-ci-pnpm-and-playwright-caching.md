# Plan 001: Cache pnpm store and Playwright browsers in CI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 176e34e..HEAD -- .github/workflows/ci.yml`
> If the file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `176e34e`, 2026-06-12

## Why this matters

CI runs six jobs on every PR (`typecheck`, `lint`, `test`, `build`,
`lighthouse`, `a11y`), and every one of them does a cold
`pnpm install --frozen-lockfile` with no package-store cache. The `a11y` job
additionally downloads Chromium from scratch on every run via
`playwright install`. That is six cold installs plus a browser download per
push — minutes of wasted wall-clock on every PR, paid by every contributor on
every iteration. Adding the standard `actions/setup-node` pnpm cache and an
`actions/cache` entry for Playwright browsers removes most of that latency
with no behavioral change.

## Current state

- `.github/workflows/ci.yml` — the only file in scope. Six jobs, each with
  this identical setup sequence (shown here from the `typecheck` job,
  lines ~16–28):

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 20
  - name: Enable Corepack
    run: corepack enable
  - name: Install dependencies
    run: pnpm install --frozen-lockfile
```

- The `a11y` job has one extra step after install:

```yaml
- name: Install Playwright browsers
  run: pnpm exec playwright install --with-deps chromium
```

- pnpm is provided via Corepack (pinned by `packageManager: "pnpm@10.33.3"`
  in the root `package.json`). There is **no** `cache:` key on any
  `setup-node` step and **no** `actions/cache` usage anywhere in the file.
- Important ordering constraint: `setup-node` with `cache: pnpm` shells out
  to `pnpm store path` during its own execution, so **pnpm must be on PATH
  before `setup-node` runs**. That means the `corepack enable` step must be
  moved _above_ the `setup-node` step in every job. (Corepack ships with the
  runner's preinstalled Node, so it works before `setup-node`.)

## Commands you will need

| Purpose           | Command                                               | Expected on success |
| ----------------- | ----------------------------------------------------- | ------------------- |
| YAML syntax check | `pnpm exec prettier --check .github/workflows/ci.yml` | exit 0              |
| Format if needed  | `pnpm exec prettier --write .github/workflows/ci.yml` | exit 0              |
| Count cache keys  | `grep -c "cache: pnpm" .github/workflows/ci.yml`      | `6`                 |

## Scope

**In scope** (the only files you should modify):

- `.github/workflows/ci.yml`

**Out of scope** (do NOT touch, even though they look related):

- `.github/workflows/release.yml` — the release pipeline runs rarely; caching
  it is not worth the review risk in this plan.
- `lighthouserc.json`, `playwright.config.ts` — no changes needed.
- Job structure/consolidation (e.g. sharing a build artifact between jobs) —
  deliberate non-goal; keep the six-job topology exactly as is.

## Git workflow

- Branch: `advisor/001-ci-caching`
- Single commit; message style is verb-first imperative, e.g.
  `Add pnpm store + Playwright browser caching to CI` (matches repo history
  like `Add per-theme axe-core a11y regression CI gate (#40)`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Reorder Corepack before setup-node and add the pnpm cache, in all six jobs

In every job (`typecheck`, `lint`, `test`, `build`, `lighthouse`, `a11y`),
change the setup sequence to:

```yaml
steps:
  - uses: actions/checkout@v4
  - name: Enable Corepack
    run: corepack enable
  - uses: actions/setup-node@v4
    with:
      node-version: 20
      cache: pnpm
  - name: Install dependencies
    run: pnpm install --frozen-lockfile
```

The only two changes per job: (a) the `corepack enable` step moves above
`setup-node`; (b) `cache: pnpm` is added under `with:`. Keep everything else
in each job byte-identical.

**Verify**: `grep -c "cache: pnpm" .github/workflows/ci.yml` → `6`, and
`pnpm exec prettier --check .github/workflows/ci.yml` → exit 0 (run
`--write` first if Prettier wants reformatting).

### Step 2: Cache Playwright browsers in the a11y job

In the `a11y` job only, insert an `actions/cache` step between
`Install dependencies` and `Install Playwright browsers`:

```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
```

Keep the existing `pnpm exec playwright install --with-deps chromium` step
unchanged and after the cache step: on a cache hit Playwright detects the
browsers are already present and skips the download, while `--with-deps`
still installs the OS-level libraries (which are not cacheable this way).

**Verify**: `grep -n "ms-playwright" .github/workflows/ci.yml` → exactly one
match, inside the `a11y` job.

## Test plan

No unit tests apply — this is CI configuration. Verification is:

1. The grep/prettier gates in the steps above.
2. After the branch is pushed by the operator: the first CI run populates the
   caches (expect "Cache not found" in logs); the second run's `setup-node`
   logs show `Cache restored from key: ...` and the a11y job's Playwright
   install logs show the download skipped. (This observation belongs to the
   operator/reviewer, not the executor — note it in your report.)

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c "cache: pnpm" .github/workflows/ci.yml` prints `6`
- [ ] In every job, the `corepack enable` step appears _before_ the
      `setup-node` step (inspect `git diff`)
- [ ] `grep -c "ms-playwright" .github/workflows/ci.yml` prints `1`
- [ ] `pnpm exec prettier --check .github/workflows/ci.yml` exits 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The job names or step sequences in `ci.yml` don't match the "Current state"
  excerpt (workflow has been restructured since planning).
- You find an existing `cache:` or `actions/cache` usage already present —
  someone has done part of this; reconcile with the operator instead of
  layering on top.
- You feel the need to change any `run:` command, job dependency (`needs:`),
  or trigger — that is out of scope.

## Maintenance notes

- If the repo ever switches from Corepack to `pnpm/action-setup`, the
  ordering constraint (pnpm before `setup-node`) still applies — the action
  must run first.
- If a future PR bumps `@playwright/test`, the browser cache key changes
  automatically via the lockfile hash — no manual invalidation needed.
- Reviewer should scrutinize: that no job lost its `--frozen-lockfile` flag,
  and that the YAML indentation survived (Prettier gate covers this).
