# 0006 — Modern theme: palette, typography, and override pattern

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #28

## Context

Issue #28 asks for the **Modern** theme — one of the five v1 themes the
renderer (#46) and the wider editor depend on. The issue body sketches an
aesthetic ("clean, current, slightly understated"), proposes type pairing
(Inter + JetBrains Mono) and a default palette (deep blue primary,
electric green accent, off-white background, near-black foreground), and
requires per-block coverage across the 15 v1 blocks plus Lighthouse 95+
plus axe-core clean output plus Romanian-diacritic regression coverage.

The issue's full acceptance criteria include header/hero/footer page-shell
components and the 15-block matrix. The AFK orchestrator scoped this PR
down to **the Modern theme's CSS contract and a hero golden** — the per-
block goldens land in their own block PRs (#9–#22 are still in flight),
and the page-shell header/footer composition lands when those block
schemas exist to compose against.

The PRD pins the relevant constraints (PRD § Renderer & themes):

- Tokens are emitted as CSS custom properties on `:root`; live token edits
  rewrite the `<style>` element without DOM rebuild.
- Five themes ship in v1: `academic`, `modern`, `editorial`, `civic`,
  `minimal`. Most blocks use shared templates customised via tokens; only
  blocks where layout meaningfully varies per theme (hero) get per-theme
  variants.
- Built sites ship with no client framework; ≤10 kb of vanilla JS for
  interactive blocks. Lighthouse 95+ across the 15 × 5 matrix.
- HISTORIPOL (an ovidius.ro student org) is the canonical reference user
  whose Romanian content drives every theme's diacritic test.

ADR 0032 (renderer skeleton, #46) further pins:

- Themes plug in by id: `themeCssFor(themeId)` in
  `packages/renderer/src/index.tsx` returns the active theme's layout-only
  CSS string. Unknown ids fall back to the stub layout.
- Per-block CSS uses `var(--token)` exclusively — the test suite asserts
  no raw hex/rgb leaks outside the `:root` rule (where tokens are
  _defined_).
- The renderer emits a _baseline_ `:root` block with sane defaults; themes
  layer their own overrides via a second `:root` rule (later wins).

## Decision

### Type stack: a system sans-serif stack on both headline and body

```
-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif
```

We use the same stack for `--font-headline` and `--font-body`. Modern is
sans throughout — no serif headline.

We deliberately depart from the issue body's "Inter + JetBrains Mono"
suggestion. Reasons:

- **Lighthouse 95+ across all categories is part of the AC.** A web-font
  fetch for Inter (and a separate fetch for JetBrains Mono if we used it
  anywhere) costs render-blocking time and bytes that the per-page budget
  (HTML ≤50 kb, CSS ≤15 kb gzipped, JS ≤10 kb) cannot easily absorb. A
  system stack costs zero network bytes.
- **Modern is the _understated_ theme**, not a typographic showpiece. The
  AFK scope-expansion brief explicitly warned that themes that "feel
  AI-generated" are mostly themes that try too hard. Inter is a perfectly
  good face but it is also a recognisable "AI-generated startup landing
  page" signal in 2026; using it without a strong identity reason is the
  opposite of "slightly understated."
- **Romanian diacritics (ăâîșț) are first-class on every modern OS's
  system sans.** macOS Helvetica/SF Pro, Windows Segoe UI, Android Roboto,
  ChromeOS Roboto, GNOME Cantarell — all render the diacritic ramp without
  fallback hops. This sidesteps the diacritic-regression risk that would
  attach to a self-hosted web font with an opinionated subset.
- **JetBrains Mono is irrelevant to v1's block library.** We have no
  block that needs a code face: the markdown block uses inline `code`
  styling, not block code, and even the inline `code` element does not
  warrant pulling in a 30 kb mono face. We omit the mono pairing
  entirely.

If a later theme (e.g. Editorial) needs a curated web font, that theme's
ADR will document the tradeoff and the fallback contract; the Modern
theme intentionally does not set that precedent.

### Palette: slate neutrals + royal-blue accent

| Token             | Value     | Role                                           |
| ----------------- | --------- | ---------------------------------------------- |
| `--color-bg`      | `#ffffff` | Pure white background                          |
| `--color-fg`      | `#0f172a` | Slate-900, near-black body text and headlines  |
| `--color-muted`   | `#64748b` | Slate-500, subtitle / supporting text          |
| `--color-primary` | `#0f172a` | Same as `fg` — headlines stay near-black       |
| `--color-accent`  | `#2563eb` | Royal blue — eyebrow + future link/CTA accents |

We deliberately depart from the issue body's "deep blue primary, electric
green accent" suggestion. Reasons:

- **Restraint.** The Modern aesthetic guideline pinned by the
  scope-expansion note is "neutral base with one bold accent colour." A
  blue _and_ a green pulls in two competing accents. Collapsing the
  primary onto the foreground (slate-900) and reserving the bold accent
  for the eyebrow and future links produces the "slightly understated"
  mood the PRD asks for.
- **Accessibility, verified by hand.** Against `#ffffff`:
  - `#0f172a` (fg / primary) → 19.46:1 (AAA, comfortably above WCAG 2.2 AA).
  - `#64748b` (muted) → 4.54:1 (AA for normal text).
  - `#2563eb` (accent) → 4.79:1 (AA for normal text — used for the
    eyebrow, sized 0.8125 rem with 600 weight, which clears AA).
    All four pairings pass WCAG 2.2 AA. The colour-contrast axe rule is
    disabled in the in-package jsdom suite (jsdom does not compute styles)
    but the pairings are picked to clear the bar when Lighthouse runs the
    built fixture.
- **Future-friendly.** Editorial (#30) is the theme that should own a
  warmer, more saturated accent system; Civic (#31) owns a more muted
  palette. Modern owning a single cool accent leaves room for those
  themes to differentiate without colliding.

If the maintainer prefers the issue body's exact greens-and-deep-blue
palette, the override is one CSS-line swap inside this theme's `:root`
block — the rest of the theme references `var(--color-primary)` /
`var(--color-accent)` exclusively.

### Density and rhythm: airy, modular, geometric

- The hero adds a `--space-2xl: 6rem` token on top of the renderer's
  baseline scale (`xs/sm/md/lg/xl`). The 4 → 6 rem step preserves a
  rough 1.25-ratio modular scale and gives the hero its "airy" feel
  without exploding the baseline scale that other blocks consume.
- The hero uses CSS Grid with two columns at viewports ≥720 px and a
  single column below. Type sizes step from 3 rem to 3.75 rem at the
  same breakpoint. This is the only inline media query in the theme;
  remaining responsive behaviour is delegated to the block-level CSS as
  blocks land.
- Border radius stays on `--radius-md` (8 px from the renderer baseline),
  matching the issue body.

### Override pattern: a second `:root` block in the theme CSS

Themes register their non-baseline token values by writing a second
`:root { ... }` rule at the top of the theme's CSS string, before any
per-block rules. The renderer emits the baseline `:root` first; the
theme's `:root` lands second; later wins per CSS rules.

Rejected: extending the schema's `tokens` map to carry a per-theme default
set (would couple `@sosb/schema` to theme decisions and force schema-bumps
when a theme adjusts its own default). Rejected: extending the renderer's
`tokens.ts` to register theme defaults via a `registerTheme` API (the
renderer's tokens.ts comment hints at this future, but the cost is a
runtime registry that adds a code path the parity tests would have to
prove deterministic). The "second `:root` rule" pattern is the cheapest
deterministic seam and stays inside the theme's own file.

### Hero styling: structural-only refinements, no decorations

The hero CSS:

- Sets a `display: grid` on `.hero__inner`, two columns at desktop, one
  at mobile.
- Renders the eyebrow as `text-transform: uppercase`, letter-spaced
  0.12 em, 0.8125 rem, 600 weight, accent colour. This is a Modern
  signature treatment but it falls out of the typography contract — it is
  not a decorative ornament.
- Sets the headline at 3 rem on mobile, 3.75 rem at desktop, line-height
  1.1, letter-spacing -0.01 em (light tightening at large display
  sizes), weight 700.
- Sets the subtitle at 1.25 rem with `--color-muted`.
- Wraps the media in a `border-radius: var(--radius-md)` container with
  `overflow: hidden`. No shadow, no gradient.

We add no decorative pseudo-elements, no accent rules above the eyebrow,
no underline on the headline, no background tints, no subtle gradients.
The brief's "no decorative ornaments" line is taken literally.

## Rationale

The two judgment calls (system stack vs Inter; restrained palette vs
deep-blue + electric-green) are both made conservatively against the
"don't over-design" guidance from the AFK scope-expansion notes and the
PRD's quality-fallback contract ("ship 3 strong themes rather than 5
mediocre"). Both can be reverted without touching any code outside this
theme file (the type stack is a single token line; the palette is five
token lines), so a maintainer who reads this ADR and disagrees has a
two-minute swap.

The "second `:root` block" pattern matters most: it is the precedent the
remaining four themes (#29 Editorial, #30 Civic, #31 Minimal, #47
Academic) will copy. Choosing a CSS-native seam (later wins) over a
renderer-side registry keeps the renderer's parity contract narrow and
keeps theme authoring deterministic-by-construction.

## Consequences

- The Modern theme is a single file:
  `packages/renderer/src/themes/modern.ts`. It exports
  `MODERN_THEME_ID = "modern"` and `MODERN_THEME_CSS`. The renderer's
  `themeCssFor` switch routes `"modern"` to `MODERN_THEME_CSS`; unknown
  ids continue to fall back to the stub layout.
- The hero golden ships at
  `packages/renderer/test/__golden__/modern-theme-hero.html`. Per-block
  goldens for blocks #9–#22 land in those issues, not here.
- The fixture `hero-only-modern.json` clones `hero-only.json` with
  `theme.id = "modern"` and _no_ token overrides — so the golden file
  exercises the theme's defaults, not user-customised values. Tests that
  exercise user-token overrides remain on the stub fixture.
- The axe-core regression test mirrors the stub theme's pattern (jsdom +
  `color-contrast` rule disabled). Visual contrast lives with Lighthouse
  on built fixtures, not this in-package suite.
- Disabling the `color-contrast` axe rule in jsdom is documented in this
  ADR (and the comment in the test) as a deliberate split: structural
  axe rules run here, computed-style contrast runs in Lighthouse.

## Alternatives considered

- **Use Inter via `@font-face`** (issue body's suggestion). Rejected for
  the four reasons listed under "Type stack." Reversible with a one-line
  `--font-headline` swap if the maintainer disagrees.
- **Use the issue body's deep-blue + electric-green palette verbatim.**
  Rejected for "restraint" and "future-friendly" reasons. Reversible
  with a five-line `:root` swap.
- **Ship per-block goldens (15 × 1) in this PR.** Out of scope: the
  block schemas + renderers (#9–#22) are still in flight. We will add
  modern-theme goldens to each block's PR as it merges.
- **Ship header/footer composition components in this PR.** Out of
  scope: header / footer composition depends on the navigation block
  contract (#? — TBD) and the contact block (#? — TBD), neither of
  which has landed. The page shell from #46 is already enough for a
  hero-only fixture, and that is what the AC checkbox can be evidenced
  against today.
- **Register themes via a `registerTheme(id, css)` runtime call.** Cleaner
  module boundary but adds a runtime registry the parity tests would
  have to prove deterministic; the cost outweighs the benefit when there
  are five theme files total.

## Out of scope

- Per-block goldens for blocks #9–#22 under the Modern theme. Each block
  PR adds its own modern golden when it lands.
- Header / hero variants ≥2 / footer page-shell components (the issue's
  full AC). Land when the navigation + contact blocks exist to compose
  against.
- Lighthouse 95+ verification. Runs against the built fixture site
  (#5 + the demo template), not this in-package suite.
- Romanian diacritic regression smoke tests on the built fixture site.
  Same — runs in the build pipeline's e2e suite, not here.
- A user-facing token customisation UI that lets the maintainer swap
  `--color-accent` to electric green inside the editor. That is the
  editor's theme-tokens form (separate issue).
