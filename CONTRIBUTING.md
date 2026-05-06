# Contributing

Thanks for considering a contribution to the Student Org Site Builder.

The canonical product spec is in [`docs/PRD.md`](docs/PRD.md). Architectural
decisions live in [`docs/adr/`](docs/adr/). Read those before opening a
non-trivial issue or PR.

## Prerequisites

- **Node.js** 20.9.0 or newer (LTS recommended).
- **pnpm** 10+ — managed via [Corepack](https://nodejs.org/api/corepack.html),
  pinned through the `packageManager` field in the root `package.json`. You do
  not need to install pnpm globally; just enable Corepack once:

  ```bash
  corepack enable
  ```

## Quick start

```bash
git clone https://github.com/dobrerares/student-org-site-builder.git
cd student-org-site-builder
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

A clean clone walks through `install -> typecheck -> lint -> test -> build`
without manual fixups. CI runs the same four checks on every PR against `main`.

## Running locally

There is no top-level "run the app" script today: the editor app
(`@sosb/editor-app`) is composed by a host shell (`@sosb/browser-shell` or
`@sosb/electron-shell`), and those shells are still being implemented (see
the [issues backlog](../../issues)). For now:

- `pnpm test` exercises every package's unit tests via Vitest.
- `pnpm test:watch` keeps Vitest in watch mode for the package you are
  editing — pair with `pnpm -r --filter @sosb/<name>` to scope.
- `pnpm test:e2e` runs the Playwright e2e suite from `./e2e/`. Some specs
  bundle the renderer with esbuild and run it inside a real Chromium
  page (see [ADR 0003](docs/adr/0003-renderer-skeleton-and-determinism.md))
  to verify Node-vs-browser parity.
- `pnpm -r --filter @sosb/<name> run build` builds one package in
  isolation.

When the host shells land they will expose `pnpm dev` entry points; that
will be added here in the same PR.

## Repository layout

This is a **pnpm workspace monorepo**. All implementation code lives under
`packages/`, with one package per module from the PRD.

```
.
|-- .github/
|   |-- ISSUE_TEMPLATE/   # Bug / feature / theme-or-block proposal
|   |-- PULL_REQUEST_TEMPLATE.md
|   `-- workflows/        # CI: typecheck, lint, test, build
|-- docs/
|   |-- PRD.md            # v1 product specification (source of truth)
|   |-- adr/              # Architecture Decision Records
|   |-- agents/           # Agent skill conventions
|   `-- how-to-add-a-block.md
|-- e2e/                  # Playwright end-to-end tests (cross-package)
|-- packages/             # Workspace packages (see below)
|-- eslint.config.js      # Shared ESLint flat config
|-- playwright.config.ts  # Shared Playwright config
|-- pnpm-workspace.yaml   # Workspace manifest
|-- tsconfig.base.json    # Shared TS compiler options (strict)
|-- tsconfig.json         # Repo-wide typecheck entrypoint
`-- vitest.config.ts      # Shared Vitest config
```

### Packages

Each package follows the same skeleton:

```
packages/<name>/
|-- package.json     # name "@sosb/<name>", scripts: typecheck, build
|-- tsconfig.json    # extends ../../tsconfig.base.json
|-- README.md
`-- src/index.ts     # entry point
```

The 15 v1 packages are:

#### Deep modules (encapsulated behaviour, narrow interface)

| Package    | Purpose                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------- |
| `schema`   | Block + site schemas, validation, severity tiers, migrations, preserve-unknown-keys.            |
| `renderer` | Pure `(siteData, themeId) -> HTML`. Same code in browser preview and Node build.                |
| `markdown` | Strict-whitelist sanitised markdown for `richText`, `faq`, `quote`.                             |
| `vfs`      | Virtual filesystem with multiple drivers (Memory, IndexedDB, OPFS, Electron FS, Zip).           |
| `assets`   | Image processing pipeline; environment-specific implementations behind a unified interface.     |
| `zip`      | Bidirectional import/export with round-trip preservation.                                       |
| `build`    | `(siteData) -> distFolder` pipeline, including SEO metadata generation and budget verification. |
| `i18n`     | Keyed message lookup with RO/EN, browser language detection, override persistence.              |

#### Integration / UI modules

| Package          | Purpose                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------- |
| `editor-state`   | Live document model with undo/redo, block manipulation actions.                         |
| `preview-bridge` | postMessage protocol between editor and preview iframe.                                 |
| `editor-app`     | Preact UI composing the deep modules.                                                   |
| `wizard`         | 6-step state machine + Preact UI for guided onboarding.                                 |
| `themes`         | Five Preact theme component sets + token defaults.                                      |
| `electron-shell` | Main process, IPC bridge to Sharp, `electron-updater`, native dialogs, packaging.       |
| `browser-shell`  | Service worker, single-file archival build, OPFS bootstrap, hosted-deployment artefact. |

Some packages are still placeholders, and others (`schema`, `renderer`,
`vfs`, `zip`, `build`, `editor-state`, `preview-bridge`, `editor-app`) have
landed real implementations. See `docs/PRD.md` for the canonical scope of
each.

## Scripts

All scripts run from the repo root.

| Command             | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `pnpm install`      | Install all workspace dependencies.                  |
| `pnpm typecheck`    | Run `tsc --noEmit` in every package that defines it. |
| `pnpm lint`         | Run ESLint on the repo.                              |
| `pnpm format`       | Apply Prettier to the repo.                          |
| `pnpm format:check` | Check Prettier formatting without writing.           |
| `pnpm test`         | Run Vitest unit tests across all packages.           |
| `pnpm test:watch`   | Vitest in watch mode.                                |
| `pnpm test:e2e`     | Run Playwright end-to-end tests from `./e2e`.        |
| `pnpm build`        | Build every package (`tsc --build`).                 |

`pnpm -r --filter @sosb/<name>` scopes a script to one package, e.g.
`pnpm -r --filter @sosb/schema run build`.

## Testing conventions

- **Unit tests are co-located** with the modules they cover under
  `packages/*/src/**/*.test.ts(x)` or `packages/*/test/**/*.test.ts(x)`.
- **End-to-end tests live in the top-level `e2e/`** directory and exercise the
  editor across packages (Playwright + a real Chromium).
- **Golden / snapshot files** (the renderer's `(15 blocks × 5 themes)`
  matrix) live under `packages/renderer/test/__golden__/` and are written
  via Vitest's `toMatchFileSnapshot`. The `__golden__` directory is in
  `.prettierignore`: those files are byte-exact captures of the renderer's
  output, so reformatting them would invalidate the regression contract.
- Tests assert observable behaviour (renderer output, schema validation
  verdicts, IO round-trips) — not internal call patterns. See
  `docs/PRD.md` "Testing Decisions" for the canonical rules and
  [ADR 0003](docs/adr/0003-renderer-skeleton-and-determinism.md) for the
  golden-file framework.
- Most packages are testable in the default Node Vitest environment without
  a DOM. Editor packages that need a DOM (`@sosb/editor-app`) opt in via
  `vitest.config.ts` overrides; this keeps the rest of the suite fast.

## How to add a block

The walkthrough lives at [`docs/how-to-add-a-block.md`](docs/how-to-add-a-block.md).
It mirrors the hero block as the canonical example: schema entry → renderer
component → optional editor form/defaults → tests + golden file. Read it end
to end before opening a block-implementation issue (#9–#22).

## How to add a theme

Themes live in `@sosb/themes` and are wired into the renderer via the
`themeId` argument to `renderSite()`. The architectural decisions that govern
themes — tokens-as-CSS-custom-properties on `:root`, layout-only theme CSS,
no raw hex/rgb outside `:root`, deterministic emission order — are recorded
in [ADR 0003 (renderer skeleton and determinism)](docs/adr/0003-renderer-skeleton-and-determinism.md).
Read that ADR first; theme additions land per-issue (Academic = #47, the
others = #28–#31).

In short, a new theme:

1. Adds a module under `packages/themes/src/<theme-id>/` exporting a `Theme`
   record with its layout-only CSS string and any per-block variants the
   theme needs (the PRD only mandates per-theme variants for blocks with
   meaningful layout differences).
2. Registers itself with the renderer's theme registry (the registry shape
   lives next to `renderSite` in `@sosb/renderer`).
3. Ships the `(15 blocks × this theme)` slice of the golden-file matrix
   under `packages/renderer/test/__golden__/<theme-id>-<block>.html`.
4. Updates `@sosb/themes`'s README + the theme catalog displayed by the
   wizard / editor.

A theme PR that touches schema is almost always a sign that something is
in the wrong layer — token shapes belong in `@sosb/schema`, theme CSS
belongs in `@sosb/themes`.

## How to add an ADR

Architecture Decision Records (ADRs) are the project's permanent record of
"why this shape, not the alternatives." A new ADR is required whenever you
make a non-trivial decision that future contributors would otherwise
re-litigate (library choices, seam shapes, file formats, protocol envelopes,
test framework choices, etc.).

### Numbering

- Files are numbered sequentially, four-digit zero-padded, dash-separated:
  `docs/adr/NNNN-short-kebab-slug.md`.
- The slug is a 3–6 word summary of the decision, kebab-case.
- Pick the next free `NNNN` from `ls docs/adr/`. Two PRs that grab the same
  number resolve at merge time by re-numbering the second to land. (The
  current set has a duplicate `0003` from independent PRs landing
  simultaneously — that is the precedent for how to recover.)

### Format

ADRs follow Michael Nygard's classic shape, lightly extended:

```markdown
# NNNN — Short title

- **Status:** Accepted | Superseded by NNNN | Deprecated
- **Date:** YYYY-MM-DD
- **Issue:** #<github-issue>

## Context

What problem does this decision solve? What did the PRD pin, and what did it
leave open? Cite the PRD section and any prior ADRs.

## Decision

The actual choices, in concrete terms (libraries with versions, interface
shapes, file paths, configuration). Use sub-sections per choice when there
are several.

## Rationale

Why these choices over the alternatives. Be honest about trade-offs.

## Consequences

What downstream PRs / packages now have to assume. Configuration that was
set up. Rough costs (bundle size, dependency count) where relevant.

## Alternatives considered

The serious alternatives, with one line each on why they lost. This is the
section future contributors look at when re-evaluating.

## Out of scope

What this ADR explicitly does _not_ address.
```

ADRs are immutable once accepted: if a decision changes, write a new ADR
that supersedes the old one and update the old one's `Status:` line to
`Superseded by NNNN`. Do not silently rewrite history.

Existing ADRs in `docs/adr/` are good models — start by reading
[ADR 0001](docs/adr/0001-monorepo-tooling-stack.md) and
[ADR 0002](docs/adr/0002-schema-library-and-validation-model.md).

## Style and lint

- TypeScript with `strict` and `noUncheckedIndexedAccess` everywhere.
- ESLint flat config (`eslint.config.js`) with the `typescript-eslint`
  recommended set + `eslint-config-prettier` (so Prettier owns formatting).
- Prettier configuration lives in `.prettierrc.json`; run `pnpm format` before
  committing.

## Commit message conventions

The project follows a lightly-conventional, imperative style. Look at
`git log --oneline` to see recent commits for the precedent. The pattern is:

```
Verb-first short summary (#issue-number)

Optional body: explain *why*, not *what* — the diff already shows what.
Wrap to ~72 columns. Reference ADRs by number when relevant.
```

Examples from the repo's own history:

- `Add monorepo scaffold and dev tooling (#2)`
- `Add schema framework: site spine + hero + validation (#3)`
- `Add browser build pipeline: dist + SEO meta + sitemap (#5)`
- `Add block library picker + DnD reorder + undo/redo (#27)`

Conventions:

- **Verb first** (`Add`, `Fix`, `Refactor`, `Remove`, `Update`, `Document`,
  `Triage`). Avoid noun-only summaries.
- **Reference the issue** with `(#nn)` at the end of the summary line.
- **One commit per logical change.** Squash review fix-ups before merge if
  they don't carry independent value.
- **Don't skip pre-commit hooks**; if a hook fails, fix the underlying
  issue and write a new commit (do not `--amend` over a failed hook).
- **No personal data in commit messages or test fixtures.** The repo's
  fixtures use a fictional org (HISTORIPOL) for that reason.

## Continuous integration

`.github/workflows/ci.yml` runs five jobs on every PR against `main`:

1. **Typecheck** — `pnpm typecheck`
2. **Lint** — `pnpm lint` and `pnpm format:check`
3. **Test** — `pnpm test`
4. **Build** — `pnpm build`
5. **Lighthouse** — runs after Build. Materialises a representative built
   fixture and audits it; asserts 95+ on Performance, Accessibility, Best
   Practices, and SEO.

All five must pass before a PR is mergeable.

## Performance budgets

Every `build()` call enforces per-page byte budgets (HTML, CSS gzipped, JS,
hero image) and emits a `dist/_lighthouse-budget.json` audit report. CI
upgrades budget warnings to hard errors via `errorOnBudget: true`. See
[`docs/performance-budgets.md`](docs/performance-budgets.md) for the
budgets, how to read the report, and how to debug a violation; see
[ADR 0005](docs/adr/0005-lighthouse-budget-verification.md) for the
implementation rationale.

## Filing issues

Use the [issue templates](.github/ISSUE_TEMPLATE/) when filing — they prompt
for the right context per issue type and pre-apply the `needs-triage` label
so a maintainer (or a triage-skill agent) can move them into the workflow.

The labels and triage workflow are documented in
[`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md) and
[`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

## Pull requests

Use the [pull request template](.github/PULL_REQUEST_TEMPLATE.md). The PR
body must:

- Link the issue it closes via `Closes #<n>`.
- Summarise what changed and (briefly) why.
- Restate the issue's acceptance criteria with check-boxes for each.
- List the verification commands run (`pnpm typecheck`, `pnpm lint`,
  `pnpm test`, `pnpm build`, plus any package-scoped runs) and confirm
  they all exit 0.
- Note any follow-ups that were intentionally deferred, with issue links.

PRs against package internals should mention which ADR they implement
or extend. Schema additions or seam changes should land an ADR in the
same PR (or a follow-up PR landing immediately after, depending on
review pacing).

## Code of Conduct

We follow the [Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
The repo file is [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
