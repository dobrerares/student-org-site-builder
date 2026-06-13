# Theme identity refresh — design

**Status:** Design — pending implementation plan
**Owner:** rdobre
**Date:** 2026-06-14
**Supersedes:** `2026-05-28-themes-pizzaz-design.md` (the "pizzaz / signature move"
direction is dropped — see "Relationship to the pizzaz spec" below).

## What & why

The five user-facing themes (`academic`, `civic`, `editorial`, `minimal`,
`modern`) work but read as variants of one bland baseline. The maintainer wants
each theme to have a **distinct identity** while keeping the **student-org
feel**, and — equally important — wants the themes to be **clean**, **adapt to
the viewport nicely**, **align naturally**, and make it **impossible to make a
bad website with them**.

Crucially, this is **not** the per-theme ornament work the prior spec proposed.
No dropcaps, gradient-text headlines, glass cards, anchor stripes, or hanging
quotation marks. Identity comes from **disciplined fundamentals only** —
palette, type pairing, spacing density, and corner shape — which is exactly how
real student-org sites (OSUBB, OSUT, ANOSR — see "Reference research") achieve
distinct identities without a single gimmick. Ornament fakes personality; a
coherent token system earns it, and it is far more foolproof.

So the project is: **one excellent, bulletproof rendering engine** (the
"impossible to make a bad site" layer) + **five tasteful identity presets** that
differ by feel, not decoration.

## Relationship to the pizzaz spec

The 2026-05-28 pizzaz spec is **superseded**. What carries over, what is dropped:

| From the old spec | Status here |
| --- | --- |
| Per-theme "signature move" ornaments (dropcaps, gradient text, glass cards, anchor stripes, three-dot dividers, hanging quote marks) | **Dropped** — "no pizzaz" |
| Per-theme block-level signatures for rich-text / quote / cta-banner | **Dropped** |
| Full-bleed hero with text-over-image + scrim | **Kept** — table-stakes layout, every reference site uses it; also a foolproofing win (guaranteed-legible scrim) |
| `--color-*-rgb` token siblings (for scrims, keep "no raw color outside `:root`" strict) | **Kept** |
| Remove `eyebrow` from `HeroDataSchema` | **Kept** |
| Per-theme palette / catalog metadata refresh | **Kept**, but values change to the re-cast identities |

New in this spec (the parts the user emphasized that the pizzaz spec was silent
on): fluid/responsive typography, owned vertical rhythm, natural alignment via
measure caps, content-overflow and image-aspect guards, wiring the dead
density/radius controls, contrast-safe color overrides, and graceful empty
states.

## Locked decisions

From the brainstorming session on 2026-06-14:

