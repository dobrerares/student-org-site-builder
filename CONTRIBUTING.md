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

`.github/workflows/ci.yml` runs four jobs in parallel on every PR against
`main`:

1. **Typecheck** — `pnpm typecheck`
2. **Lint** — `pnpm lint` and `pnpm format:check`
3. **Test** — `pnpm test`
4. **Build** — `pnpm build`

All four must pass before a PR is mergeable.

## How to add a schema migration

The `@sosb/schema` package owns block + site schemas plus the migration
framework that bridges old data to the current shape on load. This section
is the canonical pattern for adding a new migration; the synthetic hero
v1 → v2 bump (issue #26, ADR-0003) is the worked example.

### Constraints (PRD + ADR-0003)

- **Additive-only inside v1.x.** Add optional fields with sensible
  defaults; never rename, retype, or remove an existing field.
- **Single-hop migrations.** Each migration bumps a block by exactly one
  version. The framework composes them into chains automatically.
- **Preserve unknown keys.** `apply` functions must spread the input
  rather than reconstruct it from scratch, so unknown future fields
  ride through.
- **Don't clobber.** Fill defaults only when the field is genuinely
  absent. A pre-existing value (perhaps from a future editor that
  round-tripped through this older one) takes precedence.

### Step-by-step (worked example: hero v1 → v2 with `align`)

1. **Bump the block-version constant** in `packages/schema/src/blocks/<block>.ts`.

   ```ts
   export const HERO_BLOCK_VERSION = 2 as const;
   ```

2. **Update the data schema additively.** Use `z.looseObject(...)` so
   unknown keys round-trip. Optional fields with defaults are safe;
   required field bumps would not be (and are out of scope inside v1.x).

   ```ts
   export const HeroDataSchema = z.looseObject({
     // ...existing fields unchanged...
     align: z.enum(["left", "center", "right"]).optional(),
   });
   ```

3. **Bump the schema's `version` literal** so the new schema validates
   only post-migration data:

   ```ts
   export const HeroBlockSchema = z.looseObject({
     id: z.string().min(1),
     type: z.literal("hero"),
     version: z.literal(HERO_BLOCK_VERSION),
     data: HeroDataSchema,
   });
   ```

4. **Register the migration** in `packages/schema/src/migrate.ts`. Add
   one entry to `BLOCK_MIGRATIONS` per `(type, from)` pair. Spread the
   input rather than reconstructing it, and only fill the new field
   when it is genuinely absent:

   ```ts
   {
     type: "hero",
     from: 1,
     apply: (block) => {
       const enveloped = block as { data?: unknown; [k: string]: unknown };
       const data =
         typeof enveloped.data === "object" && enveloped.data !== null
           ? (enveloped.data as Record<string, unknown>)
           : {};
       const newData: Record<string, unknown> = { ...data };
       if (!Object.prototype.hasOwnProperty.call(newData, "align")) {
         newData.align = "left";
       }
       return { ...enveloped, version: 2, data: newData };
     },
   },
   ```

5. **Update fixtures.** Bump `packages/schema/test/fixtures/historipol.json`
   to the new shape (so it represents _current_ canonical data), and
   keep a copy of the pre-migration shape under
   `packages/schema/test/fixtures/historipol-legacy.json` (or
   `historipol-legacy-vN.json` if multiple legacy snapshots accumulate).
   Migration tests run against the legacy fixture.

6. **Write tests** in `packages/schema/test/migration-exercise.test.ts`
   (or a similarly named per-bump file). At minimum:

   - **Default-fill test:** load a pre-migration block (without the new
     field) and assert the new field gets the documented default.
   - **No-clobber test:** load a pre-migration block that already
     carries the new field and assert the migration leaves it alone.
   - **Round-trip test:** load a fresh block (already at the new
     version) and assert the migration is a no-op.
   - **Forward-compat test:** load a block of a future unknown type and
     assert it survives migration byte-identical.
   - **Site-wide test:** call `applyAllMigrations(legacyFixture)` and
     assert `migrationApplied: true`, `fromVersion`, `toVersion`, and
     that every block on every page is at the new version.

7. **Hot-path verify:**

   ```bash
   pnpm install
   pnpm typecheck
   pnpm lint
   pnpm test
   pnpm build
   ```

8. **Document the bump** in an ADR under `docs/adr/` if the migration
   involves a non-trivial decision (new field semantics, non-obvious
   default, etc.). For a purely additive bump that follows the
   established pattern, ADR-0003 is sufficient — just reference it in
   the PR body.

### What the editor does on load

The editor (#7) wires `applyAllMigrations` into the load path:

```ts
const result = applyAllMigrations(rawSiteData);
const validation = validate(result.data);
if (result.migrationApplied) {
  showToast(`Site upgraded to schema v${result.toVersion}`);
}
```

The toast UI itself lives in the editor package. The schema package
exposes `applyAllMigrations` and the boolean — that is the only seam.

## Filing issues

Issues live on GitHub. See [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md)
for the conventions used by AFK agents and human contributors alike.

## Code of Conduct

We follow the [Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
A `CODE_OF_CONDUCT.md` file will land alongside the first community-facing release.
