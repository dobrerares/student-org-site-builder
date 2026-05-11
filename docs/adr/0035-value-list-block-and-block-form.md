# 0035 — `valueList` block, curated icons, and the generic `BlockForm`

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #10

## Context

Issue #10 is the first non-`hero` block to land. The PRD lists 15 blocks
total and explicitly reuses the same triple of seams for each one:

1. A schema entry in `@sosb/schema`'s block registry.
2. A renderer component in `@sosb/renderer` (structural HTML only — themes
   own the visual treatment).
3. An auto-generated editor form, driven by #7's introspection framework,
   covering add / remove / reorder for any item-collection blocks
   (`valueList`, `activitiesList`, `teamGrid`, `imageGallery`,
   `documentDownloads`, `eventList`, `partnerLogos`, `faq`).

`valueList` is also the first block that needs:

- An **icon** field whose value comes from a curated set the editor exposes
  as a picker — the PRD's "lucide subset" rule (no SVG paste, no custom
  uploads). v1 must ship icons inlined into the rendered HTML because the
  built sites carry no client JS to load icons at runtime.
- An **items** array editable in the auto-generated form: add new item,
  remove an item, reorder up / down. #7's `SpineForm` deliberately stopped
  at "array summary" because block forms were out of scope; #10 needs the
  full array UI.

Both are cross-cutting decisions that future blocks reuse, so they are
recorded here rather than buried inside `valueList`-specific files.

## Decision

### Block schema shape: same envelope as `hero`

`ValueListBlockSchema` mirrors `HeroBlockSchema`'s structure (`looseObject`
with `id`, `type` literal, `version` literal, `data` payload that is itself
a `looseObject`). The `data` shape is `{ title?, intro?, items, layout,
columns }`, with `items` an array of `{ icon?, label, description? }`.

`layout` is an enum of `"grid" | "list"` with default `"grid"`. `columns`
is `z.number().int().min(1).max(4).default(3)`. Choosing a refined number
over `z.union([z.literal(1), ...])` keeps the form generator happy
(numeric input renders cleanly) and matches how the themes' CSS will
consume it (an integer attribute in `data-columns`).

`isKnownBlockType("valueList")` returns true; the registry entry is the
only place editor and renderer consume the schema, so adding the block in
issue #10 is a single-source-of-truth change.

### Curated icon strategy: hard-coded path table in the renderer

Adding `lucide-static` as a dependency would pull all of lucide's 1500+
icons into every editor build. Instead, two collaborating tables live
side-by-side:

- `VALUE_LIST_ICON_NAMES` (in `@sosb/schema`) — the curated string-literal
  enum the editor's icon picker iterates and the schema's `icon` field
  enforces.
- `VALUE_LIST_ICON_PATHS` (in `@sosb/renderer`) — a `Record<name, string>`
  whose values are the inner SVG path data (lucide v0, dual-licensed
  Apache 2.0 / ISC). The renderer wraps each in a renderer-owned `<svg>`
  envelope tagged `aria-hidden="true"`, `data-icon="<name>"`, with
  fixed viewbox / stroke attributes.

Adding a new icon is a two-touch change (one entry in each table) — the
editor's auto-generated form picks it up because the picker reads the
schema's enum. The renderer tolerates icon names absent from its path
table (silently skips the SVG, label still renders); this is the
forward-compat contract for a future editor that adds icons we do not yet
know about.

### Editor: the generic `BlockForm`

A new component, `BlockForm` (in `@sosb/editor-app`), takes any block-data
schema and renders the auto-generated form. It is generic over the data
shape (typed `<TData>`) and produces:

- One leaf `<input>` / `<select>` per primitive field.
- Nested `<fieldset>` for object subtrees.
- A full array editor for any `array` field: `<ol>` of items, each with
  Move-up / Move-down / Remove buttons; an Add-item button below.
- Optional `newItem(arrayPath)` factory so callers can choose the default
  shape of a freshly-added item (e.g. `{ label: "New value" }` for
  valueList items).