| Decision | Choice |
| --- | --- |
| Direction | No ornament. Identity via palette + type pairing + density + corner shape only. |
| Theme set | Re-cast the existing five slots around real student-org **moods** (see below). Slot IDs stay stable. |
| Foolproof depth | **Engine + content guardrails** — renderer *and* schema/editor. |
| Architecture | One shared engine; each theme reduced to a uniform identity token table. |
| Hero | Keep the full-bleed text-over-image + scrim pattern, universally. |
| Dead controls | **Wire** density/radius (don't remove) — they become real identity levers and safe user knobs. |

### The five re-cast identities

Slot IDs stay stable so `KNOWN_THEME_IDS`, the e2e a11y matrix, the wizard, and
the per-theme golden tests keep working — only the *contents* of each theme file
and its catalog metadata change.

| Theme (slot) | Org mood | `--color-primary` | `--color-accent` | `--color-bg` | `--color-fg` | `--color-muted` | Headline / Body | density | radius (base) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Activist** (`civic`) | Advocacy, campaigns, student-rights. Bold, direct. | `#17181C` | `#CB2B2B` | `#FFFFFF` | `#17181C` | `#6B6B6B` | Archivo 800 / Inter | compact | 2px |
| **Tech** (`modern`) | Hackathons, engineering, tech & startup clubs. Crisp, bright. | `#0F172A` | `#2563EB` | `#FFFFFF` | `#0F172A` | `#64748B` | Space Grotesk 700 / Inter | normal | 12px |
| **Editorial** (`editorial`) | Publications, cultural & debate societies. Type-forward, warm. | `#1A1714` | `#C4622D` | `#FBF8F3` | `#1A1714` | `#8A7E72` | Fraunces 600 / Inter | comfortable | 6px |
| **Calm** (`minimal`) | Content-first orgs; photos & writing do the work. | `#1A1A1A` | `#1A1A1A` | `#FFFFFF` | `#1A1A1A` | `#767676` | Inter 600 / Inter | airy | 0px |
| **Scholarly** (`academic`) | Research societies, honors programs, faculty bodies. Credible, warm. | `#1E3A5F` | `#B8893E` | `#F7F3EA` | `#1F2933` | `#5C6B7A` | Source Serif 4 700 / Inter | comfortable | 4px |

Font stacks (web-safe fallbacks; web fonts loaded as the renderer already loads
theme fonts):

- Archivo → `"Archivo", "Inter", system-ui, sans-serif`
- Space Grotesk → `"Space Grotesk", "Inter", system-ui, sans-serif`
- Fraunces → `"Fraunces", "Source Serif 4", Georgia, serif`
- Inter → `"Inter", system-ui, -apple-system, sans-serif`
- Source Serif 4 → `"Source Serif 4", "Lora", Georgia, serif`

## Architecture — one engine, five presets

No new layers. The existing composition stays:
`STUB_THEME_CSS` (universal layout baseline) + `PRODUCTION_SITE_BASE_CSS`
([production-base.ts](../../packages/renderer/src/themes/production-base.ts),
shared polish) + `<theme>_THEME_CSS` (per-theme overlay), with `:root` composed
by `emitTokenRoot` in
[tokens.ts](../../packages/renderer/src/tokens.ts) as
baseline → theme defaults → theme baseline → user overrides (later wins).

The change is **where work lives**:

1. **Promote every universal mechanic into the shared layers** (`tokens.ts` +
   `production-base.ts`). The engine emits complete, safe defaults.
2. **Reduce each theme file to a uniform identity token table** — palette +
   fonts + density + radius, nothing more. This also fixes a real
   inconsistency: today editorial wires tokens as a schema-keyed `Record`,
   civic/academic use raw `[cssProp, value]` tuple arrays, minimal/modern use
   neither — three shapes hand-wired in three functions in `index.tsx`. Collapse
   to **one shape**.
3. A **thin, optional** per-theme CSS slot remains as an escape hatch, but none
   of the five uses it initially.

**Why this is foolproof by construction:** because each theme only overrides the
four identity tokens and never overrides the safety rules, a theme *physically
cannot* opt out of fluid type, owned rhythm, overflow guards, measure caps, or
the legible scrim. Safety is a property of the engine, not of per-theme
discipline.

*Alternatives considered:* (B) keep per-theme CSS, factor shared rules into a
helper string — rejected, themes drift out of sync; (C) pure token-only themes
with zero per-theme CSS — adopted in spirit, but with the optional escape-hatch
slot retained.

## The bulletproof engine

Lives in `tokens.ts` (token definitions) and `production-base.ts` (rules).
Inherited by all five themes.

### Fluid typography (kills the no-`clamp()` gap)

A `clamp()`-based modular scale replaces all fixed-rem type. Starting values
(tunable in implementation):

```
--type-xs:   clamp(0.78rem, 0.75rem + 0.15vw, 0.85rem);
--type-sm:   clamp(0.88rem, 0.84rem + 0.20vw, 1.00rem);
--type-base: clamp(1.00rem, 0.96rem + 0.30vw, 1.125rem);
--type-lg:   clamp(1.20rem, 1.10rem + 0.50vw, 1.50rem);
--type-xl:   clamp(1.50rem, 1.30rem + 1.00vw, 2.05rem);
--type-2xl:  clamp(1.85rem, 1.45rem + 1.90vw, 2.75rem);
--type-3xl:  clamp(2.25rem, 1.60rem + 3.10vw, 3.75rem);  /* hero title */
```

The hero `h1` uses `--type-3xl` — it never overflows on a 360px phone and never
dwarfs a desktop. This kills the editorial `3.157rem`-with-no-breakpoint bug
directly. Per-theme headline scale can shift one step without leaving the scale.

### Owned vertical rhythm (kills the "accidental sum of paddings" gap)

A single fluid `--section-gap` owns the space *between* blocks, applied by the
page shell, instead of each block's padding accidentally summing:

```
--section-gap: calc(clamp(2.5rem, 1.5rem + 4vw, 5rem) * var(--density-scale));
```

Per-block padding is reduced to internal padding only; inter-block rhythm is one
consistent token across every theme.

### Coordinated breakpoints

Collapse the current uncoordinated `600 / 640 / 720 / 860px` magic numbers to
one coordinated set — `40rem` (mobile→comfortable) and `64rem` (→wide) — and
lean on intrinsic responsiveness (`repeat(auto-fit, minmax(…, 1fr))` grids +
`clamp()` type/space) so as few media queries as possible are needed. Document
the two breakpoints as named comments in `production-base.ts`.

### Natural alignment via measure caps (kills "title runs full 72rem")

```
--measure-body:  66ch;   /* readable prose column */
--measure-title: 20ch;   /* hero + section titles */
```

Hero and section titles are capped to `--measure-title`; prose to
`--measure-body`. Content aligns to a comfortable column instead of running the
full container width.

### Overflow & image guards (foolproofing)

- `overflow-wrap: anywhere; hyphens: auto;` on titles and long-text containers —
  a long Romanian word can no longer cause horizontal scroll.
- Hero background and content images: `aspect-ratio` + `object-fit: cover` so a
  tiny, huge, or wrong-ratio upload renders cleanly. (Generalizes the existing
  teamGrid 4/3 pattern.)
- `max-width: 100%` on all media (already partly present; make universal).

### Guaranteed-legible hero scrim

Add RGB token siblings so the scrim can use theme colors at partial alpha while
keeping the "no raw color outside `:root`" test strict:

```
--color-fg-rgb:      23, 24, 28;
--color-bg-rgb:      255, 255, 255;
--color-primary-rgb: 31, 58, 95;
--color-accent-rgb:  203, 43, 43;
```

The universal hero composites a bottom-anchored scrim
(`linear-gradient(rgb(var(--color-fg-rgb) / 0) → rgb(var(--color-fg-rgb) / 0.7))`)
under the lockup, so white text is always legible over any photo. Themes vary
only scrim direction/strength via tokens, not bespoke CSS.

### Wire the dead density & radius controls

The renderer maps named control values to numeric tokens when emitting `:root`
(named string → number happens in TS, not CSS):

- **density**: `--density-scale` multiplier applied to the `--space-*` scale and
  `--section-gap`. User-override named values map
  `compact → 0.85`, `normal → 1.0`, `comfortable → 1.15`. Themes may set a
  precise `--density-scale` directly for finer identity (e.g. Calm "airy" =
  `1.25`).
  ```
  --space-md: calc(1rem * var(--density-scale));   /* and siblings */
  ```
- **radius**: theme sets a precise `--radius-base` (Activist 2 / Tech 12 /
  Editorial 6 / Calm 0 / Scholarly 4 px); `--radius-sm/md/lg` derive from it.
  User-override named values map `sharp → 0`, `soft → 6px`, `round → 14px`
  onto `--radius-base`.

Both controls were inert before (emitted but consumed by nothing). Now they are
real identity levers *and* safe user knobs.

### Contrast-safe color overrides

When emitting tokens, the renderer computes the WCAG relative luminance of
`--color-accent` and `--color-primary` and emits a readable on-color:

```
on(color) = relativeLuminance(color) > 0.42 ? <theme dark ink> : "#ffffff"
```

emitting `--color-on-accent` and `--color-on-primary`. Buttons/badges use these,
so a bad color pick — by a theme default *or* a user override — can never
produce unreadable text. (Scholarly's gold `#B8893E` resolves to dark on-color;
the same path protects a user who picks pale yellow.)

## Content guardrails (schema + editor)

- **Graceful empty states** — optional blocks/fields that are empty render
  *nothing* in production instead of an empty container. Per-block rule (empty
  `richText` → suppressed; hero with no subtitle → fine; cta-banner with no text
  → suppressed). The editor preview shows a subtle "empty" placeholder so the
  author knows the block exists.
- **Length guidance** — soft recommended maxes as editor helper text (hero title
  ~60 chars, subtitle ~140) attached via
  [field-metadata.ts](../../packages/editor-app/src/field-metadata.ts). *Not*
  hard validation — the engine's measure caps + wrapping keep over-length
  content clean regardless. Guidance, not a gate.
- **Derived on-color preview** — the editor color picker shows the auto-derived
  readable text color so the author sees the safe result of their pick.

## Schema cleanup — remove `eyebrow`

Carried from the prior spec. `z.looseObject` preserves unknown keys, so existing
snapshots with `eyebrow:` round-trip without loss; the field simply has no
validator, no UI, no render branch.

Touchpoints:

- `packages/schema/src/blocks/hero.ts` — drop the field.
- `packages/schema/test/hero-block.test.ts` — drop eyebrow assertions.
- `packages/renderer/src/blocks/hero.tsx` — drop the eyebrow JSX branch (and
  restructure for overlay; see below).
- `packages/editor-app` — auto-generated form drops the input with no code
  change; remove any field-override metadata entry.
- `packages/themes/src/templates/asociatia-studenteasca-demo/index.ts` — remove
  `eyebrow:` from seed hero blocks.
- Hero golden fixtures — strip `eyebrow` where present.

### Hero markup change (for overlay)

The hero gets a `hero--has-image` class hook when `backgroundImage` is set; the
engine positions `.hero__media` as an absolute background layer with the lockup
composited over it and the scrim between. One new class hook, no schema field.
`aria-hidden` on `.hero__media` follows the prior spec's rule (decorative when a
subtitle carries the intro; in the a11y tree with `alt` when no subtitle).

