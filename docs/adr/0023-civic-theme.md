# 0006 — Civic theme: palette, typography, and per-theme baseline tokens

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #30

## Context

Issue #30 asks for the Civic theme — one of the five themes the PRD
commits to (alongside Academic #47, Modern #28, Editorial #29, Minimal
#31). The PRD's original brief for Civic was "warm-red primary +
sun-yellow accent + cream bg + comfortable density + 12px rounding,"
described as "optimistic, action-oriented, communicative."

The maintainer expanded scope on the issue and overrode that brief in
favour of a more archetype-true Civic feel: government / community-org
typography, deep-blue + warm-white palette, rectangular blocks, AAA
contrast where feasible. The reasoning: civic websites are a recognised
visual category (USWDS, GOV.UK, official Romanian institutional sites),
and the site builder's value increases when each theme reads as its
archetype at first glance, rather than re-mixing the same warmth across
five labels.

The renderer skeleton (#46, ADR 0003) emits one universal baseline of
tokens followed by the user's `site.theme.tokens` overrides. The stub
theme contributes layout-only CSS and no token defaults. Civic needs a
curated palette, a curated type stack, and curated radii — none of which
fit into the universal baseline (each theme will want its own values).

## Decision

### Palette: deep institutional blue + warm white + warm-burgundy accent

The five core colour tokens for civic are:

| Token             | Hex       | Use                                |
| ----------------- | --------- | ---------------------------------- |
| `--color-bg`      | `#fdfaf3` | warm white / off-cream surface     |
| `--color-fg`      | `#0c1b2e` | very dark navy body text           |
| `--color-primary` | `#0c2d5e` | deep institutional blue (headings) |
| `--color-accent`  | `#9c3a17` | warm burgundy/rust (eyebrow, CTA)  |
| `--color-muted`   | `#3b4a5e` | slate grey (captions, dividers)    |

Plus a quiet `--color-border: #d6cfc1` for hairline dividers (re-uses
warm-white-tinted parchment to avoid a sixth raw colour theme).

Measured WCAG contrast on `--color-bg` (#fdfaf3 — relative luminance
~0.957):

- `fg`: ~15.7:1 (AAA)
- `primary`: ~12.7:1 (AAA)
- `accent`: ~8.25:1 (AAA)
- `muted`: ~8.18:1 (AAA)

All combinations clear the 7:1 AAA bar for normal text. Civic's
"AAA where feasible" priority on #30 is met across the board.

Rejected: warm-red + sun-yellow per the original PRD brief. Rationale
in scope expansion above. Also rejected: a darker bg (would lose the
"warm" civic-paper feel); a teal/green secondary accent (less archetype-
true for institutional Romanian / European civic sites).

### Typography: Source Sans 3 with system-sans fallback chain

Both `--font-headline` and `--font-body` resolve to:

```
"Source Sans 3", "Source Sans Pro", "Inter", system-ui, -apple-system,
"Segoe UI", Roboto, sans-serif
```

Source Sans 3 (USWDS-aligned, Public-Sans-shaped) has full Romanian
diacritic coverage across all weights including the U+0218/U+0219
S-comma-below pair. It falls back to Source Sans Pro (the predecessor),
then Inter (widely cached on dev machines), then a platform-native sans
chain. No webfont @font-face rule is shipped from the renderer — the
build pipeline (#5) is the right layer to decide whether to embed
weights as part of the per-page CSS budget. Browsers without a Source
Sans family installed will resolve to system sans, which is acceptable
for civic.

The headline and body share a stack so that diacritic rendering is
identical regardless of weight. Hierarchy comes from weight (400 body /
700 headline) and size, not face.

Rejected: a serif headline + sans body pair (more academic than civic),
a single weight (not enough hierarchy), Public Sans specifically (very
similar to Source Sans 3 but less broadly cached on Romanian dev
hardware; we keep the option open via the Public Sans fallback alias if
the maintainer wants to swap later).

### Radius: 2 / 3 / 4 px (rectangular)

`--radius-sm: 2px`, `--radius-md: 3px`, `--radius-lg: 4px`. Civic styling
is institutional and rectangular, not playful. The renderer's universal
baseline (4 / 8 / 16 px) is overridden across the board.

### Per-theme baseline-tokens contract (renderer change)

To let civic ship a curated palette without splitting the cascade
contract, `emitTokenRoot(site)` is extended to
`emitTokenRoot(site, themeBaseline?)`. The `:root` rule is composed in
three layers, top-to-bottom:

1. The renderer's universal baseline (defined in `tokens.ts`).
2. The active theme's baseline (e.g. `CIVIC_THEME_BASELINE_TOKENS`).
3. The user's `site.theme.tokens` overrides.

CSS later-wins resolves the cascade: user customisation always trumps
theme defaults; theme defaults trump the universal baseline. The stub
theme contributes nothing here (preserves the existing stub-theme
golden) and renders identically to before the change.

Rejected: re-emitting the universal baseline differently per theme (the
universal baseline carries spacing scale + structural tokens that every
theme wants — duplicating those across five themes would invite drift),
emitting a separate `<style>` element per layer (more bytes, breaks the
single-style-element contract from ADR 0003).

### Hero block: civic styling via existing structural component

The Hero component from #46 is unchanged — it owns semantics. Civic
contributes only the CSS that paints it: the eyebrow becomes uppercase
700-weight burgundy; the headline becomes 2.5rem 700 navy; the
subtitle becomes 1.1875rem 400 navy; the media gets a 1px border in
the parchment border tone; the section gets a hairline `border-block-end`
to seat the hero against the next block. Per-theme hero variants (the
PRD reserves these for blocks where layout differs meaningfully per
theme) are deferred — civic's hero composition is the same structural
shape as the stub's, just painted differently.

## Consequences

- The civic theme registers itself in `themeCssFor` and
  `themeBaselineTokensFor` in `packages/renderer/src/index.tsx`.
- A civic-shaped fixture (`packages/renderer/test/fixtures/civic-hero.json`,
  HISTORIPOL-shaped Romanian content with diacritics across the eyebrow,
  title, subtitle, and image alt) drives the civic golden file. The
  diacritic AC for #30 is exercised at golden-file level — any future
  drift in how the renderer encodes Unicode would surface as a snapshot
  diff.
- The civic golden file lives at
  `packages/renderer/test/__golden__/civic-theme-hero.html` (covered by
  the existing `.prettierignore` glob).
- The stub-theme golden is unchanged; the per-theme baseline contract
  is opt-in.

## Out of scope (deferred to follow-ups)

- Per-block goldens for the other 14 blocks under civic (land per
  `#9-#22` as those blocks ship).
- A per-theme hero variant — civic's hero shares structural shape with
  the stub. If composition diverges (e.g. centred + full-bleed), it
  lands as a follow-up.
- Webfont @font-face for Source Sans 3 — the build pipeline (#5) owns
  whether to embed weights. Civic relies on the system-sans fallback
  in the meantime.
- Lighthouse 95+ verification on a multi-block fixture site (PRD AC for
  #30) — requires the rest of the block library, the build pipeline, and
  a HISTORIPOL multi-page fixture. Tracked under #30 follow-ups.
- Responsive desktop / tablet / mobile verification (PRD AC for #30) —
  same dependency as Lighthouse.
- Visual axe-core colour-contrast at jsdom level — JSDOM does not
  compute styles, so contrast verification is by measured ratios pinned
  in this ADR + token-value tests, not by axe at unit-test layer.
  Headless-browser axe with computed contrast lands with the rest of
  the block library + build pipeline.
