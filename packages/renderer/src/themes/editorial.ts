/**
 * Editorial theme — "Editorial" identity (student publications / cultural /
 * debate societies).
 *
 * Aesthetic brief: type-forward, warm, magazine-ish — but NOT costume. The
 * identity comes entirely from fundamentals — palette, type, density, shape —
 * layered over the shared engine. There are no decorative "signature moves":
 * no uppercase eyebrows, no rules-as-ornament, no folio numerals. What makes
 * Editorial read as a magazine:
 *
 *  - Palette: terracotta on warm paper. A near-black warm ink (#1a1714) carries
 *    the text and headlines; a single terracotta accent (#c4622d) does the
 *    persuading — links, focus, emphasis. The page sits on a warm cream ground
 *    (#fbf8f3) with a warm grey muted (#8a7e72), so the whole thing reads like
 *    a printed magazine spread rather than a clinical white screen.
 *  - Type: SERIF display + SANS body — Fraunces for headlines (a high-contrast
 *    display serif with real magazine character) paired with Inter for body.
 *    Both are self-hosted by the renderer (the first family in each stack
 *    matches the font registry, so `@font-face` is auto-emitted). This reverses
 *    the legacy sans-display / serif-body pairing: the editorial voice now lives
 *    in the Fraunces serif display, not in uppercasing.
 *  - Density: comfortable — `--density-scale: 1.15` opens up the engine's
 *    `--space-*` scale. Magazine pages breathe.
 *  - Shape: soft — `--radius-base: 6px`. The engine derives the gently-rounded
 *    `--radius-sm/md/lg` for cards and badges.
 *
 * Contract with the renderer:
 *  - One id constant, a baseline-token list, and one CSS string, registered by
 *    id in `index.tsx`. The id stays `editorial`.
 *  - All colour, spacing, typography, and radius values reference
 *    `var(--token)`. The single exception is the `:root` block (emitted by the
 *    engine from the baseline tokens), which legitimately *defines* the values
 *    the rest of the theme consumes.
 *  - Headline sizing flows from the engine's fluid `--type-*` clamp scale, so
 *    display type is responsive and never overflows on mobile (the legacy
 *    hardcoded rem scale is gone). Cards / borders / surfaces come from the
 *    shared production base; this theme contributes only the fundamentals above
 *    plus genuinely-universal polish (Fraunces headings, accent links, a
 *    visible focus ring, a comfortable quote measure).
 */

export const EDITORIAL_THEME_ID = "editorial" as const;

/**
 * Editorial tokens as raw [cssProp, value] pairs, routed through
 * `themeBaselineTokensFor` so the renderer's resolved-palette map (and thus
 * the derived --color-*-rgb / --color-on-* tokens) reflect editorial's warm
 * palette, and so the first font family in each stack is gated for
 * self-hosting. The tuple mechanism (unlike the legacy schema-keyed Record)
 * lets the theme set --color-bg / --color-fg / --color-muted as well as the
 * density and radius engine knobs — so the warm cream ground actually renders.
 *
 * Density: comfortable — `--density-scale: 1.15` multiplies the engine's
 * `--space-*` scale (baseline 1). Shape: soft — `--radius-base: 6px`, from
 * which the engine derives `--radius-sm/md/lg`.
 */
export const EDITORIAL_THEME_BASELINE_TOKENS: ReadonlyArray<readonly [string, string]> = [
  // Palette — terracotta on warm paper. Warm ink for primary + fg, a single
  // terracotta accent, a cream ground, and a warm grey muted.
  ["--color-primary", "#1a1714"],
  ["--color-accent", "#c4622d"],
  ["--color-bg", "#fbf8f3"],
  ["--color-fg", "#1a1714"],
  ["--color-muted", "#8a7e72"],
  // Type — Fraunces serif display + Inter body. The first quoted family in each
  // stack is self-hosted by the renderer (auto @font-face); the rest are system
  // fallbacks friendly to Romanian diacritics. This flips the legacy
  // sans-display / serif-body pairing — the magazine voice is the serif display.
  ["--font-headline", '"Fraunces", Georgia, "Times New Roman", serif'],
  ["--font-body", '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'],
  // Density — comfortable. Multiplies the engine's --space-* scale (baseline 1).
  ["--density-scale", "1.15"],
  // Shape — soft. The engine derives --radius-sm/md/lg from this base.
  ["--radius-base", "6px"],
];