## Test plan

- Refresh the 5 per-theme hero goldens for the overlay + new identities.
- Update per-theme axe/contrast tests for overlay and the derived on-color; the
  AAA claim narrows to "AAA on text-on-scrim, AA on text-on-image-via-scrim."
- **New engine assertions:** fluid type present (`clamp()` in the type scale, no
  fixed-rem hero `h1`); owned `--section-gap` consumed between blocks;
  `--density-scale` and `--radius-base` actually consumed by CSS;
  `--color-on-accent`/`--color-on-primary` hit AA against their fill;
  `overflow-wrap` on titles; `aspect-ratio` on hero/content images.
- **Empty-state tests:** empty optional block suppressed in production output.
- Keep the "no raw color outside `:root`" assertion **strict** via the new
  `--color-*-rgb` siblings.

## Build sequence

Each PR independently mergeable; PR1 first to unblock parallel theme work.

1. **PR1 — Engine foundation:** fluid type scale, density/radius wiring,
   `--section-gap` rhythm, measure caps, `--color-*-rgb` siblings, on-color
   derivation, overflow/aspect/scrim rules + hero overlay markup + `eyebrow`
   removal plumbing. *No identity change yet — existing themes just inherit a
   safer base.*
2. **PR2 — Unify theme shape:** convert all 5 themes to the uniform identity
   token table; delete bespoke per-theme `:root` blocks and media queries now
   owned by the engine. Pure refactor; goldens shift.
