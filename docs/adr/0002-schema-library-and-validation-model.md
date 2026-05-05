# 0002 — Schema library and validation model

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #3

## Context

Issue #3 asks for the `@sosb/schema` module: a site-spine schema, a hero block
schema, a `validate()` entrypoint that returns issues with severity tiers and
paths, a migration scaffold, and preserve-unknown-keys behaviour so that
`data.json` files round-trip losslessly across editor versions.

The PRD (Implementation Decisions → Data & schema, and → Schema validation &
severity) pins the substantive decisions:

- The site has `schemaVersion: 1` for all of v1.x.
- Block envelope is `{ id, type, version, data }` with per-block `version` to
  support independent migration.
- **Additive-only changes within v1.x.** Forward compatibility via
  preserve-unknown-keys: unknown blocks render as placeholder cards in the
  editor and HTML comments in built sites; unknown fields are preserved
  opaquely on round-trip.
- Three severity levels:
  - **error** — high-friction confirmation, but never hard-block (manual
    override allowed).
  - **warning** — surfaced inline, never blocks publish.
  - **info** — silent, surfaced only on a Site Health panel.
- Errors are conservative (empty org name, missing pages, malformed/duplicate
  slugs, missing required block fields, broken asset references, etc.).

The PRD does **not** pin a runtime validation library. This ADR records that
choice and the validation-model choices it implies.

## Decision

### Validation library: **Zod 4**

`zod` (v4.x) is added as a dependency of `@sosb/schema` only — not at the
workspace root. No other package needs runtime validation in v1.

### Single-source-of-truth types

TypeScript types are derived via `z.infer<typeof Schema>` from the same Zod
schema objects that power runtime validation. No hand-maintained type aliases
mirror the schemas.

### Preserve-unknown-keys policy

Every object schema that lives on the persistence boundary (site root, page,
block envelope, block-data shapes, asset metadata, etc.) is declared with
`z.looseObject()` (Zod 4's preferred form for "object that retains unknown
keys"; the v3 alias `.passthrough()` is deprecated in v4 but behaves the
same way). Zod's loose object preserves unknown fields rather than
stripping them. Unknown block `type` values are accepted at the envelope
level — the envelope validates `id`/`type`/`version`/`data` shape but does
not enforce a closed set of `type` values, so a block this version of the
editor doesn't recognise still survives a read-write-read cycle
byte-identically.

The round-trip identity test is the contract: parse arbitrary
schema-conforming JSON (with extra fields and unknown block types), then
re-serialise it, and the resulting JSON must be deep-equal to the original.

### Validation contract: `validate(data)`

```ts
type Severity = "error" | "warning" | "info";

interface ValidationIssue {
  severity: Severity;
  path: (string | number)[]; // JSON-pointer-style path into the input
  code: string; // stable machine code, e.g. "site.org.name.empty"
  message: string; // human-readable, English in v1
}

interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  ok: boolean; // shorthand: errors.length === 0
}

function validate(data: unknown): ValidationResult;
```

- **Schema violations** (wrong types, missing required fields, malformed
  enums) become **errors**.
- **Quality nudges** that the PRD lists under "warnings" (missing image alt,
  missing org email, etc.) are layered on top of the schema parse as
  additional rule passes against the parsed data.
- **info** is reserved (no rules in v1; the field exists in the result so
  callers can render Site Health UI without conditional shape).

Paths are arrays of string keys and numeric indices, matching the way Zod's
own `ZodIssue.path` is structured. Callers that want a JSON-pointer string
can `path.join("/")`.

### Migration framework

Two no-op entrypoints land in v1:

```ts
function migrateSite(data: unknown): { data: unknown; appliedVersions: number[] };
function migrateBlock(block: unknown): { block: unknown; appliedVersions: number[] };
```

`migrateSite` looks at `data.schemaVersion` and walks an internal table of
version-bump migrations from that version up to the current
`SITE_SCHEMA_VERSION`. In v1 the table is empty (current version = 1, no
prior versions), so every call is the identity. `migrateBlock` does the same
for individual blocks keyed by `(type, version)`. This shape is what
issue #26 will populate with real migrations; today it just exists so the
caller code path is in place and the seam is tested with a smoke test.

## Rationale

- **Zod 4 over Valibot, Arktype, or hand-rolled validators**:
  - The triage brief calls Zod the "safe default" and the rest of the
    project hasn't earned exotic alternatives yet.
  - Zod's `z.infer` is the lightest path to single-source types.
  - Zod's issue model exposes both `path` and `code` per failure, which maps
    cleanly to the PRD's "errors with paths to each issue" requirement.
  - `z.looseObject(...)` is the documented, supported way to
    preserve-unknown-keys in Zod 4, which the round-trip identity test
    depends on.
  - Zod's bundle size cost is acceptable for a desktop-and-browser editor;
    the published static sites ship with no schema runtime, so end-user
    site weight is unaffected.
- **Severity layered on top of schema parse, not encoded in the schema
  itself**: Zod doesn't natively model "this is a warning, not an error."
  Trying to encode warnings inside the schema would either require splitting
  into two schemas (warnings vs errors) or abusing `superRefine` with
  out-of-band severity tagging. Both bend the library away from its
  intended shape. Keeping schema parse = errors and adding rule passes for
  warnings is more honest and lets us add new warning rules without
  schema churn.
- **Blocks are open-set at the envelope, closed-set inside known types**:
  An unknown block `type` (e.g. a v1.7 editor seeing a `partnerLogos`
  block from a future v1.10 zip) must round-trip without data loss. This
  is the load-bearing forward-compat behaviour. Inside a known type,
  schema validation enforces the type's contract.

## Consequences

- `pnpm -F @sosb/schema add zod` is run inside the worktree; the lockfile
  carries the dependency only inside the schema package.
- Other packages that need types (renderer, editor-state, build, …) will
  import them from `@sosb/schema` rather than redeclaring shapes.
- Future block schemas (#9–#22) follow the hero block's pattern: a
  `z.looseObject({...})` with a `version` literal and an entry in the
  block-type registry.
- Migration entries (#26 onward) extend the migration tables in
  `migrate.ts`; the public `migrateSite` / `migrateBlock` API does not
  change.
- The HISTORIPOL fixture lives at `packages/schema/test/fixtures/historipol.json`
  and is the canonical "shape we must never break" reference for the schema.

## Alternatives considered

- **Valibot** — leaner runtime, but its preserve-unknown-keys story is less
  established and its ecosystem is younger. Worth revisiting in v2 if bundle
  size becomes an issue, but the schema library only runs in the editor
  (never in built sites), so the bundle pressure is low.
- **Arktype** — interesting compile-time + runtime story, but the project
  is greenfield and we should not adopt the cutting edge for a load-bearing
  module.
- **Hand-rolled validators** — drops the library dependency but loses
  derived types, structured issue paths, and round-trip helpers. Would
  cost more code than it saves.
- **Encoding warning rules inside the Zod schema (via `superRefine` with
  severity tags on the message)** — fights the library; see Rationale.

## Out of scope

- Real version-bump migrations (issue #26).
- Block schemas beyond hero (issues #9–#22).
- Editor form generation from schemas (issue #7).
- Renderer or build integration (issues that own the renderer / build).
- i18n of validation messages — v1 emits English `message` fields; the
  editor/i18n module owns localisation by `code`.