/**
 * Layout-only CSS for the Editorial theme. Every value is a structural
 * primitive (units, dimensions, font-weights) or a `var(--token)` reference —
 * there is no raw colour anywhere, and the test suite asserts this.
 *
 * No `:root` block here: the Editorial palette ships via the baseline-token
 * list, spacing flows from the engine's density-scaled `--space-*`
 * (`--density-scale: 1.15`, comfortable), and the soft 6px corners derive from
 * `--radius-base: 6px`. Heading sizes consume the engine's fluid `--type-*`
 * clamp scale so display type stays responsive. This overlay keeps only the
 * type-forward fundamentals — Fraunces serif headings, accent underlined links,
 * a visible focus ring, and a comfortable quote measure. No uppercasing, no
 * rules-as-ornament: the magazine feel is the Fraunces serif display +
 * terracotta + warm cream + comfortable density.
 */
export const EDITORIAL_THEME_CSS = `
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
html { color: var(--color-fg); background: var(--color-bg); }
body {
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-body);
  font-size: 1rem;
  line-height: 1.65;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
main { display: block; }
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-headline);
  color: var(--color-primary);
  line-height: 1.15;
  letter-spacing: 0;
  margin: 0 0 var(--space-md) 0;
  font-weight: 600;
}
/* Fluid display scale from the engine's --type-* clamp tokens. The hero title
   is sized by the shared hero overlay (var(--type-3xl)); the bare h1 below is
   the editorial display-headline contract the hero's <h1> also inherits. */
h1 { font-size: var(--type-3xl); letter-spacing: 0; }
h2 { font-size: var(--type-2xl); }
h3 { font-size: var(--type-xl); }
h4 { font-size: var(--type-lg); }
h5 { font-size: var(--type-base); }
h6 { font-size: var(--type-base); letter-spacing: 0.02em; }
p { margin: 0 0 var(--space-md) 0; }
a {
  /* Link text uses the contrast-safe --color-link. Terracotta-on-cream fails AA,
     so the engine resolves --color-link to the warm-ink primary here; the
     terracotta accent still shows as the underline (universal [data-block] a
     rule), keeping the editorial link affordance. The underline (always present,
     thickening on hover) is the link signal. */
  color: var(--color-link);
  text-decoration: underline;
  text-underline-offset: 0.15em;
  text-decoration-thickness: 1px;
}
a:hover, a:focus-visible { text-decoration-thickness: 2px; }
/* Visible keyboard focus ring in the accent colour. */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}
[data-site-nav] {
  border-top: 1px solid var(--color-primary);
  border-bottom: 1px solid var(--color-primary);
}
[data-site-nav] ul,
[data-language-switcher] ul {
  justify-content: center;
  max-width: var(--site-wide-width);
  margin-inline: auto;
}
[data-site-nav] a {
  font-family: var(--font-headline);
  font-size: 0.9375rem;
  font-weight: 600;
  letter-spacing: 0;
}
[data-language-switcher] a {
  color: var(--color-link);
}
[data-block="valueList"] .value-list__items {
  gap: var(--space-lg);
}
/* Editorial card treatment: a thin top rule instead of a fill — restrained,
   classic editorial. Scoped to genuine cards (activities/docs/events); content
   blocks (value-list, team, faq, partners) lean on the shared clean defaults so
   we never float a rule above a round avatar or double up faq dividers. */
[data-block="activitiesList"] .activities-list__item,
[data-block="documentDownloads"] .document-downloads__item,
[data-block="event-list"] .event-list__item article {
  border: 0;
  border-top: 2px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
}
[data-block="valueList"] .value-list__label,
[data-block="activitiesList"] .activities-list__item-title,
[data-block="teamGrid"] .team-person__name,
[data-block="documentDownloads"] .document-downloads__label,
[data-block="event-list"] .event-list__item-title,
[data-block="faq"] .faq__question {
  font-family: var(--font-headline);
  letter-spacing: 0;
}
[data-block="activitiesList"][data-layout="cards"] .activities-list__items,
[data-block="documentDownloads"][data-layout="cards"] .document-downloads__list,
[data-block="teamGrid"] .team-grid__list {
  gap: var(--space-xl);
}
[data-block="activitiesList"] .activities-list__badge {
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-family: var(--font-headline);
}
[data-block="quote"] {
  width: min(100%, 56rem);
  border-top: 2px solid var(--color-primary);
  border-bottom: 1px solid var(--color-muted);
}
[data-block="quote"] .quote__text {
  border-left: 0;
  padding-left: 0;
  font-size: var(--type-xl);
}
[data-block="imageGallery"] .image-gallery__grid {
  gap: var(--space-sm);
}
[data-block="imageGallery"] .image-gallery__caption {
  font-style: italic;
}
@media (min-width: 860px) {
  [data-block="activitiesList"][data-layout="alternating"] .activities-list__item {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
    align-items: end;
  }
}
`.trim();