3. **PR3–7 — One per theme** (`civic`→Activist, `modern`→Tech,
   `editorial`→Editorial, `minimal`→Calm, `academic`→Scholarly): the re-cast
   identity values + catalog metadata in
   [theme-catalog.ts](../../packages/themes/src/theme-catalog.ts) + goldens.
   Parallel worktrees.
4. **PR8 — Guardrails:** empty-state suppression, length-guidance metadata,
   on-color preview in the editor color picker.

## Out of scope

- New blocks. The reference sites lean on a stats strip, date-chipped event
  cards, projects logo grid, partners row, and newsletter band — all worth
  having, but that is a **block-catalog** project, not a theming one. Noted as a
  strong follow-up; not built here.
- Animation / transitions.
- Dark-mode variants of each theme.
- A sixth theme (e.g. a Warm/Community mood) — considered and deferred; the five
  are locked.
- Container queries — the page is single-column stacked, so viewport
  breakpoints suffice. Possible future nicety for blocks-in-columns.
- Live editor coaching (character counters, real-time warnings) — the chosen
  scope is engine + content guardrails, not active coaching.

## Reference research (2026-06-14)

Design-language findings from OSUBB (osubb.ro), OSUT (osut.ro, osut.org), and
ANOSR (anosr.ro). The convergent student-org pattern language that shaped the
identities above:

- **Overlay hero, no eyebrow** — every site puts the headline over a full-bleed
  photo or bold brand-color panel with a dark scrim and one accent CTA.
- **"Org in numbers" stat strip** — 3 of 4 lead with big counters (137 orgs /
  25 years / 20,000 students). The most universal student-org block (→ noted as
  a follow-up block).
- **One strong accent on a calm canvas** — crimson, electric blue, periwinkle —
  used sparingly for CTAs and active states.
- **Sans-serif, weight-driven hierarchy** — Montserrat/Roboto, Merriweather
  Sans, Space Grotesk; bold display, light body; no serif on any of the four
  (Editorial/Scholarly intentionally provide the serif option the references
  lack).
- **Stacked full-width bands, each doing one job**, generous vertical whitespace.
- **Action-oriented button copy** ("Read all articles", "See more events") +
  arrow text-links for secondary actions.

## References

- Locked theme directions: visual mockup `five_org_mood_theme_directions`
  (2026-06-14 brainstorming session).
- Superseded spec: `2026-05-28-themes-pizzaz-design.md`.
- Feedback memories: `feedback_no_hero_eyebrows.md`,
  `feedback_no_costume_ornaments.md`.
- Related ADRs: 0003 (token baseline), 0021 (modern), 0023 (civic), 0024
  (academic), 0026 (a11y CI gate), 0043 (form-override architecture), 0044 (no
  technical field escape hatches).
- Audit (2026-06-14): density/radius are dead tokens; no `clamp()` anywhere;
  editorial hero `h1` `3.157rem` with no mobile breakpoint; inter-block rhythm
  is the accidental sum of per-block padding; uncoordinated breakpoints; no
  measure caps; no content-length or image-aspect guards.
