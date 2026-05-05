/**
 * Academic theme.
 *
 * The brand-bearing skin for the project's canonical reference org
 * (HISTORIPOL — student history society at Universitatea „Ovidius" Constanța)
 * and the default demo. Tone: institutional, restrained, traditional but not
 * dated. Per the PRD, the Academic theme is one of two minimum-viable themes
 * (alongside Modern + Civic in the 3-theme fallback).
 *
 * Design intent
 * -------------
 * Issue #47 was triaged `ready-for-human` because the visual is qualitative.
 * This file is the AI-scaffolded first-pass draft per the scope-expansion
 * note: hit the academic archetype well, leave room for the maintainer to
 * curate. Decisions made here are deliberately conservative — see the
 * `// curation:` comments for the reversible knobs.
 *
 * Palette
 * -------
 *   Oxford Navy (#1a2440)   — primary; titles, links, the institutional voice
 *   Antique Parchment (#f7f1e3) — background; warm, cream-coloured page
 *   Iron Gall (#2a2418)     — body text; an ink-dark brown, easier on the
 *                             eye against parchment than pure black
 *   Library Gold (#a67c2e)  — accent; muted gold for eyebrows, rules, dates
 *   Faded Marginalia (#6b5f4a) — muted; meta text, captions
 *
 * Typography
 * ----------
 * Serif throughout. The unifying choice from the contract. We lean on system
 * serifs that ship with macOS / Windows / Linux so end-user sites need no
 * font-loading: Iowan Old Style (macOS), Georgia (Windows), and Charter
 * (broad fallback). Body and headlines share the family deliberately —
 * traditional academic prints almost always do — but the type scale gives
 * the headline weight and tracking the contrast the design needs.
 *
 * Type scale
 * ----------
 * Modular, ratio ≈ 1.25 (the major-third). Body 1rem, h1 ≈ 2.44rem. Generous
 * line-height (1.65) for body, tighter for display. Wider measure (~70ch on
 * the hero subtitle) for serious-text readability.
 *
 * Ornament
 * --------
 * Modest. A thin gold rule under the eyebrow, a quiet underline on links on
 * hover, and that is it for v1. No drop-caps, no ornamental dingbats — those
 * fight Romanian diacritics and the maintainer can add them later if the
 * curation wants more flourish.
 *
 * Curation knobs (reversible without churning the renderer):
 *   curation: palette hex values — five named tokens above.
 *   curation: type stack — `Iowan Old Style, Charter, Georgia, ...` order.
 *   curation: type scale ratio — 1.25 (major third) is the conservative pick.
 *   curation: line-height — 1.65 body, 1.15 display.
 *   curation: rule colour — currently `--color-accent`, could be `--color-muted`.
 */

export const ACADEMIC_THEME_ID = "academic" as const;

/**
 * Tokens contributed by the Academic theme. These are appended to the
 * baseline `:root` block by the renderer's token emitter, so later wins —
 * the theme can override any baseline freely, and any user-provided
 * `site.theme.tokens` value still overrides the theme.
 */
export const ACADEMIC_THEME_TOKENS: ReadonlyArray<readonly [string, string]> = [
  // Palette — see header comment for the named-colour rationale.
  ["--color-primary", "#1a2440"],
  ["--color-bg", "#f7f1e3"],
  ["--color-fg", "#2a2418"],
  ["--color-accent", "#a67c2e"],
  ["--color-muted", "#6b5f4a"],

  // Typography — serif throughout. System fonts only; no @font-face.
  [
    "--font-headline",
    '"Iowan Old Style", "Charter", "Charis SIL", Georgia, "Palatino Linotype", Palatino, serif',
  ],
  [
    "--font-body",
    '"Iowan Old Style", "Charter", "Charis SIL", Georgia, "Palatino Linotype", Palatino, serif',
  ],

  // Modular type scale (1.25 ratio). Tokens consumable by per-block CSS.
  ["--type-scale-base", "1rem"],
  ["--type-scale-sm", "0.8rem"], // 1 / 1.25
  ["--type-scale-lg", "1.25rem"],
  ["--type-scale-xl", "1.5625rem"], // 1.25^2
  ["--type-scale-2xl", "1.953rem"], // 1.25^3
  ["--type-scale-3xl", "2.441rem"], // 1.25^4 — display

  // Line-height & measure tokens — the academic readability rhythm.
  ["--leading-body", "1.65"],
  ["--leading-display", "1.15"],
  ["--measure-body", "70ch"],

  // Surface / structure tweaks consistent with the parchment-and-rule look.
  ["--radius-sm", "2px"],
  ["--radius-md", "4px"],
  ["--radius-lg", "6px"],
];

/**
 * Layout-only CSS for the Academic theme. Every value is either a structural
 * primitive or a `var(--token)` reference. The test suite asserts no raw
 * hex / rgb leakage outside `:root`.
 */
export const ACADEMIC_THEME_CSS = `
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-body);
  font-size: var(--type-scale-base);
  line-height: var(--leading-body);
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}
main { display: block; }

/* Headings — serif display, tighter line-height, slightly tracked. */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-headline);
  line-height: var(--leading-display);
  color: var(--color-primary);
  margin: 0 0 var(--space-md) 0;
  font-weight: 600;
}
h1 { font-size: var(--type-scale-3xl); letter-spacing: -0.005em; }
h2 { font-size: var(--type-scale-2xl); }
h3 { font-size: var(--type-scale-xl); }
h4 { font-size: var(--type-scale-lg); }
h5, h6 { font-size: var(--type-scale-base); }

/* Paragraph rhythm and the academic measure. */
p {
  margin: 0 0 var(--space-md) 0;
  max-width: var(--measure-body);
}

/* Italic emphasis — the academic register prefers italics over bold. */
em, i, cite { font-style: italic; }

/* Hero — page-opening composition. */
[data-block="hero"] {
  padding: var(--space-xl) var(--space-md);
  border-bottom: 1px solid var(--color-accent);
}
[data-block="hero"] .hero__inner {
  max-width: 70ch;
  margin: 0 auto;
}
[data-block="hero"] .hero__eyebrow {
  font-size: var(--type-scale-sm);
  font-style: italic;
  letter-spacing: 0.06em;
  color: var(--color-accent);
  margin: 0 0 var(--space-sm) 0;
  text-transform: uppercase;
}
[data-block="hero"] h1 {
  font-family: var(--font-headline);
  font-size: var(--type-scale-3xl);
  line-height: var(--leading-display);
  color: var(--color-primary);
  margin: 0 0 var(--space-md) 0;
}
[data-block="hero"] .hero__subtitle {
  margin: 0 0 var(--space-md) 0;
  color: var(--color-fg);
  font-size: var(--type-scale-lg);
  line-height: var(--leading-body);
  max-width: var(--measure-body);
}
[data-block="hero"] .hero__media {
  margin-top: var(--space-md);
  border-radius: var(--radius-md);
  overflow: hidden;
}
[data-block="hero"] .hero__media img {
  display: block;
  max-width: 100%;
  height: auto;
}
`.trim();
