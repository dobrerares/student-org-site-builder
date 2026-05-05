# 0006 — Academic theme: first-pass curated draft

- **Status:** Accepted (AI-scaffolded draft; maintainer curation expected)
- **Date:** 2026-05-05
- **Issue:** #47

## Context

Issue #47 is the visual half of the renderer (split from the original #4; the
infrastructure half is #46, captured in ADR 0003). It ships the **Academic**
theme — the project's brand-bearing skin and the default demonstrated for
HISTORIPOL, the Romanian student history society that is the canonical
reference org per the PRD.

#47 was triaged `ready-for-human` because theme work is qualitative:
"institutional, restrained, traditional but not dated" cannot be checked
mechanically. A maintainer-led curation pass is required before the theme
ships.

The maintainer expanded the AFK scope to include a **strong, conservative
first-pass draft** that does not try to be unique or clever — it hits the
academic archetype well and leaves explicit knobs for the curation pass.
This ADR records the choices made in that draft so the maintainer (and
future contributors) know which decisions were deliberate and which are
reversible without churning the renderer.

The PRD pins:

- Five themes ship in v1 (`academic`, `modern`, `editorial`, `civic`,
  `minimal`) with `academic` as one of the three minimum-viable themes if
  quality slips.
- Themes own page-level composition; per-block layout variation is reserved
  for the hero. Most blocks rely on token-customised shared templates.
- Tokens-as-CSS-custom-properties, no client-side runtime, no `@font-face`
  dependencies on the built site (per-page budgets stay tight).
- Romanian diacritics (ă, î, â, ș, ț) must render without typographic
  regression — verified by eye, not just font-loaded checks.

The PRD does **not** pin:

- The exact palette (only the broad register: traditional academic).
- The type pairing (only "designed via a disciplined AI-assist process").
- The line-height, type scale ratio, or measure.
- Whether ornament is permitted (drop-caps, marginalia, etc.).

This ADR records the choices that filled those gaps for the first-pass draft.

## Decision

### Palette: Oxford-Navy + Antique-Parchment (5 named tokens)

| Token             | Hex       | Name              | Role                                                           |
| ----------------- | --------- | ----------------- | -------------------------------------------------------------- |
| `--color-primary` | `#1a2440` | Oxford Navy       | Headings, links, the institutional voice                       |
| `--color-bg`      | `#f7f1e3` | Antique Parchment | Page background; warm cream                                    |
| `--color-fg`      | `#2a2418` | Iron Gall         | Body copy; ink-dark brown, easier than pure black on parchment |
| `--color-accent`  | `#a67c2e` | Library Gold      | Eyebrow text, hairline rules, dates                            |
| `--color-muted`   | `#6b5f4a` | Faded Marginalia  | Captions, meta text                                            |

The contract permitted dark navy **or** deep burgundy with cream + muted gold
or brick. Navy + gold reads more universally "academic" than burgundy + brick
(which leans Editorial / heritage-press) and is the safer first pass for
HISTORIPOL specifically — Universitatea „Ovidius" Constanța uses a navy +
gold visual identity in many of its own materials. Burgundy can be the
maintainer's curation pivot if HISTORIPOL prefers it.

### Typography: serif throughout, system fonts only

- `--font-headline` = `"Iowan Old Style", "Charter", "Charis SIL", Georgia, "Palatino Linotype", Palatino, serif`
- `--font-body` = same stack.

Serif throughout is the unifying choice from the contract. The stack uses
system serifs that ship with macOS (Iowan Old Style, Charter), Windows
(Georgia, Palatino Linotype), and Linux (Charis SIL is a SIL freely
licensed serif many distros include; Georgia is widely installed via
ms-corefonts). No `@font-face` declarations means **zero font-loading
cost** on the built site, which keeps the per-page budget intact and
removes one degree of freedom from the diacritics test (the system fonts
all carry the Romanian set).

Body and headlines deliberately share the family. Traditional academic
prints almost always do; the contrast comes from the type scale (size +
line-height + tracking), not from a sans/serif pairing.

### Type scale: modular, ratio 1.25 (major third)

Tokens emitted: `--type-scale-base` (1rem) up through `--type-scale-3xl`
(2.441rem ≈ 1.25⁴) for the display headline, plus `--type-scale-sm` for the
eyebrow. Conservative ratio; the contract permitted 1.25 explicitly.

### Reading rhythm: line-height 1.65 body, 1.15 display; measure 70ch

`--leading-body: 1.65` clears the contract's "1.6+" floor. Display headings
get `--leading-display: 1.15` for a tighter set. Paragraph max-width is
capped at `--measure-body: 70ch`, the wider end of the academic measure
range — the contract said "wider measure (~70ch)" verbatim.

### Ornament: minimal

A single `1px solid var(--color-accent)` rule under the hero satisfies the
"modest borders, simple horizontal rules" guidance. The eyebrow gets italic
small-caps via `text-transform: uppercase` + `letter-spacing: 0.06em`.

