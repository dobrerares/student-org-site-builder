/**
 * Editorial theme.
 *
 * Print-magazine inspired: serif body type, sans-serif headings for contrast,
 * generous body line-height, sophisticated palette built on ink-black, cream,
 * and a single ochre accent. Type scale tilted toward larger contrast (1.333
 * ratio). Restrained — over-decoration is the wrong direction for this brief.
 *
 * Implementation note: like every theme, this contributes layout-only CSS
 * that consumes `var(--token)` exclusively. Palette and font defaults arrive
 * via the `EDITORIAL_THEME_TOKENS` map below, which the renderer can register
 * as defaults. Per-block × per-theme goldens are deferred until the block
 * matrix lands; v1 covers tokens emission + hero golden + axe-clean.
 */

export const EDITORIAL_THEME_ID = "editorial" as const;

/**
 * Default token values for the Editorial theme. The keys mirror the schema's
 * theme-token shape (`colorPrimary`, `colorAccent`, etc.). When a site picks
 * this theme but does not override individual tokens, these are the values
 * the renderer should emit on `:root`.
 *
 * Palette rationale (print-magazine, restrained):
 *  - bg: cream — paper-like warmth without yellowing
 *  - fg: ink — deep, soft black; not pure #000 to keep the page readable
 *  - primary: a touch deeper than fg, used for headlines and emphasis
 *  - accent: ochre — the single editorial accent, chosen over brick / teal
 *    because ochre reads warmest against a cream ground
 *  - muted: warm grey, harmonious with cream rather than competing with it
 *
 * Typography rationale:
 *  - Body: serif stack with broadly-available print-feeling faces. Charter
 *    leads (best modern web-readability among the classics), Source Serif
 *    next, then system Georgia, then a generic serif fallback.
 *  - Headline: sans-serif for contrast (the brief calls out the trick of
 *    pairing sans display + serif body for editorial feel). System UI sans
 *    leads to keep weight low; Helvetica / Arial / Inter as common fallbacks.
 */
export const EDITORIAL_THEME_TOKENS: Readonly<Record<string, string>> = {
  colorPrimary: "#0e0c0a",
  colorAccent: "#a8732a",
  fontHeadline:
    '"Helvetica Neue", "Inter", system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
  fontBody: '"Charter", "Source Serif 4", "Source Serif Pro", Georgia, "Times New Roman", serif',
};

/**
 * Layout-only CSS for the Editorial theme. Every value MUST be `var(--token)`
 * or a unitless number / structural primitive — the test suite asserts there
 * is no hex / rgb leakage outside of `:root`.
 *
 * Type-scale values follow the perfect-fourth (1.333) ratio, computed off a
 * 1rem (16px equivalent) base:
 *   small  ≈ 0.75rem    body = 1rem
 *   h6     = 1rem       h5   = 1.125rem
 *   h4     = 1.333rem   h3   = 1.777rem
 *   h2     = 2.369rem   h1   = 3.157rem
 * The ratio gives the larger headline contrast the brief calls for without
 * tipping into theatrical sizes.
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
  font-weight: 700;
}
h1 { font-size: 3.157rem; letter-spacing: 0; }
h2 { font-size: 2.369rem; }
h3 { font-size: 1.777rem; }
h4 { font-size: 1.333rem; }
h5 { font-size: 1.125rem; }
h6 { font-size: 1rem; text-transform: uppercase; letter-spacing: 0.06em; }
p { margin: 0 0 var(--space-md) 0; }
a {
  /* Use --color-primary (dark, contrast-safe) rather than --color-accent:
     a user-overridable accent token can easily fall below WCAG AA 4.5:1
     for body text. Editorial's link affordance is the underline (always
     present, thickening on hover), not the colour — this swap keeps the
     restrained-magazine feel while guaranteeing readability. */
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 0.15em;
  text-decoration-thickness: 1px;
}
a:hover { text-decoration-thickness: 2px; }
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
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
[data-block="valueList"] .value-list__items {
  gap: var(--space-lg);
}
[data-block="valueList"] .value-list__item,
[data-block="activitiesList"] .activities-list__item,
[data-block="teamGrid"] .team-person__figure,
[data-block="documentDownloads"] .document-downloads__item,
[data-block="event-list"] .event-list__item article,
[data-block="faq"] .faq__item,
[data-block="partnerLogos"] .partner-logos__item {
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
  text-transform: uppercase;
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
  color: var(--color-bg);
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
  font-size: 1.777rem;
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
