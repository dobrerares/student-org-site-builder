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
[data-block="valueList"] {
  padding: var(--space-xl) var(--space-md);
}
[data-block="valueList"] .value-list__title {
  font-family: var(--font-headline);
  margin: 0 0 var(--space-sm) 0;
  color: var(--color-primary);
}
[data-block="valueList"] .value-list__intro {
  margin: 0 0 var(--space-md) 0;
  color: var(--color-muted);
}
[data-block="valueList"] .value-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-md);
}
[data-block="valueList"][data-layout="grid"][data-columns="1"] .value-list__items {
  grid-template-columns: 1fr;
}
[data-block="valueList"][data-layout="grid"][data-columns="2"] .value-list__items {
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
}
[data-block="valueList"][data-layout="grid"][data-columns="3"] .value-list__items {
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
}
[data-block="valueList"][data-layout="grid"][data-columns="4"] .value-list__items {
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}
[data-block="valueList"][data-layout="list"] .value-list__items {
  grid-template-columns: 1fr;
}
[data-block="valueList"] .value-list__item {
  display: block;
}
[data-block="valueList"] .value-list__icon {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  margin-bottom: var(--space-sm);
  color: var(--color-accent);
}
[data-block="valueList"] .value-list__icon svg {
  width: 100%;
  height: 100%;
}
[data-block="valueList"] .value-list__label {
  font-family: var(--font-headline);
  margin: 0 0 var(--space-xs) 0;
  color: var(--color-primary);
}
[data-block="valueList"] .value-list__description {
  margin: 0;
  color: var(--color-fg);
}
@media (max-width: 600px) {
  [data-block="valueList"] .value-list__items {
    grid-template-columns: 1fr;
  }
}
`.trim();
