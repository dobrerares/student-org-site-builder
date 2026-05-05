# Contributing

Thanks for considering a contribution to the Student Org Site Builder.

The canonical product spec is in [`docs/PRD.md`](docs/PRD.md). Architectural
decisions live in [`docs/adr/`](docs/adr/). Read those before opening a non-trivial
issue or PR.

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

## Repository layout

This is a **pnpm workspace monorepo**. All implementation code lives under
`packages/`, with one package per module from the PRD.

```
.
|-- .github/workflows/    # CI: typecheck, lint, test, build
|-- docs/
|   |-- PRD.md            # v1 product specification (source of truth)
|   |-- adr/              # Architecture Decision Records
|   `-- agents/           # Agent skill conventions
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

The packages are intentionally empty placeholders right now. Implementation
arrives in dedicated issues. See `docs/PRD.md` for the canonical scope of each.

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
  editor across packages.
- Tests assert observable behaviour (renderer output, schema validation
  verdicts, IO round-trips) — not internal call patterns. See `docs/PRD.md`
  "Testing Decisions" for the canonical rules.

## Style and lint

- TypeScript with `strict` and `noUncheckedIndexedAccess` everywhere.
- ESLint flat config (`eslint.config.js`) with the `typescript-eslint`
  recommended set + `eslint-config-prettier` (so Prettier owns formatting).
- Prettier configuration lives in `.prettierrc.json`; run `pnpm format` before
  committing.

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

## Translations

The editor's UI is bilingual: Romanian (default for `ro-*` browser locales)
and English (default for everything else). Translations live in the
[`@sosb/i18n`](packages/i18n) package.

### Adding a new editor string

1. **Add the key** to the `EditorMessageKey` union in
   `packages/i18n/src/locales/keys.ts`. Keys are dot-namespaced by surface
   (e.g. `topbar.import`, `wizard.step.basics.title`,
   `welcome.action.template`).
2. **Add the English message** to `packages/i18n/src/locales/en.ts`. Use
   title case for short button labels and sentence case for descriptions.
3. **Add the Romanian message** to `packages/i18n/src/locales/ro.ts`. Use
   proper diacritics (`ă`, `â`, `î`, `ș`, `ț`) and prefer formal/standard
   Romanian over slang.
4. **Use the key in code** via `useTranslator()` (Preact) or directly
   through `createTranslator(...)` for non-Preact contexts.

The catalog-parity vitest test fails CI if either locale is missing a key
that the other defines, so the build won't merge until both catalogs are
in sync.

### Placeholders and pluralisation

`@sosb/i18n` supports `{name}` interpolation and a single-form ICU plural:

```
"items.count": "{count, plural, one {# item} other {# items}}"
```

The same placeholder set must appear in every locale's version of a key —
this is also enforced by the catalog-parity test.

### Romanian translations are AI-drafted

The current Romanian catalog (`packages/i18n/src/locales/ro.ts`) was
drafted by an AI agent. **A native Romanian speaker should review it
before public release.** The file's header comment lists specific keys
where multiple acceptable Romanian translations exist; the reviewer
should pick the house-style one.

### What to translate (and what not to)

| Translate                                 | Don't translate                          |
| ----------------------------------------- | ---------------------------------------- |
| User-visible button labels                | Code identifiers, package names          |
| Form field legends and placeholders       | Error codes (e.g. `E_SCHEMA_INVALID`)    |
| Headings, instructions, help text         | URLs, file paths, programmatic constants |
| Confirmation dialogs and success messages | Block-type ids in the schema             |

Site-author content (the org's own page text) is owned by the editor's
schema, not by `@sosb/i18n`.

## Filing issues

Issues live on GitHub. See [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md)
for the conventions used by AFK agents and human contributors alike.

## Code of Conduct

We follow the [Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
A `CODE_OF_CONDUCT.md` file will land alongside the first community-facing release.
