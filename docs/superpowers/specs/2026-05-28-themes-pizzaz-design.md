# Theme pizzaz refresh — design

**Status:** Design — pending implementation plan
**Owner:** rdobre
**Branch:** feat/universal-asset-picker (will likely split per-theme)

## What & why

The five user-facing themes (`academic`, `civic`, `editorial`, `minimal`,
`modern`) work, but they read as variants of a single bland baseline. The
maintainer wants each theme to have a distinctive signature move — strong enough
that you can tell themes apart at a glance, restrained enough that they still
suit a generic student-org site.

Two concrete asks:

1. **More pizzaz** per theme — leaning into each theme's archetype with one
   signature move, not a personality change.
2. **Overlay text on hero images** — currently every theme renders the hero
   image as a polite `.hero__media` block below the title. Themes should
   composite text _over_ the image when one is present.

Constraint that shaped every decision below: this is a _generic student-org_
site builder. Theme designs serve org self-presentation (welcome / identify
the org / what we do / join us). They must not pretend to be museums,
magazines, or government communiques. See
`memory/feedback_no_costume_ornaments.md`.

## Brainstorming decisions

Locked through the visual companion session on 2026-05-27:

| Decision             | Choice                                       | Rationale                                                                                                                            |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Pizzaz volume        | Bold but on-brand                            | Each theme leans hard into its archetype with one signature move.                                                                    |
| Hero overlay pattern | Full-bleed image + scrim, per-theme variants | Theme decides treatment; no new schema field.                                                                                        |
| Block scope          | Hero + 3 high-impact blocks per theme        | rich-text, quote, cta-banner. Other 14 blocks share generic theme-flavored CSS.                                                      |
| Eyebrow field        | Remove                                       | `data.eyebrow` deleted from `HeroDataSchema`. Existing data round-trips silently via loose-object preservation but no UI, no render. |

## Architecture overview

No new layers — the existing three-layer token model (renderer baseline →
theme defaults → user overrides) and per-theme CSS strings stay as-is. Work is:

1. **Rewrite each theme's hero CSS** in `packages/renderer/src/themes/<id>.ts`
   to composite over a backgroundImage.
2. **Append per-theme rules** for `[data-block="richText"]`,
   `[data-block="quote"]`, and `[data-block="ctaBanner"]` in the same files.
3. **Refresh theme catalog metadata** in
   `packages/themes/src/theme-catalog.ts` (palette swatches, descriptions
   that reflect the new direction).
4. **Schema delete** of `eyebrow` from `HeroDataSchema`; remove the renderer
   branch that reads it; remove editor field; remove from the demo template.
5. **Golden tests refresh** — every existing per-theme hero golden + add new
   per-theme goldens for the 3 added blocks (5 themes × 3 blocks = 15 new).

The renderer's pure-function contract (`(siteData, themeId) -> HTML`) is
unchanged. The Hero JSX may need a minor restructure to support overlay (see
"Hero markup" below).

### Hero markup change

Today's Hero renders eyebrow, h1, subtitle, then `.hero__media`. To overlay,
the media needs to be the section's background-layer with the lockup
positioned over it. Two shapes are workable:

**Option A (chosen): keep `.hero__media`, theme positions absolutely.**
The JSX stays nearly identical; each theme's CSS uses `position: relative` on
the section, `position: absolute; inset: 0` on `.hero__media`, and positions
`.hero__inner` over it with a z-index. Markup change is one new class hook:
`hero--has-image` toggled when `backgroundImage` is set.

```tsx
const hasImage = backgroundImage !== undefined;
const classes = ["hero"];
if (hasImage) classes.push("hero--has-image");
return (
  <section
    data-block="hero"
    data-block-id={id}
    class={classes.join(" ")}
    aria-labelledby={`${id}__title`}
  >
    {hasImage && (
      <div class="hero__media" aria-hidden={subtitle === undefined ? "false" : "true"}>
        <img src={backgroundImage} alt={backgroundAlt} loading="lazy" />
      </div>
    )}
    <div class="hero__inner">
      <h1 id={`${id}__title`} class="hero__title">
        {title}
      </h1>
      {subtitle !== undefined && <p class="hero__subtitle">{subtitle}</p>}
    </div>
  </section>
);
```

Theme CSS can then choose: overlay (position lockup over media) or stack
(traditional below-title media). Each theme picks its own.

