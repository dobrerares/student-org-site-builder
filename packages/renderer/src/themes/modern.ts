/**
 * Modern theme — "Tech" identity (hackathons / engineering / startup clubs).
 *
 * Aesthetic brief: crisp, bright, geometric. The identity comes entirely from
 * fundamentals — palette, type, density, shape — layered over the shared
 * engine. There are no decorative "signature moves" (no tints, no accent bars,
 * no special nav alignment). What makes Modern read as Tech:
 *
 *  - Palette: slate + a single bright royal-blue accent on a pure-white base.
 *  - Type: Space Grotesk for display (geometric, technical) paired with Inter
 *    for body. Both are self-hosted by the renderer (the first family in each
 *    stack matches the font registry, so `@font-face` is auto-emitted).
 *  - Density: normal — baseline engine spacing (no `--density-scale` override).
 *  - Shape: round. `--radius-base: 12px` lets the engine derive the rounded
 *    `--radius-sm/md/lg` for cards, badges and buttons.
 *
 * Contract with the renderer:
 *  - Mirrors the structural pattern of the other themes: one id constant, a
 *    baseline-token list, and one CSS string, registered by id in
 *    `index.tsx`.
 *  - All colour, spacing, typography, and radius values reference
 *    `var(--token)`. The single exception is a `:root` block, which
 *    legitimately *defines* token values the rest of the theme consumes.
 *  - Cards/borders/surfaces come from the shared production base; this theme
 *    only contributes the fundamentals above plus genuinely-universal polish
 *    (accent links, a visible focus ring).
 */

export const MODERN_THEME_ID = "modern" as const;

/**
 * Modern ("Tech") tokens as raw [cssProp, value] pairs, routed through
 * `themeBaselineTokensFor` so the renderer's resolved-palette map (and thus
 * the derived --color-*-rgb / --color-on-* tokens) reflect modern's colors,
 * and so the first font family in each stack is gated for self-hosting.
 *
 * Shape: a single `--radius-base: 12px` (round). The engine derives
 * `--radius-sm/md/lg` from it, so the theme ships no direct radius overrides.
 * Density: omitted — Tech is normal density, i.e. the engine baseline of 1.
 */
export const MODERN_THEME_BASELINE_TOKENS: ReadonlyArray<readonly [string, string]> = [
  // Palette — slate + bright royal-blue accent on a pure-white base.
  ["--color-primary", "#0f172a"],
  ["--color-accent", "#2563eb"],
  ["--color-bg", "#ffffff"],
  ["--color-fg", "#0f172a"],
  ["--color-muted", "#64748b"],
  // Type — Space Grotesk display + Inter body. The first quoted family in each
  // stack is self-hosted by the renderer (auto @font-face); the rest are
  // system fallbacks friendly to Romanian diacritics.
  ["--font-headline", '"Space Grotesk", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'],
  ["--font-body", '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'],
  // Shape — round. The engine derives --radius-sm/md/lg from this base.
  ["--radius-base", "12px"],
];

/**
 * Layout-only CSS for the Modern ("Tech") theme. Every value is a structural
 * primitive or a `var(--token)` reference — there is no raw colour and no
 * `color-mix()` anywhere (the test suite asserts no raw colour outside
 * `:root`). Cards, borders and surfaces are inherited from the shared
 * production base; the rounded corners come from `--radius-base: 12px`
 * deriving the engine's `--radius-*`. This overlay only adds fundamentals:
 * crisp block spacing, accent links, and a visible focus ring.
 */
export const MODERN_THEME_CSS = `
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
[data-block="valueList"] .value-list__items,
[data-block="activitiesList"][data-layout="cards"] .activities-list__items,
[data-block="teamGrid"] .team-grid__list,
[data-block="documentDownloads"][data-layout="cards"] .document-downloads__list {
  gap: var(--space-lg);
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
}
[data-block="teamGrid"] .team-person__caption {
  padding: 0 var(--space-md) var(--space-md);
}
[data-block="ctaBanner"] .ctaBanner__inner {
  align-items: center;
}
[data-block="documentDownloads"] .document-downloads__link {
  gap: var(--space-xs);
}
/* Link text uses the contrast-safe --color-link (here it resolves to the bright
   accent, which clears AA on white). The underline carries the accent via the
   universal [data-block] a rule in production-base. */
a {
  color: var(--color-link);
  text-decoration: underline;
  text-underline-offset: 0.15em;
}
a:hover {
  text-decoration: none;
}
/* Visible keyboard focus ring in the accent colour. */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
`.trim();
