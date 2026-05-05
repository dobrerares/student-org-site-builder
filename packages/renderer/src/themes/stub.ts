/**
 * Stub theme.
 *
 * A deliberately empty theme used to exercise the renderer framework without
 * making any design decisions. It contributes:
 *
 *  - layout-only CSS that uses `var(--token)` exclusively (never raw colours)
 *  - no per-theme hero variant — the structural hero from the renderer is used
 *
 * The Academic theme (#47) and the rest (#28-#31) replace this with curated
 * palettes, typography, and per-theme hero compositions.
 */

export const STUB_THEME_ID = "stub" as const;

/**
 * Layout-only CSS for the stub theme. Every value MUST be `var(--token)` or a
 * unitless number / structural primitive — the test suite asserts there is
 * no hex / rgb leakage outside of `:root`.
 */
export const STUB_THEME_CSS = `
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-body);
  line-height: 1.5;
}
main { display: block; }
[data-block="hero"] {
  padding: var(--space-xl) var(--space-md);
}
[data-block="hero"] .hero__eyebrow {
  font-size: 0.875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-muted);
  margin: 0 0 var(--space-sm) 0;
}
[data-block="hero"] h1 {
  font-family: var(--font-headline);
  margin: 0 0 var(--space-md) 0;
  color: var(--color-primary);
}
[data-block="hero"] .hero__subtitle {
  margin: 0 0 var(--space-md) 0;
  color: var(--color-fg);
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
[data-block="richText"] {
  padding: var(--space-lg) var(--space-md);
}
[data-block="richText"] .rich-text h2,
[data-block="richText"] .rich-text h3,
[data-block="richText"] .rich-text h4 {
  font-family: var(--font-headline);
  color: var(--color-primary);
  margin: var(--space-md) 0 var(--space-sm) 0;
}
[data-block="richText"] .rich-text p,
[data-block="richText"] .rich-text ul,
[data-block="richText"] .rich-text ol,
[data-block="richText"] .rich-text blockquote {
  margin: 0 0 var(--space-md) 0;
}
[data-block="richText"] .rich-text blockquote {
  padding-left: var(--space-md);
  border-left: 4px solid var(--color-accent);
  color: var(--color-muted);
}
[data-block="richText"] .rich-text a {
  color: var(--color-primary);
  text-decoration: underline;
}
[data-block="richText"] .rich-text code {
  font-family: var(--font-body);
  background: var(--color-bg);
  padding: 0 var(--space-xs);
  border-radius: var(--radius-sm);
}
`.trim();
