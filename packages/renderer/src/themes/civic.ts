/**
 * Civic theme — "Activist" identity (advocacy / campaigns / student-rights).
 *
 * Aesthetic brief: bold, direct, unafraid. The identity comes entirely from
 * fundamentals — palette, type, density, shape — layered over the shared
 * engine. There are no decorative "signature moves" (no filled nav bar, no
 * accent rule-bars on cards or blocks). What makes Civic read as Activist:
 *
 *  - Palette: crimson + ink on pure white. A single hot accent (#cb2b2b) does
 *    all the persuading — links, CTAs, focus, the recolored badge. Everything
 *    else is near-black ink (#17181c) on white.
 *  - Type: Archivo for display (a heavy, grotesque, placard-ready sans) paired
 *    with Inter for body. Both are self-hosted by the renderer (the first
 *    family in each stack matches the font registry, so `@font-face` is
 *    auto-emitted). Headings — including the hero title — are set at weight
 *    800: the loud, declarative voice is the brand.
 *  - Density: compact — `--density-scale: 0.85` tightens the engine's
 *    `--space-*` scale. Activist pages are dense and urgent, not airy.
 *  - Shape: sharp — `--radius-base: 2px`. The engine derives the near-square
 *    `--radius-sm/md/lg` for cards, badges and buttons.
 *
 * Measured WCAG contrast (engine-derived `--color-on-accent` is white on the
 * crimson accent):
 *   - ink (#17181c) on white:    ~17.7:1  (AAA)
 *   - crimson (#cb2b2b) on white: ~5.36:1 (AA for links / large text)
 *   - white on crimson (#cb2b2b): ~5.36:1 (AA — the badge / on-accent)
 *   - muted (#6b6b6b) on white:   ~5.33:1 (AA)
 *
 * Contract with the renderer:
 *  - One id constant, a baseline-token list, and one CSS string, registered by
 *    id in `index.tsx`. The id stays `civic`.
 *  - All colour, spacing, typography, and radius values reference
 *    `var(--token)`. The single exception is the `:root` block (emitted by the
 *    engine from the baseline tokens), which legitimately *defines* the values
 *    the rest of the theme consumes.
 *  - Cards/borders/surfaces come from the shared production base; this theme
 *    only contributes the fundamentals above plus genuinely-universal polish
 *    (heavy headings, accent links, a visible focus ring, a recolored badge).
 */

export const CIVIC_THEME_ID = "civic" as const;

/**
 * Civic ("Activist") tokens as raw [cssProp, value] pairs, routed through
 * `themeBaselineTokensFor` so the renderer's resolved-palette map (and thus
 * the derived --color-*-rgb / --color-on-* tokens) reflect civic's colors,
 * and so the first font family in each stack is gated for self-hosting.
 *
 * Density: compact — `--density-scale: 0.85` multiplies the engine's
 * `--space-*` scale (baseline 1). Shape: sharp — `--radius-base: 2px`, from
 * which the engine derives `--radius-sm/md/lg`. Both ship here as baseline
 * tokens (not as a hardcoded `:root` override) so the theme stays coupled to
 * the engine knobs — the legacy direct `--radius-sm/md/lg` overrides are gone.
 */
export const CIVIC_THEME_BASELINE_TOKENS: ReadonlyArray<readonly [string, string]> = [
  // Palette — crimson + ink on pure white. Four swatches, no separate border
  // token: borders use --color-muted, like the other production themes.
  ["--color-primary", "#17181c"],
  ["--color-accent", "#cb2b2b"],
  ["--color-bg", "#ffffff"],
  ["--color-fg", "#17181c"],
  ["--color-muted", "#6b6b6b"],
  // Type — Archivo heavy display + Inter body. The first quoted family in each
  // stack is self-hosted by the renderer (auto @font-face); the rest are
  // system fallbacks friendly to Romanian diacritics.
  ["--font-headline", '"Archivo", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'],
  ["--font-body", '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'],
  // Density — compact. Multiplies the engine's --space-* scale (baseline 1).
  ["--density-scale", "0.85"],
  // Shape — sharp. The engine derives --radius-sm/md/lg from this base.
  ["--radius-base", "2px"],
];

/**
 * Layout-only CSS for the Civic ("Activist") theme. Every value is a structural
 * primitive (units, dimensions, font-weights) or a `var(--token)` reference —
 * there is no raw colour anywhere, and the test suite asserts this.
 *
 * No `:root` block here: the Activist palette ships via the baseline-token
 * list, spacing flows from the engine's density-scaled `--space-*`
 * (`--density-scale: 0.85`, compact), and the sharp 2px corners derive from
 * `--radius-base: 2px`. This overlay keeps only the bold fundamentals — heavy
 * Archivo headings, accent underlined links, a visible focus ring, and a
 * recolored crimson badge. No filled nav bar, no accent rule-bars: block
 * separation comes from the engine's section rhythm; cards get their plain
 * border from the production base.
 */
export const CIVIC_THEME_CSS = `
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 1.0625rem;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
main { display: block; }
/* Heavy Archivo display — the loud Activist voice, incl. the hero title. */
[data-block="hero"] .hero__title,
[data-block] :is(
  .contact-card__heading,
  .value-list__title,
  .activities-list__title,
  .team-grid__title,
  .faq__title,
  .document-downloads__title,
  .event-list__title,
  .image-gallery__title,
  .partner-logos__title,
  .ctaBanner__title
) {
  font-weight: 800;
}
/* Link text uses the contrast-safe --color-link (here it resolves to the crimson
   accent, which clears AA on white). The underline still carries the accent via
   the universal [data-block] a rule in production-base. */
a {
  color: var(--color-link);
  text-decoration: underline;
  text-underline-offset: 0.15em;
}
a:hover, a:focus-visible {
  text-decoration-thickness: 2px;
}
/* Visible keyboard focus ring in the accent colour. */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}
/* Nav uses the baseline layout — ink links, crimson on active/hover. */
[data-site-nav] ul,
[data-language-switcher] ul {
  max-width: var(--site-max-width);
  margin-inline: auto;
}
[data-site-nav] a {
  color: var(--color-fg);
}
[data-site-nav] a:hover,
[data-site-nav] a[data-active="true"] {
  color: var(--color-accent);
}
[data-site-nav] a[data-active="true"] {
  text-decoration: underline;
  text-decoration-thickness: 2px;
}
[data-block="valueList"] .value-list__items,
[data-block="activitiesList"] .activities-list__items,
[data-block="teamGrid"] .team-grid__list,
[data-block="documentDownloads"] .document-downloads__list,
[data-block="event-list"] .event-list__items {
  gap: var(--space-md);
}
[data-block="valueList"] .value-list__icon {
  color: var(--color-accent);
}
/* Tasteful badge — recolored to the crimson accent (white on-accent). */
[data-block="activitiesList"] .activities-list__badge {
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-accent);
}
[data-block="documentDownloads"] .document-downloads__meta,
[data-block="event-list"] .event-list__item-time {
  font-weight: 700;
}
`.trim();
