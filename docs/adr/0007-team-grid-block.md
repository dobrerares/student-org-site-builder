# 0006 — teamGrid block: schema, renderer, AssetRef integration

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #12

## Context

Issue #12 is the second mandatory image-bearing block (after hero), and the
first to consume `@sosb/assets`'s `AssetRef`. The PRD (story 24, +
Implementation Decisions → Block library) pins the substantive decisions:

- Per-person fields: `name`, `role`, optional `photo`, optional `bio`,
  optional `socials`. `name` and `role` are mandatory.
- Optional `groupBy` lets the block bucket people under headed sub-groups
  (e.g. department headers). Single-level grouping only — nested groups
  are explicitly out of scope.
- Responsive grid at 2/3/4 columns, collapsing to 1 on narrow viewports.
- Photos go through the `@sosb/assets` content-addressing pipeline and
  carry mandatory alt text; missing photo falls back to an initial-letter
  avatar.
- A HISTORIPOL-shaped fixture (9 people across 4 departments) is the
  canonical test case.

The PRD does not pin: how the schema mirrors `AssetRef`, where group order
is determined, how social-platform icons hook into theme CSS, or whether
an Academic-theme golden ships in this issue. This ADR records those
choices.

## Decision

### Schema mirrors `AssetRef` rather than depending on `@sosb/assets`

The `photo` field on each person validates against a local
`PersonPhotoSchema` whose shape is field-for-field equivalent to
`@sosb/assets`'s public `AssetRef` interface (`hash`, `path`,
`metadataPath`, `mime`, `width`, `height`, `alt`). The schema package
deliberately does **not** add `@sosb/assets` as a dependency.

Reasons:

- `@sosb/schema` runs in every consumer (editor, build, tests). Pulling
  in `@sosb/assets` would transitively pull in `@sosb/vfs` and the
  canvas processor, which carries browser-only dependencies into
  Node-only contexts.
- The `AssetRef` shape is part of the persisted schema (it lives inside
  `data.json`), so it's already on the schema's public surface
  conceptually. Mirroring it locally lets the schema package express
  the contract without coupling to the runtime that produces it.
- ADR 0004 commits to the `AssetRef` field set as a stable v1
  contract; any future change there is a coordinated v1.x bump that
  both packages would absorb.

The runtime guarantee — that a parsed `photo` object always matches a
valid `AssetRef` — comes from the editor: the upload flow is the only
producer of `photo` values, and it returns a real `AssetRef` from
`uploadAsset`. The schema's role is to refuse malformed imports, not to
re-implement the upload pipeline.

### `alt` is required as a string but accepts empty; emptiness is a warning

`PersonPhotoSchema.alt` uses `z.string()` (no `.min(1)`). Two concerns
push us to accept empty alt at parse time:

1. A stale zip from a previous editor version may have empty alts; the
   parse-time hard-fail would block users from opening their own data.
2. ADR 0004 enforces non-empty alt at the *upload* boundary
   (`AssetError("asset.alt.missing")`), so the only way an empty alt
   reaches the schema is via stale data — exactly the case where we want
   a non-blocking nudge, not an error.

The validation rule pass surfaces every empty-alt photo as a `warning`
keyed `block.teamGrid.photo.alt.missing`, mirroring the hero block's
`block.hero.backgroundAlt.missing` rule.

### Group order = first-seen order on the people array

When `groupBy` is set, the renderer buckets people preserving the
first-seen order of the group key from the people array. Alphabetical
ordering would surprise editors who curated their roster intentionally
(leadership first, then directors, etc.). People missing the `groupBy`
key on their record fall into a trailing `Other` bucket — they are
never silently dropped. `Other` is hard-coded English in v1; i18n of
this fallback is owned by #34.

Rejected: alphabetical ordering, schema-declared group ordering. The
former breaks editor intent; the latter doubles the number of fields
to maintain when a person changes groups.

### Social platforms: open-set with deterministic class slug

Per-person `socials` is an array of `{ platform, url }`. We do not
restrict `platform` to a closed enum despite the PRD's "standard set
used by HISTORIPOL fixture" out-of-scope note. The schema accepts any
non-empty string; the renderer slugifies the platform into a CSS class
hook (`team-person__social--<slug>`), so the theme's per-platform icon
CSS is the source of icon coverage, not the schema. If a theme doesn't
recognise a platform slug, the link still renders (with the generic
`.team-person__social` class) — only the icon is missing.

Reasons:

- The "standard set" (linkedin, instagram, facebook, email, github,
  website, etc.) shifts faster than a schema bump. Closed-set would
  force a v1 minor bump every time a theme adds an icon.
- Forward-compat: a future v1.7 zip with a `mastodon` link still
  renders structurally on a v1.5 editor, with just the icon missing.
- The schema-level cost of an unknown platform is zero (looseObject),
  so there's no advantage to closing the set.

A visually-hidden span carrying the platform name is rendered inside
each social anchor for screen-reader users — this is the structural
fallback when no icon CSS attaches.

### Stub-theme golden, not Academic-theme golden

