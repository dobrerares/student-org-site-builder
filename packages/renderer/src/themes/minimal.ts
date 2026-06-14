/**
 * Minimal theme — "Calm" identity (content-first orgs: photography clubs,
 * writing collectives, anyone whose words and images should carry the page).
 *
 * Restraint is the spec, expressed through fundamentals only — palette, type,
 * density, shape — layered over the shared engine. No signature moves, no
 * ornament: ornament is a regression here. What makes Minimal read as Calm:
 *
 *  - Palette: monochrome. White base, near-black ink, one mid-grey for
 *    hairlines. The accent is ink too (#1a1a1a) — CTAs and links are
 *    near-black, never a hue. Hierarchy comes from weight + size + space.
 *  - Type: a single sans-serif (Inter) for headline and body. Inter is the
 *    first family in each stack, so the renderer self-hosts it (@font-face).
 *  - Density: airy — `--density-scale: 1.25`, the airiest of the set. Spacing
 *    flows from the engine's density-scaled `--space-*` scale (more breathing
 *    room is the brand), so the theme ships no hardcoded spacing override.
 *  - Shape: none — `--radius-base: 0px`. The engine derives sharp
 *    `--radius-sm/md/lg: 0`, so the theme ships no direct radius overrides.
 *
 * A narrow 56rem reading rail keeps content sections on a calm, readable
 * column — a legitimate Calm fundamental, not ornament.
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
  colorFg: "#1a1a1a",
  // Primary equals foreground: hierarchy via weight + size, not colour.
  colorPrimary: "#1a1a1a",
  // Calm uses a near-black / mono accent — CTAs and links are ink, not a hue.
  // Hierarchy comes from weight + size + space, never from colour.
  colorAccent: "#1a1a1a",
  // Single mid-grey — borders + de-emphasised meta text.
  colorMuted: "#767676",
  fontHeadline: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontBody: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const;

/**
 * Minimal ("Calm") tokens as raw [cssProp, value] pairs, routed through
 * `themeBaselineTokensFor` so the resolved-palette map (and the derived
 * --color-*-rgb / --color-on-* tokens) reflect minimal's colors, and so the
 * first font family in each stack is gated for self-hosting.
 *
 * Density: airy — `--density-scale: 1.25` multiplies the engine's `--space-*`
 * scale. Shape: none — `--radius-base: 0px`, from which the engine derives
 * `--radius-sm/md/lg: 0`. Both ship here as baseline tokens (not as a
 * hardcoded `:root` override) so the theme stays coupled to the engine knobs.
 */
export const MINIMAL_THEME_BASELINE_TOKENS: ReadonlyArray<readonly [string, string]> = [
  ["--color-bg", MINIMAL_THEME_TOKENS.colorBg],
  ["--color-fg", MINIMAL_THEME_TOKENS.colorFg],
  ["--color-primary", MINIMAL_THEME_TOKENS.colorPrimary],
  ["--color-accent", MINIMAL_THEME_TOKENS.colorAccent],
  ["--color-muted", MINIMAL_THEME_TOKENS.colorMuted],
  ["--font-headline", MINIMAL_THEME_TOKENS.fontHeadline],
  ["--font-body", MINIMAL_THEME_TOKENS.fontBody],
  // Density — airy. Multiplies the engine's --space-* scale (baseline 1).
  ["--density-scale", "1.25"],
  // Shape — none. The engine derives --radius-sm/md/lg: 0 from this base.
  ["--radius-base", "0px"],
];

/**
 * Layout-only CSS for the Minimal ("Calm") theme. Every value is a structural
 * primitive (units, dimensions, font-weights) or a `var(--token)` reference —
 * there is no raw colour anywhere, and the test suite asserts this.
 *
 * No `:root` block here: the Calm palette ships via the baseline-token list,
 * spacing flows from the engine's density-scaled `--space-*` (`--density-scale:
 * 1.25`, airier), and the sharp 0px corners derive from `--radius-base: 0px`.
 * This overlay keeps only the restraint fundamentals — hairline borders, a
 * narrow reading rail, stripped cards, a transparent badge, a solid-ink CTA
 * banner, ink underlined links, and a visible focus ring.
 */
export const MINIMAL_THEME_CSS = `
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
