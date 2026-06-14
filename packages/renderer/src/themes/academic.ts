/**
 * Academic theme — "Scholarly" identity (research societies / honor
 * societies / faculty bodies).
 *
 * Aesthetic brief: credible and warm — but NOT a manuscript costume. The
 * identity comes entirely from fundamentals — palette, type, density, shape —
 * layered over the shared engine. There are no decorative "signature moves":
 * no forced italics, no rules-as-ornament, no parchment mats or accent frames.
 * What makes Academic read as scholarly:
 *
 *  - Palette: refined navy + gold on cream. A deep institutional navy
 *    (#1e3a5f) carries titles, links, and the institutional voice; a muted
 *    library gold (#b8893e) does the accenting — links, focus, badges. The page
 *    sits on a warm cream ground (#f7f3ea) with a slate-grey muted (#5c6b7a),
 *    so the whole thing reads like a credible university body rather than a
 *    clinical white screen or a faux-antique scroll.
 *  - Type: SERIF display + SANS body — Source Serif 4 for headlines (a warm,
 *    readable text serif with academic gravity) paired with Inter for body.
 *    Both are self-hosted by the renderer (the first family in each stack
 *    matches the font registry, so `@font-face` is auto-emitted). This reverses
 *    the legacy serif-throughout pairing: the scholarly voice now lives in the
 *    Source Serif display, not in a manuscript-style serif body or forced
 *    italics.
 *  - Density: comfortable — `--density-scale: 1.15` opens up the engine's
 *    `--space-*` scale. Scholarly pages breathe.
 *  - Shape: soft — `--radius-base: 4px`. The engine derives the gently-rounded
 *    `--radius-sm/md/lg` for cards and badges. (4px is the softest-but-still-
 *    crisp corner among the five themes — a distinct, restrained fundamental.)
 *
 * The one structural fundamental Academic keeps beyond palette/type/density/
 * shape is a narrower content rail (`--site-readable-width: 64rem`): scholarly
 * content sits on a tighter, more readable measure than the wider 72rem default
 * the other themes use. That is a legitimate typographic fundamental, not
 * ornament, and a layout-distinctness test asserts it.
 *
 * Contract with the renderer:
 *  - One id constant, a baseline-token list, and one CSS string, registered by
 *    id in `index.tsx`. The id stays `academic`.
 *  - All colour, spacing, typography, and radius values reference
 *    `var(--token)`. The single exception is the `:root` block (which sets only
 *    the narrow readable rail), since the rest of the palette/density/radius
 *    ships via the baseline-token list emitted into the engine's `:root`.
 *  - Headline sizing flows from the engine's fluid `--type-*` clamp scale, so
 *    display type is responsive and never overflows on mobile (the legacy
 *    hardcoded modular rem scale is gone). Cards / borders / surfaces come from
 *    the shared production base; this theme contributes only the fundamentals
 *    above plus genuinely-universal polish (Source Serif headings, gold accent
 *    underlined links, a visible focus ring).
 */

export const ACADEMIC_THEME_ID = "academic" as const;

/**
 * Academic tokens as raw [cssProp, value] pairs, routed through
 * `themeBaselineTokensFor` so the renderer's resolved-palette map (and thus the
 * derived --color-*-rgb / --color-on-* tokens) reflect academic's navy/gold/
 * cream palette, and so the first font family in each stack is gated for
 * self-hosting. The tuple mechanism lets the theme set --color-bg / --color-fg /
 * --color-muted as well as the density and radius engine knobs — so the warm
 * cream ground actually renders.
 *
 * Density: comfortable — `--density-scale: 1.15` multiplies the engine's
 * `--space-*` scale (baseline 1). Shape: soft — `--radius-base: 4px`, from which
 * the engine derives `--radius-sm/md/lg`.
 */
export const ACADEMIC_THEME_TOKENS: ReadonlyArray<readonly [string, string]> = [
  // Palette — refined navy + gold on cream. Navy for primary, a single muted
  // library gold accent, a warm cream ground, ink-dark fg, slate-grey muted.
  ["--color-primary", "#1e3a5f"],
  ["--color-accent", "#b8893e"],
  ["--color-bg", "#f7f3ea"],
  ["--color-fg", "#1f2933"],
  ["--color-muted", "#5c6b7a"],

  // Type — Source Serif 4 serif display + Inter body. The first quoted family in
  // each stack is self-hosted by the renderer (auto @font-face); the rest are
  // system fallbacks friendly to Romanian diacritics. This flips the legacy
  // serif-throughout pairing — the scholarly voice is the serif display.
  ["--font-headline", '"Source Serif 4", Georgia, "Times New Roman", serif'],
  ["--font-body", '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'],

  // Density — comfortable. Multiplies the engine's --space-* scale (baseline 1).
  ["--density-scale", "1.15"],
  // Shape — soft. The engine derives --radius-sm/md/lg from this base. 4px is
  // unique to academic among the five themes (its distinct shape fundamental).
  ["--radius-base", "4px"],
];

/**
 * Layout-only CSS for the Academic theme. Every value is a structural primitive
 * (units, dimensions, font-weights) or a `var(--token)` reference — there is no
 * raw colour anywhere, and the test suite asserts this.
 *
 * The only `:root` rule here narrows the content rail to 64rem — academic's
 * scholarly fundamental (a tighter readable measure than the 72rem default).
 * Palette/density/radius ship via the baseline-token list, spacing flows from
 * the engine's density-scaled `--space-*` (`--density-scale: 1.15`,
 * comfortable), and the soft 4px corners derive from `--radius-base: 4px`.
 * Heading sizes consume the engine's fluid `--type-*` clamp scale so display
 * type stays responsive. This overlay keeps only the scholarly fundamentals —
 * Source Serif serif headings, gold accent underlined links, a visible focus
 * ring, and the narrow readable rail. No forced italics, no rules-as-ornament,
 * no frames or mats: the scholarly feel is the Source Serif display +
 * navy/gold/cream + comfortable density + soft 4px + the narrow rail.
 */
export const ACADEMIC_THEME_CSS = `
:root {
  --site-readable-width: 64rem;
}
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

/* Headings — Source Serif display, tighter line-height. Source Serif 4's
   registry weights are 600/700; 700 gives the headline the scholarly weight. */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-headline);
  line-height: 1.15;
  letter-spacing: 0;
  color: var(--color-primary);
  margin: 0 0 var(--space-md) 0;
  font-weight: 700;
}
/* Fluid display scale from the engine's --type-* clamp tokens. The hero title
   is sized by the shared hero overlay (var(--type-3xl)); the bare h1 below is
   the academic display-headline contract the hero's <h1> also inherits. */
h1 { font-size: var(--type-3xl); }
h2 { font-size: var(--type-2xl); }
h3 { font-size: var(--type-xl); }
h4 { font-size: var(--type-lg); }
h5 { font-size: var(--type-base); }
h6 { font-size: var(--type-base); }

/* Paragraph rhythm — the readable measure flows from the engine's default. */
p { margin: 0 0 var(--space-md) 0; max-width: var(--measure-body); }

a {
  /* Link text uses the contrast-safe --color-link. Gold-on-cream fails AA, so
     the engine resolves --color-link to the navy primary here; the gold accent
     still shows as the underline (universal [data-block] a rule), keeping the
     scholarly link affordance. The underline (always present, thickening on
     hover) is the link signal. */
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
[data-site-nav] ul,
[data-language-switcher] ul {
  max-width: var(--site-readable-width);
  margin-inline: auto;
}
/* Academic narrows its content sections to the tighter scholarly rail. */
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
`.trim();
