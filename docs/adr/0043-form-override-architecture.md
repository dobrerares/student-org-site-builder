# 0043 — Form-override architecture: schema-identity dispatch + side-table metadata

- **Status:** Accepted
- **Date:** 2026-05-11
- **Issue:** (TBD — lands alongside implementation issues for the asset picker, theme picker, and "Show advanced" toggle)

## Context

The editor's `SpineForm` and `BlockForm` are auto-generated from Zod
schemas via `form-generator.ts` (ADR 0005). The form-generator walks any
object schema and emits one DOM input per leaf field. This is
load-bearing — adding a new spine or block-data field is purely a schema
change, no editor code change.

Three categories of "the auto-generator is wrong for this field" have
accumulated:

- **Structural.** An entire sub-tree should be replaced by a single
  widget. Examples: every `AssetRef` (`hash`, `mime`, `path`,
  `metadataPath`, `width`, `height`, asset-level `alt`) collapses into
  one **asset picker**; the `theme` sub-tree carves out of the
  SpineForm into a separate **ThemeForm** (per CONTEXT.md's revised
  "Site spine" definition).
- **Textual.** The schema-name leaf label is jargon to a non-technical
  audience: `alt`, `slug`, `localizedAs`, `seo.title`, `seo.description`,
  etc.
- **Visibility.** Some fields are valid for power users but noise for a
  yearly-rotating student-org leader: `pages[].seo.*`,
  `pages[].localizedAs`. Some are already managed by a different UI
  affordance: `pages[].navOrder` is managed by `pages-ops.ts`'s
  reorder logic.

Four candidates for where the override knowledge lives were considered:

1. Encode in the Zod schema via `.meta()` / `.describe()`.
2. A side metadata table in `@sosb/editor-app`, keyed by JSON path.
3. Schema-identity-based dispatch in the form renderer
   (`if (schema === AssetRefSchema) ...`).
4. Bespoke per-block forms for every affected block (mirroring the
   existing `CustomHtmlBlockForm`).

## Decision

A **layered** approach: **Option 3 for canonical structural overrides;
Option 2 for everything else; Option 4 reserved for genuinely unique
blocks (currently `customHTML` only).**

### Schema-identity dispatch (Option 3) for canonical structural overrides

The form-generator gains a small registered-renderers map:

```ts
const SCHEMA_RENDERERS = new Map<ZodType, FieldRenderer>([
  [AssetRefSchema, AssetPickerRenderer],
  [DocumentRefSchema, AssetPickerRenderer],
]);
```

Before recursing into a nested `object` node, the walker checks identity:
if the schema reference matches a registered renderer, it returns a
`FieldNode` of kind `"custom"` carrying the renderer reference; the form
renderer dispatches accordingly.

Why identity, not structural matching: `AssetRef` is the canonical
asset-reference shape across many block schemas. Identity matching
means a refactor that renames its fields, or adds a 7th field, doesn't
break dispatch. Structural matching ("is this object an AssetRef?") is
fragile.

Direction of dependency: `@sosb/editor-app` already imports
`@sosb/schema`; reaching for the specific `AssetRefSchema` export is an
import addition, not a layering inversion.

### Side-table metadata (Option 2) for everything else

`packages/editor-app/src/field-metadata.ts` holds path-keyed override
tables, one for the spine and one keyed by block type:

```ts
export interface FieldOverride {
  /** Dotted path supporting "[]" for array-element wildcards. */
  readonly path: string;
  /** Replaces the schema-name leaf label. */
  readonly label?: string;
  /** Visibility tier; default is "default". */
  readonly tier?: "default" | "advanced" | "hidden";
  /**
   * Renderer name for non-default widgets that aren't dispatchable
   * by schema identity (e.g. "theme-picker" for theme.id which is
   * just z.string().min(1)).
   */
  readonly renderer?: string;
}
```

The form-renderer looks up overrides as it renders each leaf. Unknown
paths render with the form-generator's default — same drift-resistant
fallback discipline as `BLOCK_METADATA` (ADR 0019).

### Bespoke forms (Option 4) reserved for unusual data shapes

Reserved for blocks whose entire data shape is unusual enough that the
auto-generator + metadata can't carry it. Currently one such block:
`customHTML` (per ADR 0038, the sanitize toggle plus danger marker is a
bespoke composition). Future bespoke forms are admissible but
discouraged — every bespoke form is a divergent file to maintain.

### What goes where (concrete v1.x inventory)

**Schema-identity dispatch:**
- `AssetRefSchema` → asset picker
- `DocumentRefSchema` → asset picker (document variant)

**Metadata `renderer:` slot:**
- `theme.id` → `"theme-picker"`
- `theme.tokens.colorPrimary` / `colorAccent` → `"color-picker"`
- `theme.tokens.fontHeadline` / `fontBody` → `"font-picker"` (reads
  per-theme font list from the theme catalog)
