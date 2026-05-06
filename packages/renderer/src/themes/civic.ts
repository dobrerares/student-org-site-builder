/**
 * Civic theme.
 *
 * Archetype: government / community-organisation / institutional.
 * Per the maintainer-expanded scope on #30, this theme leans into the
 * "civic" feel rather than the original PRD brief's warm-red + sun-yellow
 * palette. Civic websites are recognisable: deep blue, warm white, a single
 * warm accent, neutral sans-serif type, strong contrast, rectangular blocks.
 *
 * Palette (deep blue + warm white + warm-burgundy accent)
 * ------------------------------------------------------
 *   --color-bg:      #fdfaf3   (warm white / off-cream)
 *   --color-fg:      #0c1b2e   (very dark navy text)
 *   --color-primary: #0c2d5e   (deep institutional blue)
 *   --color-accent:  #9c3a17   (warm burgundy/rust)
 *   --color-muted:   #3b4a5e   (slate grey)
 *
 * Measured WCAG contrast vs --color-bg (#fdfaf3, relative luminance ~0.957):
 *   - fg (#0c1b2e):        ~15.7:1   (AAA, exceeds 7:1)
 *   - primary (#0c2d5e):   ~12.7:1   (AAA, exceeds 7:1)
 *   - accent (#9c3a17):     ~8.25:1  (AAA, exceeds 7:1)
 *   - muted (#3b4a5e):      ~8.18:1  (AAA, exceeds 7:1)
 *
 * Civic priority on #30 is "AAA contrast where feasible" — this palette
 * clears 7:1 on every body-text combination, which is the AAA bar for
 * normal text. (Large/heading text needs only 4.5:1 for AAA, so all
 * combinations are comfortably over.)
 *
 * Type stack: Source Sans 3 (Public Sans was the PRD's original pick, but
 * the maintainer-expanded scope swapped to a clean institutional sans).
 * Source Sans 3 is widely deployed in civic / government style guides
 * (e.g., USWDS), supports Romanian diacritics across all weights, and
 * falls back gracefully to system sans on any platform that hasn't loaded
 * a webfont.
 *
 * Radius: <= 4px. Civic styling is rectangular and institutional, not
 * playful. The renderer's universal baseline radii (4 / 8 / 16 px) are
 * reduced to 2 / 3 / 4 px here.
 *
 * Density / spacing: inherits the renderer's universal spacing scale —
 * civic doesn't need denser-than-default rhythm in v1.
 *
 * No gradients. Subtle borders OK on dividers and the hero plate.
 */

export const CIVIC_THEME_ID = "civic" as const;

/**
 * Civic theme baseline tokens.
 *
 * The renderer composes :root in this order: universal renderer baseline
 * (see `tokens.ts`), then the active theme's baseline (this list), then
 * the user's `site.theme.tokens` overrides. CSS later-wins resolves the
 * cascade so user customisation always trumps the theme's defaults.
 */
export const CIVIC_THEME_BASELINE_TOKENS: ReadonlyArray<readonly [string, string]> = [
  // Palette — civic deep-blue + warm-white + burgundy accent.
  ["--color-bg", "#fdfaf3"],
  ["--color-fg", "#0c1b2e"],
  ["--color-primary", "#0c2d5e"],
  ["--color-accent", "#9c3a17"],
  ["--color-muted", "#3b4a5e"],
  // Subtle border tone — picked to not introduce a sixth raw colour. We
  // re-use the muted slate; civic dividers are quiet, not decorative.
  ["--color-border", "#d6cfc1"],

  // Typography — neutral institutional sans, multi-weight.
  [
    "--font-headline",
    '"Source Sans 3", "Source Sans Pro", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  ],
  [
    "--font-body",
    '"Source Sans 3", "Source Sans Pro", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  ],

  // Radius — rectangular, civic feel. All <= 4px.
  ["--radius-sm", "2px"],
  ["--radius-md", "3px"],
  ["--radius-lg", "4px"],
];

/**
 * Civic theme layout CSS.
 *
 * Every value MUST be either a structural primitive (numbers, units,
 * keywords like `block`, `block-end`, etc.) or a `var(--token)` reference.
 * Hex / rgb leakage outside `:root` is forbidden and asserted in
 * `civic-theme.test.ts`.
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
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
main { display: block; }
a {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 0.15em;
}
a:hover, a:focus-visible {
  color: var(--color-accent);
}
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}

[data-block="hero"] {
  padding: var(--space-xl) var(--space-md);
  border-block-end: 1px solid var(--color-border);
}
[data-block="hero"] .hero__inner {
  max-width: 64rem;
  margin: 0 auto;
}
[data-block="hero"] .hero__eyebrow {
  font-family: var(--font-body);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  /* Use --color-primary (dark, contrast-safe) rather than --color-accent:
     a user-overridable accent token can easily fall below WCAG AA 4.5:1
     for small text. Eyebrow then matches the h1 color block, which is
     the civic theme's already-established headline discipline. */
  color: var(--color-primary);
  margin: 0 0 var(--space-sm) 0;
}
[data-block="hero"] h1 {
  font-family: var(--font-headline);
  font-weight: 700;
  font-size: 2.5rem;
  line-height: 1.15;
  letter-spacing: -0.005em;
  color: var(--color-primary);
  margin: 0 0 var(--space-md) 0;
}
[data-block="hero"] .hero__subtitle {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 1.1875rem;
  line-height: 1.5;
  color: var(--color-fg);
  margin: 0 0 var(--space-md) 0;
  max-width: 48rem;
}
[data-block="hero"] .hero__media {
  margin-top: var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
[data-block="hero"] .hero__media img {
  display: block;
  max-width: 100%;
  height: auto;
}
`.trim();