We deliberately did **not** ship a `::first-letter` drop-cap. The contract
permitted it ("unless they fight other content"); they fight Romanian
diacritics on common opening words (e.g., "Începutul"). A maintainer can
add one to the `richText` block when that block lands (#11) if curation
wants more flourish.

### Per-theme baseline tokens

The renderer's `emitTokenRoot` was extended to compose three layers in
order: generic baseline → per-theme baseline → user `site.theme.tokens`.
The Academic theme contributes 14 tokens at the per-theme layer. Later wins
in CSS, so the layering does what we want without filtering at emission
time. The cost is a few duplicated lines in `:root`; the alternative —
filtering at emit time — would couple the generic baseline list to each
theme's contribution at the wrong layer.

### Hero composition

Inherits the structural component from #46 unchanged. The Academic theme
adds visual treatment via `[data-block="hero"]` rules: the gold rule
underneath, a constrained `.hero__inner` measure (70ch), italic small-cap
eyebrow in gold, oversized display headline in navy, body-sized subtitle.
No per-theme JSX variant — the structural hero is rich enough.

## Rationale

This is a draft. The aim was "credible academic starting point the
maintainer can curate," not "final shipped theme." The decisions above lean
conservative on every reversible knob:

- **Palette** — the safe academic register, not a risky burgundy or red-ink
  pivot. Easy for the maintainer to swap by editing the five hex values in
  `ACADEMIC_THEME_TOKENS`.
- **Type stack** — system fonts only, leading with Iowan Old Style/Charter,
  Georgia in the middle, no `@font-face`. Easy for the maintainer to add a
  curated webfont if the diacritics review reveals a regression.
- **Ratio + line-height** — 1.25 modular and 1.65 body. Easy for the
  maintainer to bump to 1.333 (perfect fourth) for more headline drama or
  drop body to 1.55 if the parchment + serif feels too airy in the
  multi-block fixture.
- **Ornament** — one rule, no drop-cap. Easy for the maintainer to add a
  marginalia/dingbat treatment in the richText block.

The maintainer is expected to:

- Eyeball the multi-block fixture once #9–#22 land and sign off (or pivot)
  on the palette + type pairing.
- Run the diacritic test by eye across h1–h6 + body + button.
- Verify Lighthouse 95+ on a multi-block fixture page when the rest of the
  blocks ship.
- Run the responsive verification at 320 / 768 / 1024 / 1440. (Today's
  hero-only fixture is responsive by virtue of the constrained measure +
  intrinsic image sizing.)
- Add curated golden-file snapshots for each canonical fixture page once
  the blocks land. The hero golden in this issue seeds the framework; the
  per-block × per-theme matrix is deferred per the contract.

## Consequences

- New file `packages/renderer/src/themes/academic.ts` exports
  `ACADEMIC_THEME_ID`, `ACADEMIC_THEME_TOKENS`, and `ACADEMIC_THEME_CSS`,
  mirroring the structural shape of `themes/stub.ts`.
- `emitTokenRoot(site)` now takes an optional `themeId` (defaulting to
  `site.theme.id`) and inserts per-theme baseline tokens between the
  generic baseline and user overrides. All existing callers (the renderer
  itself) continue to work with no migration.
- The renderer's theme-id dispatcher (`themeCssFor`) now branches on
  `ACADEMIC_THEME_ID` first, then `STUB_THEME_ID`, then falls through to
  the stub for unknown ids (preserving the #46 forward-compat).
- A new `packages/renderer/test/__golden__/academic-theme-hero.html` snapshot
  is committed; the directory is already in `.prettierignore`.
- Two new test files exercise the academic theme:
  `academic-theme.test.ts` (token + structural assertions) and
  `academic-accessibility.test.ts` (axe-clean on the hero-only fixture).
  The existing per-theme golden file test grows by one assertion.

## Alternatives considered

- **Burgundy + brick palette.** Equally archetypal. Rejected for the
  first-pass because navy + gold is the safer pivot for HISTORIPOL
  specifically; burgundy is the maintainer's primary alternative.
- **Sans body + serif headlines.** A modern academic look (Modern theme
  territory). The contract specified serif throughout for Academic; we
  leaned in.
- **Webfont (e.g., Source Serif Pro, Lora).** Better diacritic support and
  a more curated feel, at the cost of a font-load on the built site,
  per-page budget impact, and potential FOIT/FOUT on slow connections.
  The PRD's per-page CSS budget (≤15 kb gzipped) leaves no room for a
  500–700 kb font payload. Maintainer can add a self-hosted subset later
  if the curation pass demands it.
- **Drop-cap on `::first-letter`.** Rejected for diacritic conflicts on
  common Romanian opening words. Easy to add to the richText block when
  it lands.
- **Per-theme hero JSX variant.** The PRD's Themes section permits this
  for blocks where layout meaningfully varies per theme. The structural
  hero in #46 is sufficient for the first-pass academic look; CSS-only
  styling hits the archetype without forking the JSX. Maintainer can
  introduce a `theme/academic/hero.tsx` variant if the curated composition
  needs structural changes (e.g., headline-and-image side-by-side).

## Areas flagged for human curation

These are explicitly **not** decided in this draft:

1. **Palette pivot to burgundy + brick** — five hex values to change.
2. **Webfont introduction** — only after a diacritic review identifies a
   regression in the system fallback chain.
3. **Type-scale ratio** — currently 1.25; perfect-fourth (1.333) gives
   more drama.
4. **Body line-height** — 1.65 is conservative; 1.55 trades airiness for
   density.
5. **Ornament budget** — drop-cap, marginalia, gold dingbats, header rule
   weight. Currently a single 1px gold rule under the hero.
6. **Hero composition** — currently a centred, narrow-measure stack.
   Asymmetric / image-side-by-side variants would need a per-theme JSX
   variant.
7. **Per-block × per-theme golden files** — only the hero golden ships
   today; the matrix populates as #9–#22 land.

## Out of scope

- Other themes (Modern / Editorial / Civic / Minimal) — those are #28-#31.
- Per-block × per-theme golden files for blocks beyond hero — populated as
  #9-#22 land.
- Multi-block fixture for Lighthouse / responsive verification — depends
  on #9-#22 landing first.
- Webfont infrastructure (`@font-face`, subsetting, preload tags) — out of
  scope for v1 unless the maintainer's curation pass demands it.
- Per-theme dark / light mode toggle — explicitly excluded by the PRD
  (auto-derived from `bg`/`fg` tokens if needed).
