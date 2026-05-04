# 0001 — Monorepo tooling stack

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #2

## Context

Issue #2 asks for the v1 monorepo scaffold and four-job CI (typecheck, lint,
test, build). The PRD pins the project's product stack (Preact + `preact-render-to-string`
shared between editor preview and Node build, Electron + browser SPA dual
distribution, no client framework on built sites) but is intentionally silent
on the developer-tooling stack. This ADR records the choices made during
scaffolding so later issues do not have to re-litigate them.

## Decision

| Concern           | Choice                                                                      |
| ----------------- | --------------------------------------------------------------------------- |
| Monorepo manager  | **pnpm 10** workspaces, version pinned via `packageManager` + Corepack.     |
| Node runtime      | **Node 20 LTS** (`engines.node >= 20.9.0`).                                 |
| Language          | **TypeScript 5** with `strict` and `noUncheckedIndexedAccess` enabled.      |
| Bundler           | **Vite 6** (declared at the root; per-package bundling lands when needed).  |
| Unit test runner  | **Vitest 2**, configured at the root, scoped to `packages/*` test globs.    |
| End-to-end runner | **Playwright** with a shared `playwright.config.ts` and a top-level `e2e/`. |
| Linter            | **ESLint 9 flat config** + `typescript-eslint` recommended.                 |
| Formatter         | **Prettier 3**, integrated via `eslint-config-prettier`.                    |
| CI                | **GitHub Actions**, four parallel jobs matching the AC commands.            |

The CI workflow lives at `.github/workflows/ci.yml` and runs `typecheck`,
`lint`, `test`, and `build` in independent jobs, all gated on
`pnpm install --frozen-lockfile` after `corepack enable`.

## Rationale

- **pnpm** is what the issue body asks for ("Initialize pnpm workspaces").
  Corepack pins the version through `packageManager`, so contributors do not
  need a global pnpm install — `corepack enable` is the only one-time setup.
- **Vite** is the bundler the PRD's renderer story implicitly assumes:
  Preact + `preact-render-to-string`, dual browser/Node targets, Electron
  packaging, fast HMR for the live preview iframe. Vite's first-class Preact
  preset and `rollup`-based library mode cover both the app shells and the
  individual packages we will need to publish-as-libraries internally.
  esbuild alone could produce the bundles, but it lacks the dev-server
  ergonomics; Webpack works but loses the speed advantage Vite offers.
- **Vitest** integrates with Vite's transform pipeline, so the same
  TypeScript + JSX config feeds both dev builds and unit tests, matching the
  PRD's "renderer output is byte-identical between environments" goal.
- **Playwright** is the standard for cross-browser e2e and matches the
  PRD's "3-5 Playwright e2e on golden-path user flows" testing decision.
- **ESLint flat config** is the only supported config style on ESLint 9,
  which is the current GA version. `typescript-eslint`'s `tseslint.config()`
  helper keeps the file readable.
- **Strict TypeScript** is non-negotiable in a greenfield project that
  includes a typed i18n message system, schema validation, and a renderer
  whose contract is "deterministic output."

## Consequences

- Every package has a tiny `package.json` declaring `typecheck` and `build`
  scripts that delegate to `tsc`. Packages with bundled outputs (browser
  shell, electron shell, editor app) will add a per-package `vite.config.ts`
  when implementation lands.
- The four AC commands (`pnpm install`, `pnpm typecheck`, `pnpm lint`,
  `pnpm test`, `pnpm build`) work today against empty packages. Adding new
  packages just means dropping a directory under `packages/` matching the
  existing skeleton — no central registration required.
- Contributors on Mac, Windows, and Linux only need Node 20 + Corepack. The
  rest of the toolchain is project-local.

## Alternatives considered

- **npm workspaces / yarn classic / yarn berry** — issue #2 explicitly says
  pnpm, so this was a non-decision.
- **esbuild + tsx + uvu** for a leaner toolchain — drops too much
  ergonomics (HMR, e2e, snapshot tests) for a v1 project that needs them.
- **Turborepo / Nx** for monorepo task orchestration — premature; pnpm's
  built-in `-r --if-present` is sufficient for four jobs and 15 packages.
  Can be revisited if CI durations become a problem.

## Out of scope

- Per-package bundle configurations (Vite library-mode `vite.config.ts`
  files) land alongside the first real implementation.
- Coverage thresholds, axe-core CI gates, and Lighthouse budget verification
  are PRD-mandated quality gates that arrive in their own issues.
- Release / publishing pipelines are explicitly out of scope per the issue
  triage brief; only the four CI checks are required.
