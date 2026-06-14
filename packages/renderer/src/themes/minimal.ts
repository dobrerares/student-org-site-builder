/**
 * Minimal theme — issue #31.
 *
 * Restraint is the spec. The Minimal theme is the most ornament-bound theme
 * in v1: ornament is a regression. The brief:
 *
 *  - Monochrome base (white, near-black, one mid-grey for borders).
 *  - One accent colour, used sparingly (links, primary CTA only).
 *  - One sans-serif type family throughout (no headline/body pairing).
 *  - Minimal type scale (1.2 ratio max).
 *  - Tight density: small radii (sharp 0px corners), restrained spacing.
 *  - No shadows, no gradients, no decorative borders.
 *  - Hierarchy via weight + size only, not colour.
 *
 * Per-block goldens for the other 14 blocks land alongside those blocks
 * (#9–#22). Today the theme ships a hero golden only — same scope as the
 * stub theme (#46) and Academic theme (#47) precedents.
 */

export const MINIMAL_THEME_ID = "minimal" as const;

/**
 * Theme-token defaults exposed for tests and (eventually) for the editor's
 * theme picker. The renderer's `:root` rule is composed by `emitTokenRoot`
 * from baseline tokens + user overrides; per-theme defaults are folded in by
 * `themeCssFor` so every theme gets its own monochrome / palette identity.
 *
 * Inter is named first so sites that ship an Inter web-font benefit, but the
 * fallback is a robust system stack — sites that do not ship a font still
 * read as a clean, modern sans-serif. The Minimal theme deliberately uses
 * the same family for headline and body: hierarchy comes from weight + size,
 * not from a typeface contrast.
 */
export const MINIMAL_THEME_TOKENS = {
  colorBg: "#ffffff",
  colorFg: "#111111",
  // Primary equals foreground: hierarchy via weight + size, not colour.
  colorPrimary: "#111111",
  // Single accent — used for links and the primary CTA only.
  colorAccent: "#2266dd",
  // Single mid-grey — borders + de-emphasised meta text.
  colorMuted: "#767676",
  fontHeadline: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontBody: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const;

/**
 * Minimal palette as raw [cssProp, value] pairs, routed through
 * `themeBaselineTokensFor` so the resolved-palette map (and the derived
 * --color-*-rgb / --color-on-* tokens) reflect minimal's colors.
 */
export const MINIMAL_THEME_BASELINE_TOKENS: ReadonlyArray<readonly [string, string]> = [
  ["--color-bg", MINIMAL_THEME_TOKENS.colorBg],
  ["--color-fg", MINIMAL_THEME_TOKENS.colorFg],
  ["--color-primary", MINIMAL_THEME_TOKENS.colorPrimary],
  ["--color-accent", MINIMAL_THEME_TOKENS.colorAccent],
  ["--color-muted", MINIMAL_THEME_TOKENS.colorMuted],
  ["--font-headline", MINIMAL_THEME_TOKENS.fontHeadline],
  ["--font-body", MINIMAL_THEME_TOKENS.fontBody],
];

/**
 * Layout-only CSS for the Minimal theme. Every value MUST be `var(--token)`
 * or a structural primitive (units, dimensions, font-weights) — there is no
 * raw colour outside the `:root` rule, and the test suite asserts this.
 *
 * The `:root` rule overrides the renderer's baseline tokens with Minimal's
 * palette + sharp-corner radii + tightened spacing. The `1.2` type scale is
 * applied as: body 1rem · h1 1.728rem (1.2³) · h2 1.44rem (1.2²). Anything
 * larger would break the brief; anything more granular would add noise.
 */
export const MINIMAL_THEME_CSS = `
:root {
  --radius-sm: 0;
  --radius-md: 0;
  --radius-lg: 0;
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 3rem;
}
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-body);
  font-size: 1rem;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
main { display: block; }
a {
  color: var(--color-accent);
  text-decoration: underline;
  text-underline-offset: 0.15em;
}
[data-block="hero"] {
  padding: var(--space-xl) var(--space-md);
  max-width: 56rem;
  margin: 0 auto;
}
[data-block="hero"] .hero__eyebrow {
  font-size: 0.8125rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-muted);
  margin: 0 0 var(--space-sm) 0;
  font-weight: 500;
}
[data-block="hero"] h1 {
  font-family: var(--font-headline);
  font-size: 1.728rem;
  line-height: 1.2;
  font-weight: 600;
  margin: 0 0 var(--space-sm) 0;
  color: var(--color-primary);
  letter-spacing: 0;
}
[data-block="hero"] .hero__subtitle {
  font-size: 1rem;
  line-height: 1.5;
  color: var(--color-fg);
  margin: 0 0 var(--space-md) 0;
  max-width: 40rem;
}
[data-block="hero"] .hero__media {
  margin-top: var(--space-lg);
  border-radius: var(--radius-md);
  overflow: hidden;
}
[data-block="hero"] .hero__media img {
  display: block;
  max-width: 100%;
  height: auto;
}
[data-site-nav],
[data-language-switcher] {
  max-width: 56rem;
  margin-inline: auto;
  border-bottom: 1px solid var(--color-muted);
}
[data-site-nav] ul,
[data-language-switcher] ul {
  gap: var(--space-md);
}
[data-block="valueList"],
[data-block="activitiesList"],
[data-block="teamGrid"],
[data-block="contactCard"],
[data-block="richText"],
[data-block="quote"],
[data-block="faq"],
[data-block="documentDownloads"],
[data-block="event-list"],
[data-block="partnerLogos"],
[data-block="imageGallery"] {
  max-width: 56rem;
  margin-inline: auto;
  border-top: 1px solid var(--color-muted);
}
[data-block="valueList"] .value-list__item,
[data-block="activitiesList"] .activities-list__item,
[data-block="teamGrid"] .team-person__figure,
[data-block="documentDownloads"] .document-downloads__item,
[data-block="event-list"] .event-list__item article,
[data-block="faq"] .faq__item,
[data-block="partnerLogos"] .partner-logos__item {
  border: 0;
  border-top: 1px solid var(--color-muted);
  border-radius: 0;
  background: transparent;
  padding: var(--space-md) 0;
}
[data-block="valueList"] .value-list__icon {
  width: 1.5rem;
  height: 1.5rem;
  margin-bottom: var(--space-xs);
}
[data-block="activitiesList"][data-layout="cards"] .activities-list__items,
[data-block="documentDownloads"][data-layout="cards"] .document-downloads__list,
[data-block="teamGrid"] .team-grid__list {
  gap: var(--space-lg);
}
[data-block="activitiesList"] .activities-list__body,
[data-block="teamGrid"] .team-person__caption {
  padding: 0;
}
[data-block="activitiesList"] .activities-list__badge {
  background: transparent;
  color: var(--color-accent);
  padding: 0;
  border-radius: 0;
}
[data-block="ctaBanner"] {
  background: var(--color-fg);
}
[data-block="ctaBanner"] .ctaBanner__inner {
  max-width: 56rem;
}
[data-block="ctaBanner"] .ctaBanner__button {
  border-radius: 0;
}
[data-block="imageGallery"] .image-gallery__figure,
[data-block="activitiesList"] .activities-list__media {
  border-radius: 0;
  background: transparent;
}
`.trim();