The AC names "grouped teamGrid × Academic theme" as the curated golden.
The Academic theme is owned by issue #47 and is not in scope here. We
ship a `stub-theme-team-grid-grouped.html` golden that captures the
HISTORIPOL fixture under the renderer's stub theme; #47 will land the
Academic-theme golden against the same fixture. This matches the
hero-block pattern, where the v1.x stub-theme golden is the regression
contract until the curated theme golden lands.

The PRD's 15-block × 5-theme matrix is populated incrementally — every
block × theme combination is its own golden. This issue ships
1 block × 1 theme = 1 new golden, plus the HISTORIPOL fixture that
every future theme golden will reuse.

### Responsive columns via `--team-grid-columns` custom property

Each `<ul class="team-grid__list">` carries an inline
`style="--team-grid-columns: N;"` attribute. The stub theme's CSS
maps that custom property to `grid-template-columns: repeat(var(...,
3), 1fr);` and a media query at `max-width: 640px` collapses to
`1fr`. Themes can override the breakpoint without changing the renderer.

Rejected: per-column-count utility classes (`team-grid--cols-2`,
`team-grid--cols-3`, etc.). Custom properties compose better with
breakpoints and avoid the combinatorial explosion when themes want
different columns at different widths.

## Rationale

The most subtle decision is the `AssetRef` mirror. Adding `@sosb/assets`
as a dependency of `@sosb/schema` would:

- Pull `@sosb/vfs` transitively into every typecheck-only consumer.
- Couple the schema's release cycle to the canvas processor's release
  cycle.
- Force build-time test fixtures (Node-only) to either polyfill
  `OffscreenCanvas` or skip the schema package entirely.

Mirroring the public `AssetRef` shape locally costs ~12 lines of Zod
and gets us a strictly narrower dependency surface. The cost — that a
breaking change to `AssetRef` would now require touching two packages —
is bounded by ADR 0004's commitment that `AssetRef` is stable for v1.x.

The "open-set platform with class slug" decision lets the renderer be
forward-compatible with future icon themes without schema churn. It
also means the renderer never has to understand what a platform is —
it just maps the string to a CSS hook. Theme authors own which
platforms get icons; schema authors own which fields exist; renderer
authors own structural HTML. Each layer's contract stays narrow.

## Consequences

- `@sosb/schema` adds `TeamGridBlockSchema` + types and registers it in
  `KnownBlockSchemas`. The validate.ts switch has a new `case "teamGrid"`
  for the missing-alt warning rule. No new runtime dependencies.
- `@sosb/renderer` adds `src/blocks/team-grid.tsx` and the page-shell's
  `renderBlock` switch grows a `teamGrid` branch. The stub theme's CSS
  grows by ~80 lines (block layout + visually-hidden utility +
  responsive grid). No new runtime dependencies.
- The build pipeline's `__golden__` snapshots (no-site-url and
  with-site-url) are regenerated to include the new stub-theme CSS;
  this is the same regeneration #47 will trigger when the Academic
  theme lands.
- Two new fixtures live in `packages/renderer/test/fixtures/`:
  `team-grid-historipol.json` (9 people × 4 departments, the canonical
  HISTORIPOL-shaped corpus) and `team-grid-flat.json` (ungrouped 2-person
  smoke fixture). The HISTORIPOL fixture is the one that #47's Academic
  theme will reuse for its golden.
- `packages/build/test/no-node-imports.test.ts` gains an explicit
  per-test timeout of 30 seconds. The test's first esbuild-bundle call
  walks the whole `@sosb/build` source tree on a cold cache; as the
  workspace grows (this PR adds ~300 lines of source the bundle has to
  trace) the call routinely exceeds vitest's 5-second default. The
  bumped timeout keeps the assertion semantics identical.

## Alternatives considered

- **Closed-enum social platform list.** Discussed in the Decision; the
  schema-level cost of accepting any string is zero (looseObject) so
  there's no advantage to closing it.
- **Schema-level alt enforcement (`.min(1)` on `photo.alt`).** Would
  hard-fail on stale zips with empty alts; the PRD's severity model
  (errors are blocking-on-confirmation, warnings are nudges) puts
  missing alt squarely in warning territory.
- **Bundling the Academic theme golden in this issue.** Would require
  implementing the Academic theme, which is #47's scope. Splitting along
  issue boundaries keeps reviews focused.
- **Schema-driven social-platform icons** (e.g. `iconUrl` per social).
  Would push design decisions into content. Theme-driven icons via
  class hooks is the cleaner separation.
- **`<address>` or `<dl>` instead of `<figure>`/`<figcaption>` for
  per-person markup.** axe-core accepts both; `<figure>` better matches
  "image with related caption", which is the team-card semantic.

## Out of scope

- Academic-theme curated golden — #47.
- Editor form for teamGrid (auto-form derivation walks the schema; the
  spine form generator from #7 covers the primitive cases, but the
  array-of-objects form for `people` lands with the editor's block-form
  follow-up).
- Per-person modal / expanded-bio detail views — explicit out-of-scope
  on the issue.
- Multi-level / nested grouping — explicit out-of-scope on the issue.
- Custom social platforms beyond the standard HISTORIPOL set — explicit
  out-of-scope on the issue (open-set schema means the data
  round-trips, but only "standard" platforms get icons in v1 themes).
- Schema-level "missing photo on a leadership person" rule — possible
  future quality nudge but not in v1.
