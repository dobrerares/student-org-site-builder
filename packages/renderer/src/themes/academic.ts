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
 *   Library Gold (#a67c2e)  — accent; muted gold for rules, dates, links
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
 * line-height (1.65) for body, tighter for display. A comfortable text
 * measure sits inside a wider desktop rail so pages feel like contemporary
 * student-org sites rather than a narrow manuscript column.
 *
 * Ornament
 * --------
 * Modest. A quiet underline on links on hover, and that is it for v1. The
 * hero uses the shared universal overlay. No drop-caps, no ornamental dingbats — those
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
  ["--measure-body", "88ch"],

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
:root {
  --site-readable-width: 64rem;
}
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
h1 { font-size: var(--type-scale-3xl); letter-spacing: 0; }
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

[data-site-nav] {
  border-top: 4px solid var(--color-primary);
  border-bottom: 1px solid var(--color-accent);
  background: var(--color-bg);
}
[data-site-nav] ul,
[data-language-switcher] ul {
  max-width: var(--site-readable-width);
  margin-inline: auto;
}
[data-site-nav] a {
  font-style: italic;
}
[data-block="valueList"] .value-list__inner,
[data-block="activitiesList"] .activities-list__inner,
[data-block="teamGrid"] .team-grid__inner,
[data-block="contactCard"] .contact-card__inner,
[data-block="faq"] .faq__inner,
[data-block="documentDownloads"] .document-downloads__inner,
[data-block="partnerLogos"] .partner-logos__inner,
[data-block="event-list"] > :is(.event-list__title, .event-list__intro, .event-list__items) {
  max-width: var(--site-readable-width);
}
[data-block="valueList"] .value-list__item,
[data-block="activitiesList"] .activities-list__item,
[data-block="teamGrid"] .team-person__figure,
[data-block="documentDownloads"] .document-downloads__item,
[data-block="faq"] .faq__item,
[data-block="partnerLogos"] .partner-logos__item {
  border: 0;
  border-block-start: 1px solid var(--color-accent);
  border-radius: 0;
  background: transparent;
  padding: var(--space-md) 0;
}
[data-block="event-list"] .event-list__item article {
  border: 0;
  border-inline-start: 2px solid var(--color-accent);
  border-radius: 0;
  background: transparent;
  padding: var(--space-md) 0 var(--space-md) var(--space-md);
}
[data-block="valueList"] .value-list__items,
[data-block="activitiesList"] .activities-list__items,
[data-block="teamGrid"] .team-grid__list,
[data-block="documentDownloads"] .document-downloads__list,
[data-block="event-list"] .event-list__items,
[data-block="faq"] .faq__list {
  gap: var(--space-lg);
}
[data-block="valueList"] .value-list__icon {
  color: var(--color-accent);
}
[data-block="activitiesList"] .activities-list__badge {
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: var(--color-bg);
}
[data-block="quote"] {
  border-top: 1px solid var(--color-accent);
  border-bottom: 1px solid var(--color-accent);
}
[data-block="quote"] .quote__text {
  border-left: 0;
  padding-left: 0;
}
[data-block="imageGallery"] .image-gallery__figure {
  border: 1px solid var(--color-accent);
  background: var(--color-bg);
  padding: var(--space-xs);
}
`.trim();