`aria-hidden` on `.hero__media` is set when the image is decorative (subtitle
provides the page intro context). When there's no subtitle, the image carries
descriptive weight, so it stays in the a11y tree with its `alt` text.

**Option B (rejected): introduce a `<picture>` element behind the lockup.**
More semantic for art-directed images but the schema doesn't carry
multiple-source art-directed variants. Defer.

## Per-theme hero treatments

All five use the full-bleed-with-scrim foundation from screen
`hero-overlay-direction.html` (selected pattern A). Each theme adapts:

### Academic — Cream parchment scrim, gold hairline

- Scrim is a **cream parchment** vertical gradient (#f7f1e3 96% → 60% → 20%),
  letting the image breathe through the top half.
- Single 56×2px gold rule above the title (`--color-accent`).
- Serif body throughout — title in `--font-headline` (Iowan Old Style /
  Charter / Georgia stack).
- Title color is `--color-primary` (Oxford navy) — readable against the
  parchment scrim with AAA contrast.
- No folio numerals, no Roman numerals, no scholarly cosplay.

### Civic — Anchor stripe, bold sans

- Single full-height burgundy (`--color-accent`) stripe on the left edge of
  the section, 6px wide.
- Dark navy scrim from bottom (rgba(12,27,46, 0.9 → 0.55 → 0.1)).
- Title in `--font-headline` (Source Sans 3), 800 weight, white.
- Subtitle gets a 3px left border in the burgundy accent — the anchor stripe
  motif repeating at micro scale.
- No tricolor flag bar, no "Comunicat oficial" stamp.

### Editorial — Sans/serif duet with italic dropcap

- Dark scrim from bottom (rgba(14,12,10, 0.9 → 0.4 → 0.05)).
- Title in `--font-headline` (Helvetica Neue / system sans), 700 weight, very
  large (~3rem desktop), letter-spacing -0.025em.
- **First letter of title swaps to an italic serif dropcap in ochre** (`--color-accent`).
  Implemented as `.hero__title::first-letter` in CSS — no JSX change, no
  character wrapping. CSS `::first-letter` supports font-family / color /
  font-style / font-size overrides natively. Romanian diacritics (`Ă`,
  `Î`, `Ş`, `Ţ`) are first-class first letters; CSS treats preceding
  punctuation (e.g., `«` or `"`) as part of the first-letter span per
  the CSS spec.
- Subtitle in `--font-body` (Charter / serif), italic — reads as a
  pull-quote lead.
- No masthead, no "Vol. X · Issue Y · Mai 2026".

### Modern — Gradient mesh + gradient text

- When `backgroundImage` is **absent**, theme paints a **gradient mesh**
  background — layered radial gradients in indigo/pink/amber over a slate
  base. This is modern's signature.
- When `backgroundImage` is **present**, the mesh becomes a diagonal scrim
  layer over the image instead.
- Title uses a `background-clip: text` white→indigo gradient. Subtle
  letter-spacing -0.025em, weight 800.
- Subtitle in sans, 85% opacity white.
- No glass chip eyebrow.

### Minimal — Hairline restraint

- Subtle scrim only at the bottom where text sits (rgba(17,17,17, 0.7 → 0.1 → 0)).
- **Monospace "EST. {foundedYear}" meta** in top-left as a quiet anchor —
  replaces what would have been an eyebrow. Pulled from `site.org.foundedYear`
  via the page-shell layer (the Hero component receives it as a render-time
  prop). Theme styles it with a "—" prefix. When `foundedYear` is absent,
  the meta line is suppressed and the rule alone remains.
- Single 1px vertical rule bottom-right, 64px tall (the one ornament).
- Title in sans, weight 600, size 1.875rem.
- No decoration beyond the meta + rule.

**Note:** This is the only theme that needs new render-time data piped to the
Hero component (`foundedYear` from `site.org`). The renderer's existing
asset-url pipeline already shows the pattern for passing context props
through to block components. See `packages/renderer/src/page-shell.tsx` for
the host that composes block props.

## Per-theme block-level signatures

Three blocks beyond hero get per-theme rules: rich-text, quote, cta-banner.
Picked because they're the highest-visual-yield blocks where theme
personality compounds (typography, ornament, color treatment all show).

### Rich-text

| Theme     | Signature                                                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Academic  | First-paragraph dropcap (serif, 3em, gold accent, drop-flowed). Gold hairline above h2/h3 headings. Italic emphasis for `<em>`.                                       |
| Civic     | Bold sans throughout. Blockquotes inside rich-text get the same burgundy anchor stripe as hero subtitle.                                                              |
| Editorial | First-paragraph dropcap (italic serif, ochre, 4em). Ornamental three-dot divider (`* * *`) before each h2. Pull-quotes inside rich-text get oversized italic styling. |
| Modern    | Inline code chips get a soft gradient background. h2/h3 get a 4px gradient accent rule on the left.                                                                   |
| Minimal   | Hairline 1px rule above h2/h3. Inline code in monospace. Restrained — no other ornament.                                                                              |

### Quote

| Theme     | Signature                                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Academic  | Hanging gold quotation mark before the text (CSS pseudo-element). Italic serif body. Attribution in small-caps below a thin gold rule. |
| Civic     | Burgundy anchor stripe on the left, full height of the quote. Bold serif body. Attribution right-aligned with em-rule.                 |
| Editorial | Massive italic serif body (1.5em), no quote marks (the typography carries it). Ochre em-rule + attribution in sans-serif small caps.   |
| Modern    | Glass-style card: subtle gradient border, backdrop-blur, gradient drop-quote mark in the corner.                                       |
| Minimal   | Hairline border, restrained sans body, monospace attribution.                                                                          |

### CTA banner

| Theme     | Signature                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Academic  | Cream plate with gold-bordered button. Serif heading.                                                                           |
| Civic     | Deep navy background with full-height burgundy anchor stripe (matches hero). Bold sans button, sharp corners.                   |
| Editorial | Dark band, massive sans heading, italic serif subtitle, sharp-cornered ochre button.                                            |
| Modern    | Gradient mesh background (same recipe as hero fallback). Glass button with subtle glow on hover (CSS-only `:hover` brightness). |
| Minimal   | Hairline-bordered band on cream, outline button, restrained.                                                                    |

## Schema change — remove `eyebrow`

The `eyebrow` field is deleted from `HeroDataSchema`:

```ts
// before
export const HeroDataSchema = z.looseObject({
  eyebrow: z.string().optional(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  backgroundImage: AssetRefSchema.optional(),
  backgroundAlt: z.string().optional(),
});

// after
export const HeroDataSchema = z.looseObject({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  backgroundImage: AssetRefSchema.optional(),
  backgroundAlt: z.string().optional(),
});
```

**Safety:** `z.looseObject` preserves unknown keys, so any existing snapshot
carrying an `eyebrow` value still round-trips through schema validation
without loss. The field simply has no validator, no UI, and no renderer
branch.

**Touchpoints:**

- `packages/schema/src/blocks/hero.ts` — drop the field.
- `packages/schema/test/hero-block.test.ts` — drop any eyebrow assertions.
- `packages/renderer/src/blocks/hero.tsx` — drop the eyebrow JSX branch.
- `packages/editor-app` — the auto-generated form walks the schema; once
  the field is gone, the input disappears with zero editor code change.
  Field-override metadata may have an entry — if so, remove.
- `packages/themes/src/templates/asociatia-studenteasca-demo/index.ts` —
  remove any `eyebrow:` from hero blocks in the seed.
- Hero golden HTML fixtures (`packages/renderer/test/fixtures/hero-only*.json`)
  — strip `eyebrow` where present.

**Documentation:**

- `CONTEXT.md` — no mention of hero eyebrow today.
- `docs/adr/` — no eyebrow-specific ADR. Add a one-paragraph ADR (0045)
  noting the field removal with this spec as the rationale.

## Theme catalog metadata

`buildThemeCatalog()` returns entries with `description`, `fonts`, and
`preview { swatches, headlineSample, bodySample }`. The descriptions today
are accurate but vanilla — refresh to communicate each theme's new signature:

| Theme     | New description                                                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| academic  | "Scholarly and restrained — cream parchment, gold rules, serif throughout. For research societies, honors programs, academic clubs."                  |
| civic     | "Engaged and direct — deep navy with a single burgundy anchor stripe. For advocacy, volunteering, debate, and civic-engagement orgs."                 |
| editorial | "Editorial duet — massive sans display headlines with italic serif accents and dropcaps. For student publications, literary clubs, debate societies." |
| minimal   | "Disciplined restraint — hairline rules, monospace meta, lots of breathing room. For orgs that want their photos and writing to do the work."         |
| modern    | "Bright and contemporary — gradient mesh backgrounds, gradient-text headlines, glass-styled accents. For tech, hackathon, and startup-leaning orgs."  |

Swatches and headline samples stay (already wired through to the picker).

## Test plan

Existing per-theme tests stay; goldens get regenerated. New per-theme block
goldens added.

**Existing hero goldens to refresh:**

- `__golden__/academic-theme-hero.html`
- `__golden__/civic-theme-hero.html`
- `__golden__/editorial-theme-hero.html`
- `__golden__/minimal-theme-hero.html`
- `__golden__/modern-theme-hero.html`

Plus the corresponding per-theme accessibility tests
(`*-theme.test.ts`, `*-axe.test.ts`) — assertions about the CSS rules,
DOM shape, and axe-clean status need to be updated for the overlay markup.

**New per-theme block goldens (15 files):**

- `{academic,civic,editorial,minimal,modern}-theme-rich-text.html`
- `{academic,civic,editorial,minimal,modern}-theme-quote.html`
- `{academic,civic,editorial,minimal,modern}-theme-cta-banner.html`

**Hero CSS leakage assertions:** each theme's test already asserts no
raw hex/rgb outside `:root`. The new overlay CSS uses `rgba()` in
gradients — the assertion needs to be loosened to permit `rgba()` in
`linear-gradient(...)` / `radial-gradient(...)` value positions (the
scrim is unavoidable with `var(--token)` because we need partial-alpha
versions of the bg/fg colors that aren't first-class tokens). Either:

- Allow `rgba()` outside `:root`, OR
- Add `--color-bg-rgb` / `--color-fg-rgb` / `--color-primary-rgb` tokens
  alongside the hex versions so scrims can use `rgb(var(--color-fg-rgb) / 0.7)`.

Chosen: **add `*-rgb` token siblings**, keep the no-raw-color assertion
strict. Three new tokens per theme; theme baseline emits them alongside
their hex counterparts.

**Contrast assertions:** civic's WCAG AAA claim in its theme header comment
needs re-verification — overlay text on a photo can't be guaranteed AAA
without testing. New axe test asserts the _scrim-rendered text_ (white on
navy gradient) hits AA 4.5:1 against the darkest scrim layer; the
guarantee that AAA holds against the photo behind cannot survive an
arbitrary user-uploaded image, so the header comment's AAA claim narrows
to "AAA on text-on-scrim, AA on text-on-image-via-scrim".

## Out of scope

- Animation / transitions (CSS-only or otherwise) — overlay reveal etc.
- Dark-mode variants of each theme.
- A new theme. This is a refresh of the existing five.
- Per-block × per-theme styling for the 14 non-hero/rich-text/quote/cta
  blocks (event-list, team-grid, etc.) — they continue to inherit
  generic theme-flavored CSS from tokens only.
- Editor-side preview thumbnails of the new theme heroes in the picker.
- Schema migration for older snapshots (the loose-object preservation
  rule handles existing `eyebrow:` values silently).

## Decomposition note

This spec is large enough that the implementation plan should split it
into per-theme PRs:

1. PR 1 — Hero markup change + schema/template/test cleanup for `eyebrow`
   removal. (Plumbing, no visual change yet.)
2. PR 2-6 — One per theme (academic, civic, editorial, minimal, modern):
   hero overlay + 3 block signatures + 4 goldens + axe/contrast updates.
   These can land in any order, are independently mergeable, and can be
   built in parallel worktrees.
3. PR 7 — Theme catalog metadata refresh (descriptions). Tiny.

Recommend doing PR 1 first to unblock the parallel theme work.

## Open questions

None blocking. Two implementation details surface during plan-writing:

1. `background-clip: text` (modern title gradient) — Chromium/Firefox/Safari
   all support it with vendor prefix. Fallback for headless rendering tests
   may need attention.
2. Hero component prop expansion for minimal's `foundedYear` — keep it as
   one new prop on Hero, or push more org context as a single `org` prop
   bundle. Bundle is more flexible but expands the contract; plan picks.

## References

- Brainstorming screens: `.superpowers/brainstorm/719-1779899831/content/`
- Hero overlay direction: screen `hero-overlay-direction.html` (option A
  selected)
- Per-theme signatures: screen `per-theme-hero-signatures-v4.html`
  (all five approved)
- Feedback memories: `feedback_no_hero_eyebrows.md`,
  `feedback_no_costume_ornaments.md`
- Related ADRs: 0021 (modern), 0023 (civic), 0024 (academic),
  0026 (a11y CI gate), 0043 (form-override architecture)
