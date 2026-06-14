/**
 * Modern theme — issue #28.
 *
 * Aesthetic brief (from #28 + the AFK orchestration scope-expansion notes):
 *  - Sans-serif throughout, system stack (zero web-font network cost,
 *    universally available, friendly to Romanian diacritics).
 *  - Generous whitespace, geometric layout (two-column hero on desktop,
 *    single-column on small viewports).
 *  - Restrained palette: neutral white/slate base with one bold accent.
 *  - Subtle, flat: no gradients, no decorative shadows, no ornaments.
 *  - 8px corner radius (matches the renderer baseline `--radius-md`).
 *
 * Contract with the renderer:
 *  - Mirrors the structural pattern of `stub.ts`: one id constant, one CSS
 *    string, registered by id in `index.tsx::themeCssFor`.
 *  - All colour, spacing, typography, and radius values reference
 *    `var(--token)`. The single exception is the `:root` override block
 *    inside this CSS, which legitimately *defines* the token values that
 *    the rest of the theme consumes (the renderer's tokens.ts emits a
 *    *baseline* set of tokens; themes layer their own overrides via a
 *    later-wins `:root` rule).
 *
 * Per-block × per-theme goldens for blocks #9–#22 are explicitly out of
 * scope for this PR; only the hero golden ships here. Each block PR adds
 * its own modern-theme golden when those blocks land.
 */

export const MODERN_THEME_ID = "modern" as const;

/**
 * Modern-theme CSS.
 *
 * Layered onto the renderer's baseline tokens-on-`:root` rule, this CSS
 * begins with its own `:root` block that overrides the baseline typography
 * (sans system stack on both headline and body) and palette (slate +
 * royal-blue accent). Per-block rules then consume only `var(--token)`.
 *
 * The hero layout is two-column on viewports ≥720px and single-column
 * below; we keep the breakpoint inline rather than introducing a
 * theme-level breakpoint token to keep the contract narrow for v1.
 */
/**
 * Modern palette as raw [cssProp, value] pairs, routed through
 * `themeBaselineTokensFor` so the renderer's resolved-palette map (and thus
 * the derived --color-*-rgb / --color-on-* tokens) reflect modern's colors.
 */
export const MODERN_THEME_BASELINE_TOKENS: ReadonlyArray<readonly [string, string]> = [
  ["--font-headline", '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'],
  ["--font-body", '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'],
  ["--color-bg", "#ffffff"],
  ["--color-fg", "#0f172a"],
  ["--color-muted", "#64748b"],
  ["--color-primary", "#0f172a"],
  ["--color-accent", "#2563eb"],
];

export const MODERN_THEME_CSS = `
:root {
  --space-2xl: 6rem;
}
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-body);
  font-size: 1rem;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
main { display: block; }
[data-site-nav] {
  background: var(--color-bg);
}
[data-site-nav] ul,
[data-language-switcher] ul {
  max-width: var(--site-max-width);
  margin-inline: auto;
  align-items: center;
}
[data-site-nav] ul {
  justify-content: flex-end;
}
[data-block="valueList"] .value-list__items,
[data-block="activitiesList"][data-layout="cards"] .activities-list__items,
[data-block="teamGrid"] .team-grid__list,
[data-block="documentDownloads"][data-layout="cards"] .document-downloads__list {
  gap: var(--space-lg);
}
[data-block="valueList"] .value-list__item,
[data-block="activitiesList"] .activities-list__item,
[data-block="teamGrid"] .team-person__figure,
[data-block="documentDownloads"] .document-downloads__item,
[data-block="event-list"] .event-list__item article,
[data-block="faq"] .faq__item,
[data-block="partnerLogos"] .partner-logos__item {
  border-color: color-mix(in srgb, var(--color-muted) 28%, var(--color-bg));
  border-radius: var(--radius-md);
}
[data-block="valueList"] .value-list__item,
[data-block="activitiesList"] .activities-list__item,
[data-block="teamGrid"] .team-person__figure {
  background: color-mix(in srgb, var(--color-bg) 92%, var(--color-accent));
}
[data-block="valueList"] .value-list__icon {
  width: 2.5rem;
  height: 2.5rem;
  align-items: center;
  justify-content: center;
  padding: var(--space-xs);
  border: 1px solid color-mix(in srgb, var(--color-accent) 45%, var(--color-bg));
  border-radius: var(--radius-md);
  background: var(--color-bg);
}
[data-block="activitiesList"][data-layout="cards"] .activities-list__item {
  padding: 0;
  overflow: hidden;
}
[data-block="activitiesList"] .activities-list__body {
  padding: var(--space-md);
}
[data-block="activitiesList"] .activities-list__badge {
  justify-self: start;
  border-radius: var(--radius-sm);
}
[data-block="teamGrid"] .team-person__caption {
  padding: 0 var(--space-md) var(--space-md);
}
[data-block="ctaBanner"] .ctaBanner__inner {
  align-items: center;
}
[data-block="ctaBanner"] .ctaBanner__button {
  border-radius: var(--radius-md);
}
[data-block="documentDownloads"] .document-downloads__link {
  gap: var(--space-xs);
}
[data-block="event-list"] .event-list__item article {
  border-left: 4px solid var(--color-accent);
}
`.trim();