The component is the seam future blocks (#11–#22) plug into; per-block
issues only contribute the schema and the renderer component, not bespoke
form code.

This sits _alongside_ `SpineForm` (which still walks `SiteSchema` with the
`pages[].blocks` carve-out) — site-spine fields and block-data fields have
different patch shapes, and trying to reuse `SpineForm` for blocks would
have meant either weakening its types or carving the array-editor surface
into a generic with no testable callsite for v1.

### `FieldNode.path` widened to `(string | number)[]`

The site-spine form previously typed every node path as `string[]`. Block
forms address array slots by index (`items.0.label` becomes
`["items", 0, "label"]`), so the type is now `(string | number)[]`. The
runtime helpers (`getAtPath` / `setAtPath`) already supported numeric
segments — this is purely a type-surface change, propagated through
`SpineForm`'s `onPatch` and the editor app's `patch` callback. The
`fieldsFromSchema` walker also unwraps `default(...)` schema wrappers in
addition to `optional` / `nullable`, because Zod 4 wraps default-bearing
fields with a separate `default` type that needs to be peeled to reach the
underlying primitive.

## Rationale

- **Schema-first**: keeping the icon enum in the schema means the editor
  and the validation pipeline share a single source of truth. A site that
  carries an icon name removed from a future curated set will fail
  validation with a precise `path` and stable `code`, which is the
  severity-tiered model from ADR 0002.
- **Inlined SVG vs runtime icon font**: shipped sites have no JS, so an
  icon font or `<use>` reference into a separate sprite would still need a
  network round-trip. A 24×24 inline `<svg>` is ~150–300 bytes per icon;
  the curated set is 15 icons, so the worst-case payload is a few KB on a
  page that uses every value at once — well within the PRD's per-page
  budget. The renderer-owned wrapper keeps `aria-hidden="true"` consistent
  across all icons (the label conveys the meaning).
- **Generic `BlockForm` over a hand-rolled `valueList` editor**: the PRD
  has at least 8 array-bearing blocks. Building a fresh array editor in
  each block's issue would multiply the surface area; centralising in
  `BlockForm` means `valueList` also pays the cost of test coverage for
  every future block.
- **Path widening over a sibling type**: introducing a separate `BlockPath`
  alias would have forked the patch-callback ecosystem. `(string |
number)[]` is the obviously-right shape because JS object access already
  accepts both kinds at runtime; the type widening just acknowledges what
  was already true.

## Consequences

- `@sosb/schema` exports `ValueListBlockSchema`, `ValueListDataSchema`,
  `ValueListItemSchema`, `VALUE_LIST_ICON_NAMES`,
  `VALUE_LIST_LAYOUTS`, `VALUE_LIST_COLUMNS`, and the inferred types.
- `@sosb/renderer`'s `PageShell` `renderBlock` switch grew a `valueList`
  branch; the stub theme adds layout-only CSS keyed on
  `[data-block="valueList"]`, including a `@media (max-width: 600px)`
  rule that collapses every grid layout to a single column for narrow
  viewports.
- The hero golden and the build-package distribution goldens both rolled
  forward because the stub theme's CSS expanded. The diff is purely
  additive (the existing `[data-block="hero"]` rules are unchanged).
- `@sosb/editor-app` ships `BlockForm` plus tests covering add / remove /
  reorder for valueList items.
- The form-generator now unwraps `default(...)` wrappers; this means any
  schema field with a default value is reported as `optional: true` to
  the consumer (which is correct: the user can leave it blank and the
  schema's default fills in).

## Alternatives considered

- **Pull `lucide-preact` or `lucide-static` as a dep**. Larger bundle for
  the editor; harder to enforce the curated subset (would need an
  allow-list runtime check anyway). Re-evaluate if the curated set grows
  past ~50 icons.
- **Render the icon as an `<img src=".../icon.svg">`**. Requires an asset
  pipeline that bakes per-icon files into the dist; adds HTTP requests
  on the published site. Inline SVG sidesteps both.
- **Reuse `SpineForm` and conditionally render the array editor**.
  Tightly couples site-spine concerns (the `Site` snapshot type, the
  `applyPatch` helper) to per-block concerns. The shapes are similar but
  not the same: a block patch path starts at the block's data, not at
  the site root. Keeping them separate is cleaner.
- **Schema-side icon-validation via `superRefine` to surface a friendlier
  error**. The Zod enum's default error is precise enough (`Invalid
enum value`) and the editor can localise by `code`. Skip the extra
  pass.

## Out of scope

- Per-theme curated golden files for `valueList × Academic` (lives in
  #47 / #28-#31). The stub-theme golden lands here as the regression
  framework's first valueList anchor.
- The other 13 blocks (#11-#22). Each follows this pattern: schema
  registry entry, renderer component, page-shell branch.
- A dedicated `BlockEditor` panel that ties `BlockForm` into the
  editor-app's site-data state and preview bridge — that is the editor's
  block-CRUD issue (not yet broken out from the parent #1 epic).
  **Update (2026-05-11):** the deferred wiring landed under ADR 0042,
  alongside the BLOCK_METADATA + DEFAULT_BUILDERS backfill that ADR 0008
  anticipated as per-block additive PRs.
- Markdown rendering inside `description` — explicitly out of scope per
  the issue's triage comment.
