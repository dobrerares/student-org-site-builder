# 0003 — Migration framework: per-block versions, single-hop migrations, and the schema-version string

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #26

## Context

ADR-0002 (issue #3) landed the `@sosb/schema` migration scaffold —
`migrateSite`, `migrateBlock`, `SITE_MIGRATIONS`, `BLOCK_MIGRATIONS`,
`KNOWN_BLOCK_VERSIONS` — but the tables were empty and no real migration
had ever run end-to-end. Issue #26 asks us to exercise the framework with
one synthetic v1 → v1.1 bump and to publish the pattern that future
migrations will follow.

The PRD pins the v1 forward-compatibility contract: additive-only changes
inside the v1.x series, preserve-unknown-keys for forward-compat, unknown
block types render as placeholders, and the editor surfaces a banner toast
when a migration is applied on load. ADR-0002 covers the schema/validation
surface; this ADR records the migration-specific decisions that surfaced
when actually running a migration.

## Decision

### The synthetic exercise: hero v1 → v2 with `align`

The hero block bumps from version 1 to version 2 with one additive change:
an optional `align` field with three allowed values (`"left" | "center" |
"right"`) and a default of `"left"`. The migration is registered in
`BLOCK_MIGRATIONS` as `{ type: "hero", from: 1, apply }`. The `apply`
function clones the block, copies `data`, and fills `align` with the
default only when the field is genuinely absent — pre-existing values
(including unknown future ones that survived through preserve-unknown-keys)
are kept verbatim.

### `applyAllMigrations(data)` is the single editor-facing entrypoint

The editor (#7) calls one function on load:

```ts
function applyAllMigrations(data: unknown): {
  data: unknown;
  migrationApplied: boolean;
  fromVersion: string;
  toVersion: string;
};
```

This composes `migrateSite` (site spine) with a per-block walk over every
page's blocks. The result is a freshly-built object (the input is never
mutated) plus the metadata the editor needs to render the
"Site upgraded to schema v…" banner toast.

`migrationApplied` is the boolean the editor reads. The toast UI itself
is owned by the editor in #7 — this package exposes the API only.

### Schema-version string format: `"<site>.<aggregate-block-minor>"`

The PRD speaks loosely of "schema v1.1". The migration framework
formalises this as `"<site>.<aggregate-block-minor>"`, where the
aggregate-block-minor is

```
sum(version - 1) over every type in KNOWN_BLOCK_VERSIONS
```

With one known block type (hero) at v2, the aggregate is `1`, so the
current schema reads as `"1.1"`. When hero bumps to v3 (or another block
type lands at v2), the aggregate grows in lockstep. The form is
intentionally simple — the editor only renders this string for human
display; nothing parses it programmatically.

For computing `fromVersion` we observe the _minimum_ version of each
known block type across all pages and treat unobserved types as
already-current (so a site without hero blocks still reads as the current
`"1.<current>"`). This makes the version string monotonic even on
edge-case sites.

### Single-hop migrations only in v1

Within the v1.x series the migration table holds only single-hop entries:
each `{ from, apply }` bumps the block by exactly one version. Multi-hop
chained migrations are explicitly out of scope per the issue triage. The
framework's loop already chains single-hops, so a future v1 → v3
migration is just two `{ from: 1, apply }` and `{ from: 2, apply }`
entries — no API change needed.

### Preserve-unknown-keys is honoured by every migration

Migration `apply` functions must:

1. Copy unknown fields verbatim (i.e. spread the input rather than
   reconstruct the shape from scratch).
2. Never overwrite a field that already exists, even if the field is the
   one the migration "owns" — a pre-existing value (perhaps from a future
   editor that round-tripped through this older one) takes precedence
   over the default.

This is enforced by tests in `packages/schema/test/migration-exercise.test.ts`
and is the load-bearing invariant for the additive-only v1.x promise.

### Unknown block types short-circuit to identity

`migrateBlock` already returns the input unchanged when `block.type` is
not in `KNOWN_BLOCK_VERSIONS`. `applyAllMigrations` walks every block
through `migrateBlock`, so unknown blocks ride through migration
untouched. The renderer (#46) and editor (#7) render the placeholder UI;
the schema's job is to make sure the data survives byte-identical.

### Future-version rejection

`applyAllMigrations` propagates the rejection that `migrateSite` and
`migrateBlock` already do for `schemaVersion` / `block.version` values
greater than this editor knows. The error is surfaced to the editor,
which is responsible for showing a "site is from a newer editor; please
update" message (a UI concern owned by #7).

## Rationale

- **Per-block versions, not per-schema versions**: The PRD pins this
  already — different block types evolve independently because their
  schemas are independent. The migration table mirrors that fact: keys
  are `(type, from)` pairs, not just `from`. A hero v1 → v2 doesn't
  require touching any other block type's table or version.
- **Aggregate-block-minor over per-type minors**: The display string is
  one number; if every block type carried its own minor in the version
  string the result would be unreadable (`"1.hero=2,quote=1,faq=3"`).
  Summing the minors and rendering one number trades precision for
  readability. Anyone who needs precision reads `KNOWN_BLOCK_VERSIONS`
  directly.
- **Single-hop chains over multi-hop**: Each `apply` function is then
  trivially testable in isolation — given a v(n) block, return a v(n+1)
  block. The framework composes them. This matches how database
  migration tools (Rails, Liquibase, Alembic, Supabase) have settled
  the same trade-off.
- **`applyAllMigrations` over a streaming/iterator API**: The editor
  loads the whole site at once anyway. Eager site-wide migration is
  simpler than lazy block-level migration, and the upgrade-on-load
  semantics match the PRD's manual save flow (one migration per load,
  not per save).
- **Toast UI owned by #7, not by `@sosb/schema`**: The schema package
  has no UI dependencies and cannot grow them without becoming an
  editor package. Returning `migrationApplied: boolean` is the cleanest
  seam — the editor reads the boolean, decides whether to render a
  toast, and renders it with whatever toast component it owns. This
  also keeps the schema package testable in pure-Node Vitest without a
  DOM.

## Consequences

- The historipol fixture moves from "the current shape" (post-PR) to v2
  hero blocks. A separate `historipol-legacy.json` fixture preserves
  the pre-migration shape, so migration tests have a stable witness of
  "what an old site on disk looks like." Future bumps follow the same
  pattern: rename the previous current fixture to `*-legacy-v…`,
  update the canonical fixture to the new shape, and write migration
  tests against the legacy fixture.
- The editor (#7) calls `applyAllMigrations(data)` exactly once, on the
  load path before validation. It surfaces the toast when
  `migrationApplied` is true. The toast text reads "Site upgraded to
  schema v${toVersion}" by convention.
- Every new block migration adds a single entry to `BLOCK_MIGRATIONS`,
  bumps the corresponding `*_BLOCK_VERSION` constant, and ships a
  pre-migration fixture + tests. CONTRIBUTING.md walks through the
  pattern.

## Alternatives considered

- **Multi-hop migrations baked into the API** — rejected; the issue is
  explicit about single-hop only in v1, and the framework already
  composes single-hops into chains via the existing while-loop.
- **Streaming migration (per-block lazy)** — rejected; site-wide
  migration on load is simpler, matches the editor's load model, and
  doesn't add a second code path for "what if a block is requested
  before its migration ran." The editor owns the load, so eager
  migration is the natural fit.
- **Encoding the version string as a separate field on the site** —
  rejected; `schemaVersion` already exists, and the per-block
  `version` already exists. Adding a third version field would mean
  three places that can drift. Computing the display string from the
  two existing fields keeps the source of truth singular.
- **Embedding the toast UI inside `@sosb/schema`** — rejected; would
  make the schema package depend on Preact and DOM types, breaking the
  pure-Node test boundary established in ADR-0002.

## Out of scope

- Real production migrations beyond the synthetic exercise (when
  v1.x ships, each new block schema bumps as needed).
- Multi-hop chained migrations as a first-class API.
- Automatic backups before migration (manual save flow only — out of
  scope per #26 triage).
- A GUI for migration selection or rollback.
- The toast UI itself (owned by #7).
