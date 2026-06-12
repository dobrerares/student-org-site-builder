# 0042 — Editor pane drill-in pattern, block-form wiring, and curated seed

- **Status:** Accepted
- **Date:** 2026-05-11
- **Issue:** TBD (cuts the deferred block-CRUD work from ADR 0035's "Out of
  scope" section, plus the seed-swap follow-up to ADR 0024)

## Context

ADR 0035 ("`valueList` block, curated icons, and the generic `BlockForm`")
shipped the generic `BlockForm` component and explicitly deferred its
wiring into the editor app:

> "A dedicated `BlockEditor` panel that ties `BlockForm` into the
> editor-app's site-data state and preview bridge — that is the editor's
> block-CRUD issue (not yet broken out from the parent #1 epic)."

That deferral made sense while individual block PRs (#11–#22) were still
in flight: each block landed schema + renderer + tests independently, and
the editor wiring would have been merge-conflict bait. The deferral has
now expired — all 15 block schemas and renderers are merged, the
`BlockForm` exists and is exported (`@sosb/editor-app`'s `index.tsx`),
but it is _mounted nowhere_. The block list shows label, title, drag
handle, move, remove. There is no per-block field editor.

A second, related deferral comes from ADR 0008 ("Block library picker,
DnD reorder, and undo/redo history"), which intentionally designed the
catalog metadata fallback as graceful:

> "Adding metadata is a separate, additive PR."

Today only `hero` has entries in `BLOCK_METADATA` and `DEFAULT_BUILDERS`.
The other 14 block types fall back to a humanised label, the
`optional` category, and an empty `data: {}`. So even if the user could
reach a block-data editor, every non-hero block they added would render
as a blank section.

A third, smaller gap: ADR 0024 ("Academic theme — first pass") stated
the curated HISTORIPOL Academic demo is _"the default demo"_ of the
project, but the archival build's `run-archival-build.ts:72` defaults
its seed to `packages/browser-shell/test/fixtures/minimal-site.json`
(one hero, `"Stub Org"`). The curated demo data
(`asociatiaStudenteascaDemoData`, exported from `@sosb/themes`) exists
and is wired through `RunArchivalBuildOptions.initialSitePath`, but the
override is never used. The result is that the editor opens with a
deliberately-degenerate test fixture instead of the documented
production seed.

These three gaps interact: until the editor can edit block data, the
seed sparseness is the dominant pain ("I edit a field, nothing visible
changes"). Once the editor can edit blocks, the seed sparseness becomes
the _next_ dominant pain ("I drilled into the one hero, edited the
title, and now what?"). Resolving them together produces a coherent
"the editor works end-to-end on real content" outcome that no single
fix delivers alone.

What this ADR does not pin (still deferred, see _Out of scope_ below):

- The iframe-reload-on-keystroke behaviour. The editor's preview
  iframe currently reloads in full every time `srcdoc` is reassigned,
  which produces a white flash and resets scroll. ADR 0005 chose this
  deliberately and the choice still holds for the _built site_ contract;
  whether it should hold for the _preview iframe_ is a separate
  re-architecture.
- Selection sync between the inspector and the preview iframe (clicking
  a block scrolls the iframe to that block, highlights it). Sound only
  becomes useful once the iframe stops reloading on every keystroke;
  pairs naturally with the deferred iframe re-architecture.
- Designed default _content_ for blocks added via the dialog. This ADR
  ships _functional placeholders_ — schema-valid stubs the user
  immediately overwrites. Curated copy is a follow-up content pass.

## Decision

### Editor pane shape: drill-in inspector replacing the flat stack

The editor pane today is a flat vertical stack:

```
PagesList
SpineForm (everything except blocks — long, deeply nested)
BlockListEditor (rows: label, title, reorder, remove — no edit)
LocaleToggle
```

It becomes:

```
Un-drilled view (default):
  PagesList
  BlockListEditor (rows: label, title, reorder, remove, click-to-drill)
  Site settings (link/button to drill into spine editing)
  LocaleToggle

Drilled view (when a block is the active block):
  PagesList                       ← stays so page switching still works
  ← Back to blocks                ← drill-out affordance
  BlockForm for the active block
  LocaleToggle

Site settings drilled view (when triggered by the link):
  ← Back to blocks
  SpineForm (unchanged internals)
  LocaleToggle
```

Drilling in is triggered by clicking a block row's primary affordance
(label/title area). Drilling out is a dedicated back link. The
`BlockListEditor` row's existing controls (drag handle, move buttons,
remove) keep their semantics — they operate on the envelope without
drilling in. The keyboard alternative for drill-in is `Enter` on the
row's primary affordance; `Escape` from the inspector drills out.

Mobile (tab) layout: identical, scoped to the Editor tab. The inspector
replaces the editor tab's body; the Preview tab is unaffected.

Rejected:

- **Inline expand-on-click rows.** Doubles or triples the editor pane's
  scroll length when a block has a deep schema (e.g. `teamGrid` with N
  members). Mixes envelope-level controls (move/remove) with data-level
  editing in a single visual unit, making both noisier.
- **Modal dialog over the iframe.** Breaks the "edit, see live
  preview update" loop that the PRD's 200ms preview SLA was written
  for. Reuses an existing UI pattern (`AddBlockDialog`) but to the wrong
  end.
- **Three-pane layout (pages | block list | block form | preview).**
  Doesn't fit the established two-pane model from ADR 0005, shrinks the
  preview, requires a third tab in narrow-viewport mode.
- **Vertical tabs (`Pages | Site | Active block`).** Active-block tab
  is meaningless without a selected block, producing a perpetually-
  dimmed third tab. Invents a navigation mode the rest of the editor
  doesn't use.

### Bundle scope: wiring + metadata + defaults + seed

Five things land in the same change:

1. The drill-in pane shape above.
2. Wiring `BlockForm` into the inspector with the per-block schema from
   `KnownBlockSchemas[block.type]` and a patch path of
   `["pages", i, "blocks", j, "data", ...]`.
3. `BLOCK_METADATA` (in `block-catalog.ts`) gains entries for the 14
   non-hero block types: category + label + description per type. Today
   these fall back to `optional` + a humanised label + a generic
   description; with this change they show their designed labels and
   categories in the Add Block dialog.
4. `DEFAULT_BUILDERS` (in `block-defaults.ts`) gains entries for the 14
   non-hero block types: a `version` + a `data()` factory returning
   schema-valid placeholder data. Newly-added blocks render as
   functional, immediately-editable stubs instead of blank sections.
5. The archival build's seed is swapped from `minimal-site.json` to
   `asociatiaStudenteascaDemoData`. `run-archival-build.ts` imports the
   curated demo from `@sosb/themes` and passes its serialised JSON as
   the seed. The minimal-site fixture remains where it is for tests
   that want the degenerate case.

Bundling is deliberate: each piece individually leaves a user-visible
gap unresolved. Wiring without metadata/defaults gives "blocks are
editable but blank." Metadata without wiring gives "the dialog reads
better but added blocks are still uneditable." Seed-swap without
either gives "the editor opens with rich content the user can't edit."
The combined change is the smallest unit that delivers a coherent
"blocks now work" outcome.

Rejected:

- **Strict ADR 0008 cadence (one PR per block, 14 PRs).** The
  cadence's reason — risk-isolation while schema PRs are in flight —
  no longer applies. Splitting now multiplies review overhead without
  reducing risk.
- **Wiring-only, defaults-and-metadata as a sibling issue.** Lands a
  drill-in inspector that for 14 block types shows a form full of
  blank required fields. Worse demo than today's "blocks aren't
  reachable from the UI" because the user _expects_ the inspector to
  be useful.
- **Seed swap as a sibling issue.** Decouples cleanly but means the
  wiring lands and is demoed against the degenerate one-hero seed.
  The reviewer's mental model of "does this work?" is shaped by the
  demo content; demoing against rich content is worth the bundling.

### Default content policy: functional placeholders this round

The 14 new `DEFAULT_BUILDERS` entries return schema-valid stubs the
user immediately overwrites. Concretely: a new `faq` block lands as
`{ title: "New FAQ", items: [{ q: "Question?", a: "Answer." }] }` rather
than as `{ title: "Întrebări frecvente", items: [{ q: "Cine puteți să
fim?", a: "Suntem o asociație studențească..." }] }`.

Designed copy (the latter shape) is a deliberate follow-up content
pass — it is content work, not wiring work, and bilingual review (the
project's `defaultLanguage` is `ro`) shouldn't gate the wiring PR.
Functional placeholders meet the schema, render correctly, and read
as obvious-placeholder so the user knows they are meant to overwrite.

The combination "rich curated seed + functional placeholders for added
blocks" is intentional. The seed gives the user a "look how a finished
site reads" reference; the placeholders are starting points the user
edits. Mixing the two registers (designed seed, scaffolded placeholders)
is the correct pedagogical signal: the user learns "the seed shows the
goal, the placeholders show the structure I fill in".

### Strict scope: no SpineForm rework, no theme-picker work

Two adjacent ergonomic issues are explicitly _out of scope_ for this
issue:

- The SpineForm's auto-generated UI for the deeply-nested SiteSchema is
  ergonomically rough (a long flat list of `org.*` and `theme.tokens.*`
  fieldsets, no grouping, no per-field guidance). The drill-in pattern
  relegates it behind "Site settings", which is sufficient for v1.
  Improving the SpineForm itself is its own work.
- The theme picker UI (PRD §41-46) has its own design spec already
  landing in a parallel series of commits. The spine form's `theme.id`
  field stays a string input under this issue; the picker overlays it
  later without restructuring.

The exclusion is positive: keeping this issue tightly scoped to "wire
blocks end-to-end" makes the diff reviewable in a sitting and the
behaviour change one coherent thing.

## Rationale

The most subtle choice is the drill-in pattern over inline expansion.
Both are valid — most page builders use one or the other (Notion drills
in, WordPress's Gutenberg expands inline, Webflow's right panel is a
fixed three-pane variant). The decision turned on three factors:

1. **Pane height.** `teamGrid` with N members produces a form with N
   sub-fieldsets, each with member-specific fields. Inline-expanded,
   the editor pane becomes mostly that one block, scrolled past
   everything else. Drill-in gives the form the full pane width and
   height, then drills back out.
2. **Mixing envelope controls and data controls.** The block row holds
   move-up/move-down/remove (envelope-level operations). Inline-expanded,
   data-level field editing happens _inside_ a row that also holds
   structural controls — pressing Tab from the last data field lands on
   "Remove block" by accident. Drill-in cleanly separates "the row
   manipulates the block in the page" from "the inspector edits the
   block's data".
3. **Symmetry with PagesList.** PagesList is already a list of items
   the user clicks to _navigate to_ (changing the active page). Adding
   a sibling list (BlockListEditor) where the user clicks to _navigate
   to_ (changing the active block) reuses the same pattern. Inline-
   expansion would break this symmetry; drill-in extends it.

The bundle-scope choice (wiring + metadata + defaults + seed in one
issue) was the second non-obvious call. ADR 0008 explicitly anticipated
the metadata/defaults backfill as separate per-block PRs, and adhering
to that letter would have been defensible. We're departing from it
because the cadence's load-bearing premise (risk isolation while
schema PRs were in flight) is gone, and the one-piece-at-a-time
landings would each ship in a state where the user-visible outcome is
worse than today (e.g. wiring without defaults = "blocks are reachable
but blank"). Bundling gives one shippable unit; splitting gives several
intermediate states each of which is its own visible regression.

The seed-swap deserves its own note: it is the _cheapest_ of the five
sub-decisions (one-line import + one config change) and addresses a
disproportionate share of the user-perception problem ("preview
doesn't update much"). Excluding it from the bundle on grounds of
"that's a different concern" would be technically clean but
behaviourally the wrong call.

## Consequences

- `@sosb/editor-app`'s `editor-app.tsx` gains an `activeBlockId` (or
  equivalent index) state, an inspector mode flag, and conditional
  rendering of `BlockForm` vs the un-drilled list view. The
  `BlockListEditor` row gains a click target wired to the drill-in
  state. Existing tests covering page-switching and block list
  add/remove/reorder continue to pass; new tests cover drill-in,
  drill-out, the patch path composition for block-data edits, and the
  back-affordance keyboard handling.
- `@sosb/editor-app`'s `block-defaults.ts` and `block-catalog.ts` grow
  by 14 entries each. Both tables stay flat key-value records keyed by
  block type id. Test coverage extends to per-type smoke tests:
  `defaultBlockFor("faq")` produces schema-valid output for `faq`,
  etc.
- `packages/browser-shell/scripts/run-archival-build.ts` imports
  `asociatiaStudenteascaDemoData` from `@sosb/themes` and uses it as
  the default `initialSitePath` (or its in-memory equivalent — the
  current path-based interface may need a parallel "data object"
  parameter). The archival build's bundle size grows by the demo
  payload; this is expected and bounded.
- The minimal-site test fixture stays exactly where it is and continues
  to drive the editor-app tests that want the degenerate case. Only
  the _production seed_ changes.
- ADR 0035's _Out of scope_ note about block-CRUD is now satisfied. A
  one-line cross-reference appended to 0035 points future readers
  here.
- ADR 0008's _Consequences_ note about per-block additive metadata
  PRs is implicitly closed; future blocks (#22 onwards if any land)
  still follow the additive pattern, but the current 14-block backfill
  is a one-shot.
- The "preview doesn't update much" perception complaint is
  partially addressed (visible content + reachable block-data editing
  - meaningful starter seed). The reload-flash component remains
    until the iframe re-architecture lands.

### Post-landing follow-up

Surfacing the curated demo (Q6) revealed a previously-latent renderer
bug: `themeCssFor` returned only the active theme's CSS instead of
composing stub-as-baseline + theme-as-overlay. Each production theme
ships ~120-190 lines of curated CSS covering 1-3 blocks (mostly hero);
stub ships ~860 lines covering all 15 block types. Without composition,
selecting any non-stub theme caused every block the theme didn't curate
to render with no theme CSS at all — visible as the demo's body
sections (richText, valueList, contactCard, etc.) appearing nearly
unstyled while the hero rendered correctly.

The original design intent was clearly composition — the
`activities-list-golden.test.ts` header even said so verbatim:
_"the renderer falls back to the stub theme... they will regenerate
against the Academic theme when #47 substitutes the CSS for `themeId
=== "academic"`"_. The implementation just never landed.

Fix: `themeCssFor` now returns `${STUB_THEME_CSS}\n${THEME_CSS}` for
every non-stub theme, with the theme's rules winning per the CSS
cascade. Stub also gained basic `[data-site-nav]` and
`[data-language-switcher]` styling (no theme covered nav at all). 34
golden snapshots regenerated; 1 editorial-theme regex test updated to
match the cascade-winning rule rather than the first occurrence.

## Alternatives considered

- **Inline expand-on-click rows.** See "Rejected" under the drill-in
  decision.
- **Modal dialog over the iframe.** Same.
- **Three-pane layout.** Same.
- **Vertical tabs.** Same.
- **Strict ADR 0008 per-block PR cadence.** See "Rejected" under the
  bundle-scope decision.
- **Defer the seed swap.** Considered briefly. Rejected because the
  swap is a one-line change that disproportionately addresses the
  user-perception problem and fits naturally inside the same diff.
- **Land the iframe re-architecture in this issue too.** Considered
  and rejected. ADR 0005 explicitly chose the srcdoc-static-iframe
  contract and would need amending to relax it; that work deserves
  its own ADR rather than being slipped into a wiring issue.
- **Land selection sync (preview scrolls to active block) without
  reworking the iframe.** Considered and rejected. The iframe reload
  on every keystroke resets scroll, so a one-shot scroll on
  drill-in would be undone by the very next character typed. Worse
  UX than no sync.

## Out of scope

- **Iframe-reload re-architecture.** The preview iframe currently
  reloads via `srcdoc` reassignment on every snapshot change. The
  alternative — keep `srcdoc` stable after first mount, post snapshot
  updates via the existing preview-bridge envelope, and have a small
  iframe-side script swap `<body>` innerHTML in place — is its own
  issue and will require an amendment to ADR 0005 (which committed to
  "iframe = static HTML, byte-identical to build pipeline output" for
  reasons that hold for _built sites_ but not for the _editor preview_
  iframe specifically). Selection sync (drill-in scrolls/highlights
  the active block in the preview) is paired with this work.
- **Designed default _content_ for non-hero blocks.** This issue ships
  functional placeholders. A follow-up content pass replaces them
  with designed copy (likely bilingual ro/en, matching the curated
  demo's tone). That is content work, not wiring work.
- **SpineForm restructuring.** The auto-generated form for the site
  spine has its own ergonomic issues (flat list of nested fieldsets,
  no grouping, no per-field guidance). The drill-in pattern relegates
  it behind "Site settings"; improving the form itself is separate
  work.
- **Theme picker UI (PRD §41-46).** Has its own in-flight design spec
  and commit series. The spine form's `theme.id` field stays a string
  input under this issue.
- **Per-block UX polish.** Some blocks may want bespoke UI affordances
  beyond what `BlockForm`'s generic generation produces (e.g. an icon
  picker for `valueList` items already exists per ADR 0035; future
  blocks may want similar). Bespoke affordances land in their own
  issues.