- `theme.tokens.density` / `radius` → `"named-value-select"` with
  per-field option lists

**Metadata `label:` rewrites:**
- block-level `alt` (all variants) → "Image description (for screen readers)"
- `slug` → "Page address (the URL slug)"
- `localizedAs` → "Linked translation"
- `seo.title` → "Search engine title"
- `seo.description` → "Search engine snippet"
- `org.legalName` → "Official organization name"
- `org.shortName` → "Display name (used in nav)"

**Metadata `tier: "advanced"`:**
- `pages[].slug`
- `pages[].localizedAs`
- `pages[].seo.title`
- `pages[].seo.description`

**Metadata `tier: "hidden"`:**
- `pages[].navOrder` (already managed by the reorder UI in
  `pages-ops.ts`; rendering an input for it would compete with the
  drag/move-up/move-down affordances)

## Rationale

- **ADR 0002 already established the layering principle**: UI-adjacent
  concerns layer on top of the schema, not inside it (the same
  reasoning that pushed severity tagging out of Zod and into a
  validation rule-pass). Encoding `.meta({ ui: { hidden: true } })` on
  Zod fields (Option 1) would violate this — the schema would become
  two-purpose (data validation + UI hints), and the renderer + build
  pipeline would have to learn to ignore the UI half.
- **The block-catalog pattern (ADR 0019) already validates side-table
  metadata in the editor with a humanise fallback path.** `field-metadata.ts`
  extends the same pattern field-by-field instead of block-by-block.
- **Schema-identity dispatch is strictly more powerful than structural
  matching for canonical shapes like AssetRef.** The fragility of
  structural matching is avoided by accepting that the editor imports
  the schema package and can reach for specific schema references.
- **The "Show advanced" toggle** (per-form, hidden by default,
  session-scoped, no persistence) is implementable as a pure form-renderer
  concern reading `tier:` — no schema knowledge needed.

## Consequences

- New block schemas land with two additive shapes (the schema in
  `@sosb/schema` and the default-data factory in `@sosb/editor-app`).
  They MAY additionally land a `field-metadata.ts` entry — but the form
  is functional without one (humanise fallback for labels, default
  visibility tier, no custom renderer).
- The wizard (`@sosb/wizard`) does NOT use the field-metadata table —
  it is bespoke per ADR 0041, with its own narrow happy path. The
  wizard's hardcoded `THEMES` array in
  `packages/wizard/src/steps/identity.tsx` is duplication with the new
  theme catalog and SHOULD be refactored to read from the catalog as
  a separate follow-up; this is not strictly required by this ADR.
- The form-generator gains one new `FieldNode` kind (`"custom"`) and a
  renderer-registry parameter. The change is additive — existing
  inputs continue to render unchanged for any field not covered by
  dispatch or metadata.
- The "Show advanced" toggle, per-form, hidden by default, session-scoped:
  a per-form local component-state flag; no localStorage; not surfaced
  in the wizard.

## Alternatives considered

- **Option 1 (schema-encoded UI hints via `.meta()`)** — rejected for
  the ADR 0002 reason above. The schema package is shared with the
  renderer and the build pipeline; neither needs UI hints. Mixing them
  slows comprehension and creates a wider blast radius for UI-only
  changes. Migration cost away from this option later would be high
  because hints would be scattered across 15+ block schemas.
- **Option 4 across the board (8+ bespoke forms for asset-bearing
  blocks)** — rejected. Defeats the form-generator's design goal
  ("future blocks plug in without bespoke editor code") and multiplies
  maintenance. Reserved for the rare block where the data shape is
  itself unusual (currently customHTML; embed may be a future
  candidate).
- **Structural pattern matching** (e.g. "if a nested object has a
  `hash` and `mime` field, treat as AssetRef") — rejected for
  fragility. A future block that happens to have its own `hash` field
  for unrelated reasons would be misdispatched.
- **Persisted "Show advanced" state** (localStorage) — rejected. Target
  audience is yearly-rotating non-technical leadership, not returning
  power users. Persistence here would serve an audience that isn't the
  project's audience and is a foot-gun for new users inheriting an
  already-toggled-on editor.

## Out of scope

- Wizard refactor to consume the theme catalog (separate follow-up
  issue).
- Actual UI implementation of each renderer (`AssetPicker`,
  `ThemePicker`, color/font/density/radius pickers) — each lands its
  own implementation issue.
- Schema-side tightening of `theme.id` from `z.string().min(1)` to an
  enum — covered by ADR 0044's commentary on round-trip preservation.
- Help/tooltip strings per field. The `FieldOverride` shape leaves room
  for a `help?: string` slot in a future revision if the need
  materialises; v1 ships with label rewrites only.
