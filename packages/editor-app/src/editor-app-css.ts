/**
 * Editor-app design system stylesheet.
 *
 * Authored as a TypeScript string so it travels with the bundle and applies
 * uniformly across both host shells (`@sosb/browser-shell` and
 * `@sosb/electron-shell`) without per-shell wiring. The module's top-level
 * side effect injects the styles once into `document.head`, idempotently
 * and SSR-safely.
 *
 * Visual direction: a calm, friendly workspace for people who are not
 * designers. One sans-serif family (Inter, self-hosted from the renderer's
 * bundled bytes — see `editor-fonts.ts`), soft corners, white cards on a
 * cool-grey ground, a single teal action colour, and severity colours that
 * read at a glance. Selectors hang off the data attributes the components
 * already emit for testing, so no class names need to be threaded through
 * the React tree.
 *
 * Token contract (CSS custom properties on `:root`):
 *
 *   --font-ui / --font-mono     type families
 *   --paper*, --ink*, --rule*   ground palette
 *   --accent*                   the single action colour
 *   --error / --warn / --info / --ok  severity colours (+ *-soft fills)
 *   --r-sm / --r-md / --r-lg    corner radii
 *
 * Override any of these at the consuming-document level to retheme without
 * forking this file.
 *
 * Cascade position (issue #102)
 * -----------------------------
 * Everything below is wrapped in `@layer sosb-editor`, whose position is
 * fixed by `@sosb/ui`'s `builder.css`:
 *
 *     @layer theme, base, sosb-editor, components, utilities;
 *
 * This sheet used to be entirely unlayered, which meant it beat every rule
 * `@sosb/ui` shipped no matter how specific — a shared `<Button>` could ask
 * for the design system's chrome and silently keep the editor's instead. The
 * shared components are built from Tailwind utilities, so putting this sheet
 * below `utilities` is what finally lets them look like themselves.
 *
 * What still works: this sheet outranks the shared `base` reset, so it keeps
 * owning the shell's layout, the generated forms and the panels — the things
 * `@sosb/ui` has no opinion about. What changed: it no longer re-skins the
 * shared controls. Where a control needs a tone the design system does not
 * have by default, express it on the component (see `data-tone="danger"` in
 * `packages/ui/src/components/button.tsx`) rather than by re-styling it here.
 *
 * The layer statement lives in `builder.css` rather than here because layer
 * order is set by first declaration, and `builder.css` is *prepended* to the
 * head while this sheet is appended — so `builder.css` is always parsed
 * first, whichever order the two modules happen to load in.
 */

// Side-effect import: registers Inter @font-face rules before the stylesheet
// below references the family.
import "./editor-fonts.js";

const STYLE_ELEMENT_ID = "sosb-editor-app-style";

export const EDITOR_APP_CSS = String.raw`
@layer sosb-editor {
/* ============================================================
 * 1. Design tokens
 * ============================================================ */
:root {
  --font-ui: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas,
    "Liberation Mono", monospace;

  /* Ground */
  --paper:         #f6f7f9;
  --paper-raised:  #ffffff;
  --paper-sunken:  #eef0f3;
  --paper-deep:    #e3e7ec;

  /* Ink */
  --ink:    #10161f;
  --ink-2:  #3c4655;
  --ink-3:  #6a7381;
  --ink-4:  #98a0ac;

  /* Rules */
  --rule:       #e4e7eb;
  --rule-soft:  #eff1f4;
  --rule-strong: #ccd2da;

  /* Accent (teal) */
  --accent:        #0f766e;
  --accent-strong: #0b5f59;
  --accent-soft:   #e6f2f0;
  --accent-ring:   rgba(15, 118, 110, 0.22);

  /* Severity */
  --error:      #b42318;
  --error-soft: #fee4e2;
  --warn:       #92400e;
  --warn-soft:  #fef0c7;
  --info:       #175cd3;
  --info-soft:  #dbe9ff;
  --ok:         #067647;
  --ok-soft:    #d6f5e3;

  /* Type scale — 11 · 12 · 13 · 14 · 16 · 20 · 26 · 32 (issue #102).
   * Eight steps, no in-between sizes: a heading that is not on the scale
   * reads as a mistake rather than as emphasis. */
  --step--3: 0.6875rem;  /* 11px */
  --step--2: 0.75rem;    /* 12px */
  --step--1: 0.8125rem;  /* 13px */
  --step-0:  0.875rem;   /* 14px */
  --step-1:  1rem;       /* 16px */
  --step-2:  1.25rem;    /* 20px */
  --step-3:  1.625rem;   /* 26px */
  --step-4:  2rem;       /* 32px */
  --step-5:  2rem;       /* 32px — the scale tops out here */

  /* Line heights */
  --lh-tight: 1.2;
  --lh-snug:  1.35;
  --lh-body:  1.55;

  /* Spacing — 4 · 8 · 12 · 16 · 24 · 32 · 48 */
  --sp-0: 0.25rem;
  --sp-1: 0.5rem;
  --sp-2: 0.75rem;
  --sp-3: 1rem;
  --sp-4: 1.5rem;
  --sp-5: 2rem;
  --sp-6: 3rem;

  /* Shape + motion */
  --r-sm: 6px;
  --r-md: 8px;   /* control radius */
  --r-lg: 12px;  /* card radius */
  --r-pill: 999px;
  --shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.05);
  --shadow-md: 0 2px 8px rgba(16, 24, 40, 0.07);
  --shadow-lg: 0 24px 56px rgba(16, 24, 40, 0.24);
  --shadow-pop: 0 8px 24px rgba(16, 24, 40, 0.12);
  --topbar-h: 56px;
  --panebar-h: 44px;
  --footer-h: 44px;
  --nav-w: 216px;
  --edit-w: 420px;
  --transition: 140ms ease;
  --control-h: 36px;
  --control-h-sm: 28px;
}

/* ============================================================
 * 2. Document reset (limited — only what we own)
 * ============================================================ */
html, body, #root {
  margin: 0;
  padding: 0;
  min-height: 100%;
}
body {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-ui);
  font-size: var(--step-0);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
[data-testid="editor-app"] *,
[data-testid="editor-app"] *::before,
[data-testid="editor-app"] *::after {
  box-sizing: border-box;
}
[data-testid="editor-app"] h1,
[data-testid="editor-app"] h2,
[data-testid="editor-app"] h3,
[data-testid="editor-app"] h4 {
  font-family: var(--font-ui);
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.25;
  margin: 0;
  color: var(--ink);
}
[data-testid="editor-app"] p {
  margin: 0;
}
[data-testid="editor-app"] .icon {
  flex: 0 0 auto;
  display: inline-block;
  vertical-align: middle;
}

/* ============================================================
 * 3. Root grid: topbar / content / footer
 * ============================================================ */
[data-testid="editor-app"] {
  display: grid;
  grid-template-rows: var(--topbar-h) minmax(0, 1fr);
  height: 100vh;
  height: 100dvh;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-ui);
}

/* ============================================================
 * 4. Buttons — base + variants
 *
 * The base chrome applies to plain <button>s only. Anything rendered by
 * @sosb/ui carries data-sosb-ui and is styled by its own variant classes
 * (issue #102: the shared controls win), so it is excluded here rather than
 * re-skinned and then fought over.
 * ============================================================ */
[data-testid="editor-app"] button:not([data-sosb-ui]) {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 6px 12px;
  font: inherit;
  font-size: var(--step--1);
  font-weight: 500;
  line-height: 1.2;
  color: var(--ink-2);
  background: var(--paper-raised);
  border: 1px solid var(--rule-strong);
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  white-space: nowrap;
  transition:
    background var(--transition),
    border-color var(--transition),
    color var(--transition),
    box-shadow var(--transition);
}
[data-testid="editor-app"] button:not([data-sosb-ui]):hover:not(:disabled):not([disabled]) {
  background: var(--paper);
  border-color: var(--ink-4);
  color: var(--ink);
}
[data-testid="editor-app"] button:not([data-sosb-ui]):active:not(:disabled):not([disabled]) {
  background: var(--paper-sunken);
}
[data-testid="editor-app"] button:not([data-sosb-ui]):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
[data-testid="editor-app"] button:not([data-sosb-ui]):disabled,
[data-testid="editor-app"] button:not([data-sosb-ui])[disabled] {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

/* Primary — the one teal action in a given area */
[data-testid="editor-app"] button[data-variant="primary"] {
  background: var(--accent);
  border-color: var(--accent);
  color: #ffffff;
  font-weight: 600;
}
[data-testid="editor-app"] button[data-variant="primary"]:hover:not(:disabled):not([disabled]) {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  color: #ffffff;
}
[data-testid="editor-app"] button[data-variant="primary"]:active:not(:disabled) {
  background: var(--accent-strong);
}

/* Secondary — quiet, for "add item" inside forms */
[data-testid="editor-app"] button[data-variant="secondary"] {
  background: var(--accent-soft);
  border-color: transparent;
  color: var(--accent-strong);
  box-shadow: none;
}
[data-testid="editor-app"] button[data-variant="secondary"]:hover:not(:disabled) {
  background: #d3ebe6;
  border-color: transparent;
  color: var(--accent-strong);
}

/* Icon-only — square, no text */
[data-testid="editor-app"] button[data-icon-button] {
  width: 32px;
  min-width: 32px;
  height: 32px;
  min-height: 32px;
  padding: 0;
  color: var(--ink-3);
}
[data-testid="editor-app"] button[data-icon-button]:hover:not(:disabled) {
  color: var(--ink);
}

/* Danger — remove/delete, only turns red on hover so rows stay calm */
[data-testid="editor-app"] button[data-tone="danger"]:hover:not(:disabled),
[data-testid="editor-app"] button[data-tone="danger"][data-confirming="true"] {
  background: var(--error-soft);
  border-color: #f4b6b0;
  color: var(--error);
}
[data-testid="editor-app"] button[data-tone="danger"][data-confirming="true"] {
  background: var(--error);
  border-color: var(--error);
  color: #ffffff;
  font-weight: 600;
}

/* Button groups (undo/redo) */
[data-testid="editor-app"] [data-button-group] {
  display: inline-flex;
}
[data-testid="editor-app"] [data-button-group] > button:not(:first-child) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  margin-left: -1px;
}
[data-testid="editor-app"] [data-button-group] > button:not(:last-child) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

/* ============================================================
 * 5. Top bar
 * ============================================================ */
[data-testid="top-bar"] {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 0 var(--sp-4);
  background: var(--paper-raised);
  border-bottom: 1px solid var(--rule);
  position: relative;
  z-index: 10;
  min-width: 0;
}
[data-testid="top-bar"] [data-brand] {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-right: auto;
  flex: 0 0 auto;
  min-width: 0;
}
[data-testid="top-bar"] [data-brand-mark] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--accent);
  color: #ffffff;
  flex: 0 0 auto;
}
[data-testid="top-bar"] [data-brand-name] {
  font-size: var(--step-1);
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--ink);
  white-space: nowrap;
}
[data-testid="save-status"] {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  margin: 0;
  min-width: 0;
  color: var(--ink-3);
  font-size: var(--step--2);
  line-height: var(--lh-snug);
  text-align: right;
  white-space: nowrap;
}
[data-save-status-text] {
  font-weight: 600;
  color: var(--ink-2);
}
[data-testid="save-status"][data-status="saving"] [data-save-status-text] {
  color: var(--info);
}
[data-testid="save-status"][data-status="localOnly"] [data-save-status-text] {
  color: var(--warn);
}
[data-testid="save-status"][data-status="error"] [data-save-status-text] {
  color: var(--error);
}
[data-save-status-secondary] {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-0);
  font-size: var(--step--3);
  color: var(--ink-3);
}
[data-testid="top-bar"] [data-topbar-actions] {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  flex: 0 0 auto;
}

/* ============================================================
 * 7. Panes
 * ============================================================ */
[data-testid="editor-pane"] {
  min-height: 0;
  overflow-y: auto;
  padding: var(--sp-4) var(--sp-4) var(--sp-6);
  background: var(--paper);
  border-right: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  scrollbar-gutter: stable;
}
[data-testid="preview-pane"] {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  background:
    radial-gradient(circle at 1px 1px, var(--paper-deep) 1px, transparent 1.5px) 0 0 / 18px 18px,
    var(--paper-sunken);
}
[data-testid="preview-canvas"] {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  place-items: start center;
  overflow: auto;
  padding: var(--sp-2);
}
/* The sizer holds the frame's on-screen (scaled) footprint so the canvas
 * centres and scrolls around what is visible. In "fit" it is a plain
 * full-size wrapper. */
[data-testid="preview-frame-sizer"] {
  flex: 0 0 auto;
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
}
/* Device presets lay the frame out at its TRUE viewport size and scale it to
 * fit the pane. The page inside therefore still resolves its media queries
 * and clamp() type scale against 1440 / 768 / 390 CSS pixels — which is the
 * whole point of a device preset. The previous rules sized the frame in real
 * pixels with no transform, so a 1440px desktop frame simply overflowed the
 * pane on any normal laptop and showed a clipped page. */
[data-testid="preview-frame-shell"] {
  flex: 0 0 auto;
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: white;
  border: 1px solid var(--rule-strong);
  border-radius: var(--r-md);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  transform-origin: top left;
}
[data-testid="preview-frame-shell"][data-preview-viewport="phone"] {
  border-radius: 24px;
  border-width: 6px;
  border-color: var(--ink);
}
[data-testid="preview-frame-shell"] iframe {
  flex: 1 1 auto;
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 0;
  border: 0;
  background: white;
}

/* ============================================================
 * 8. Editor pane: section headings, cards, tips
 * ============================================================ */
[data-testid="editor-pane"] section > header,
[data-testid="block-list"] > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-3);
  margin-bottom: var(--sp-2);
}
[data-testid="editor-pane"] [data-section-heading] {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
[data-testid="editor-pane"] [data-section-heading] > h2,
[data-testid="editor-pane"] [data-section-heading] > h3 {
  font-size: var(--step-1);
  font-weight: 700;
}
[data-testid="editor-pane"] [data-section-hint] {
  font-size: var(--step--1);
  color: var(--ink-3);
  line-height: 1.4;
}

[data-testid="getting-started-tip"] {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--sp-2);
  align-items: start;
  padding: var(--sp-3);
  border-radius: var(--r-md);
  background: var(--accent-soft);
  border: 1px solid #c9e6e0;
  color: var(--ink-2);
}
[data-testid="getting-started-tip"] [data-tip-icon] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #ffffff;
  color: var(--accent);
}
[data-testid="getting-started-tip"] [data-tip-body] {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--step--1);
  line-height: 1.5;
}
[data-testid="getting-started-tip"] [data-tip-body] strong {
  color: var(--ink);
  font-size: var(--step-0);
}
[data-testid="getting-started-tip"] b {
  font-weight: 600;
  color: var(--accent-strong);
}
[data-testid="editor-app"] [data-testid="getting-started-tip"] button {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}

/* ============================================================
 * 9. Pages list
 * ============================================================ */
[data-testid="pages-list"] {
  display: flex;
  flex-direction: column;
}
[data-testid="pages-list-items"] {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
[data-testid="pages-list-language-group"] {
  margin-top: var(--sp-2);
}
[data-testid="pages-list-language-group"] > h4 {
  font-size: var(--step--2);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-3);
  margin: 0 0 var(--sp-1);
}
[data-testid="pages-list-item"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-1);
  padding: 6px 8px 6px 12px;
  background: var(--paper-raised);
  border: 1px solid var(--rule);
  border-radius: var(--r-md);
  position: relative;
  transition: border-color var(--transition), background var(--transition);
}
[data-testid="pages-list-item"]:hover {
  border-color: var(--rule-strong);
}
[data-testid="pages-list-item"][data-active="true"] {
  background: var(--accent-soft);
  border-color: #b9ddd6;
}
[data-testid="pages-list-item"][data-active="true"]::before {
  content: "";
  position: absolute;
  left: -1px;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 3px;
  background: var(--accent);
}
[data-testid="editor-app"] [data-testid="pages-list-item"] > button[data-action="select"] {
  flex: 1 1 140px;
  min-width: 0;
  min-height: 36px;
  background: transparent;
  border: 0;
  box-shadow: none;
  padding: 2px 0;
  color: inherit;
  text-align: left;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 1px;
  white-space: normal;
}
[data-testid="editor-app"] [data-testid="pages-list-item"] > button[data-action="select"]:hover {
  background: transparent;
  border-color: transparent;
}
[data-testid="pages-list-item"] [data-field="navLabel"] {
  font-size: var(--step-0);
  font-weight: 600;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
[data-testid="pages-list-item"][data-active="true"] [data-field="navLabel"] {
  color: var(--accent-strong);
}
[data-testid="pages-list-item"] [data-page-meta] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
[data-testid="pages-list-item"] [data-field="slug"] {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  color: var(--ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
[data-testid="pages-list-item"] [data-field="lang"],
[data-testid="pages-list-item"] [data-page-hidden] {
  font-size: 10px;
  font-weight: 700;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 1px 6px;
  border: 1px solid var(--rule-strong);
  border-radius: 999px;
  background: var(--paper-raised);
  line-height: 1.5;
}
[data-testid="pages-list-item"] [data-page-hidden] {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
}
[data-testid="editor-app"] [data-row-actions] {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
  margin-left: auto;
}
[data-testid="editor-app"] [data-row-actions] > button {
  box-shadow: none;
  border-color: transparent;
  background: transparent;
}
[data-testid="editor-app"] [data-row-actions] > button:hover:not(:disabled) {
  background: var(--paper-sunken);
  border-color: transparent;
}
[data-testid="editor-app"] [data-row-actions] > button[data-confirming="true"] {
  width: auto;
  padding: 0 10px;
}
[data-testid="pages-list-item"] [data-testid="missing-translation-indicator"] {
  flex-basis: 100%;
  font-size: var(--step--2);
  color: var(--warn);
  padding: 2px 0 0;
}
[data-testid="editor-app"] [data-testid="pages-list-item"] > button[data-action="add-language-version"] {
  min-height: 28px;
  padding: 2px 10px;
  font-size: var(--step--2);
}
[data-testid="pages-list-add"] {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px var(--sp-1);
  align-items: end;
  margin-top: var(--sp-2);
  padding: var(--sp-2);
  border: 1px dashed var(--rule-strong);
  border-radius: var(--r-md);
  background: transparent;
}
[data-testid="pages-list-add"] label {
  min-width: 0;
}
[data-testid="pages-list-add"] [data-form-help],
[data-testid="pages-list-add"] [role="alert"] {
  grid-column: 1 / -1;
  font-size: var(--step--2);
  color: var(--ink-3);
  margin: 0;
  line-height: 1.4;
}
[data-testid="pages-list-add"] [role="alert"] {
  color: var(--error);
  font-weight: 500;
}

/* ============================================================
 * 10. Block list
 * ============================================================ */
[data-testid="block-list"] {
  display: flex;
  flex-direction: column;
}
[data-testid="block-list-ol"] {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
[data-testid="block-row"] {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  column-gap: 6px;
  align-items: center;
  padding: 6px 8px 6px 6px;
  background: var(--paper-raised);
  border: 1px solid var(--rule);
  border-radius: var(--r-md);
  transition: border-color var(--transition), box-shadow var(--transition), background var(--transition);
}
[data-testid="block-row"]:hover {
  border-color: var(--rule-strong);
  box-shadow: var(--shadow-sm);
}
[data-testid="block-row"][data-drop-target="true"] {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
}
[data-testid="block-drag-handle"] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 32px;
  border-radius: var(--r-sm);
  cursor: grab;
  user-select: none;
  color: var(--ink-4);
  transition: color var(--transition), background var(--transition);
}
[data-testid="block-drag-handle"]:hover,
[data-testid="block-drag-handle"]:focus-visible {
  color: var(--ink-2);
  background: var(--paper-sunken);
}
[data-testid="block-drag-handle"]:active {
  cursor: grabbing;
  color: var(--accent);
}
[data-testid="block-row"] [data-block-position] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--paper-sunken);
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
[data-testid="editor-app"] [data-testid="block-row"] > [data-testid="block-row-select"],
[data-testid="block-row"] > [data-block-row-text] {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 1px;
  min-width: 0;
  min-height: 36px;
  padding: 2px 6px;
  background: transparent;
  border: 0;
  box-shadow: none;
  border-radius: var(--r-sm);
  text-align: left;
  color: inherit;
  white-space: normal;
}
[data-testid="editor-app"] [data-testid="block-row"] > [data-testid="block-row-select"]:hover {
  background: transparent;
  border-color: transparent;
}
[data-testid="block-row-label"] {
  font-size: var(--step-0);
  font-weight: 600;
  color: var(--ink);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
[data-testid="block-row-label"][data-eyebrow="true"] {
  font-size: 11px;
  font-weight: 600;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
[data-testid="block-row-title"] {
  font-size: var(--step-0);
  font-weight: 600;
  color: var(--ink);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
[data-testid="block-row-label"]:not([data-eyebrow="true"]) + [data-testid="block-row-title"] {
  display: none;
}
[data-testid="block-row"] > [data-testid="block-row-select"]:hover [data-testid="block-row-title"],
[data-testid="block-row"] > [data-testid="block-row-select"]:hover [data-testid="block-row-label"]:not([data-eyebrow="true"]) {
  color: var(--accent-strong);
}
[data-testid="block-list-empty"] {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-2);
  padding: var(--sp-4);
  margin-bottom: 6px;
  border: 1px dashed var(--rule-strong);
  border-radius: var(--r-md);
  background: var(--paper-raised);
  color: var(--ink-2);
  font-size: var(--step--1);
  line-height: 1.5;
}
[data-testid="block-list-empty"] strong {
  color: var(--ink);
}

/* ============================================================
 * 11. Inspector chrome
 * ============================================================ */

[data-testid="editor-pane"] [data-testid="inspector"] {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
[data-testid="editor-app"] [data-testid="drill-back"] {
  align-self: flex-start;
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  padding: 4px 8px 4px 4px;
  margin-left: -4px;
  color: var(--ink-2);
  font-weight: 600;
}
[data-testid="editor-app"] [data-testid="drill-back"]:hover {
  background: var(--paper-sunken);
  border-color: transparent;
  color: var(--accent-strong);
}
[data-testid="editor-app"] [data-testid="drill-back"] .icon {
  color: var(--accent);
}
[data-testid="editor-pane"] [data-testid="inspector-header"] {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: var(--sp-2);
  border-bottom: 1px solid var(--rule);
}
[data-testid="editor-pane"] [data-testid="inspector-eyebrow"] {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
[data-testid="editor-pane"] [data-testid="inspector-header"] h2 {
  font-size: var(--step-3);
  font-weight: 700;
  letter-spacing: -0.015em;
  overflow-wrap: anywhere;
}
[data-testid="editor-pane"] [data-inspector-lead] {
  font-size: var(--step--1);
  color: var(--ink-3);
  line-height: 1.5;
}
[data-testid="inspector-unknown-type"] {
  padding: var(--sp-3);
  border-radius: var(--r-md);
  background: var(--warn-soft);
  color: var(--warn);
  font-size: var(--step--1);
}

/* ============================================================
 * 12. Forms — fieldsets, labels, inputs
 * ============================================================ */
[data-testid="spine-form"],
[data-testid="block-form"],
[data-testid="theme-form"],
[data-block-form="customHTML"] {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  margin: 0;
  min-width: 0;
}
[data-testid="editor-pane"] fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
[data-testid="editor-pane"] fieldset > legend {
  font-size: var(--step-0);
  font-weight: 600;
  color: var(--ink);
  padding: 0;
  margin: 0 0 6px;
  float: left; /* lets the flex gap apply after the legend */
  width: 100%;
}
[data-testid="editor-pane"] fieldset[data-kind="object"],
[data-testid="editor-pane"] fieldset[data-kind="lat-lng"],
[data-testid="editor-pane"] fieldset[data-kind="language-list"] {
  padding: var(--sp-3);
  background: var(--paper-raised);
  border: 1px solid var(--rule);
  border-radius: var(--r-md);
}
[data-testid="editor-pane"] fieldset[data-kind="array"] {
  padding: var(--sp-3);
  background: var(--paper-raised);
  border: 1px solid var(--rule);
  border-radius: var(--r-md);
}
[data-testid="editor-pane"] fieldset[data-kind="array"] > ol {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
[data-testid="editor-pane"] fieldset[data-kind="array"] > ol > li {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-2) var(--sp-1);
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: var(--r-sm);
}
/* Nested object inside an array item: drop the extra card chrome */
[data-testid="editor-pane"] fieldset[data-kind="array"] > ol > li > fieldset[data-kind="object"] {
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
}
[data-testid="editor-pane"] fieldset[data-kind="array"] > ol > li > fieldset[data-kind="object"] > legend {
  display: none;
}
[data-testid="editor-pane"] [data-array-empty],
[data-testid="editor-pane"] [data-testid="array-summary"] {
  font-size: var(--step--1);
  color: var(--ink-4);
  font-style: italic;
  margin: 0;
}
[data-testid="editor-app"] fieldset[data-kind="array"] > button[data-action="add"] {
  align-self: flex-start;
}
.block-form__item-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  padding-top: var(--sp-1);
  border-top: 1px solid var(--rule-soft);
}
.block-form__item-index {
  margin-right: auto;
  font-size: var(--step--2);
  color: var(--ink-4);
  font-variant-numeric: tabular-nums;
}
[data-testid="editor-app"] .block-form__item-controls > button {
  box-shadow: none;
  border-color: transparent;
  background: transparent;
  min-height: 30px;
}
[data-testid="editor-app"] .block-form__item-controls > button:hover:not(:disabled) {
  background: var(--paper-sunken);
  border-color: transparent;
}
[data-testid="editor-app"] .block-form__item-controls > button[data-tone="danger"] {
  font-size: var(--step--2);
  padding: 0 8px;
}

[data-testid="editor-pane"] label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  font-size: var(--step--1);
}
[data-testid="editor-pane"] label[data-field-label] > span:first-child,
[data-testid="editor-pane"] [data-picker-label],
[data-testid="editor-pane"] [data-picker-field-label],
[data-testid="editor-pane"] [data-color-picker-label],
[data-testid="editor-pane"] [data-testid="pages-list-add"] label > span,
[data-testid="editor-pane"] [data-testid="locale-toggle"] label > span {
  font-size: var(--step--1);
  font-weight: 600;
  color: var(--ink-2);
  line-height: 1.3;
}
[data-testid="editor-pane"] [data-picker-slot] {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
[data-testid="editor-pane"] .field-hint {
  margin: 0;
  font-size: var(--step--2);
  font-weight: 400;
  color: var(--ink-3);
  line-height: 1.45;
}

/* --- Rich-text editor (ADR 0048/0049) ------------------------------------
 *
 * Chrome for the Tiptap surface. Deliberately NOT a preview of the public
 * site: the Theme owns how prose looks when published, and dressing the
 * editing surface up as the finished page would promise a fidelity the
 * builder does not have. What it does promise is legible structure —
 * headings look like headings, lists like lists — so the author can see what
 * they are marking up.
 */
[data-testid="editor-pane"] [data-testid="rich-text-field"] {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
[data-testid="editor-pane"] .rich-text-toolbar {
  border: 1px solid var(--line-2);
  border-radius: var(--radius-2) var(--radius-2) 0 0;
  border-bottom: 0;
  background: var(--surface-2);
}
[data-testid="editor-pane"] .rich-text-editing {
  min-height: 12rem;
  padding: 10px 12px;
  border: 1px solid var(--line-2);
  border-radius: 0 0 var(--radius-2) var(--radius-2);
  background: var(--surface-1);
  overflow-wrap: anywhere;
}
[data-testid="editor-pane"] .rich-text-editing:focus-visible {
  outline: 2px solid var(--accent-1);
  outline-offset: -1px;
}
[data-testid="editor-pane"] .rich-text-editing > * {
  margin: 0 0 0.65em 0;
}
[data-testid="editor-pane"] .rich-text-editing > *:last-child {
  margin-bottom: 0;
}
[data-testid="editor-pane"] .rich-text-editing :is(h2, h3, h4) {
  font-weight: 650;
  line-height: 1.25;
}
[data-testid="editor-pane"] .rich-text-editing h2 {
  font-size: var(--step-1);
}
[data-testid="editor-pane"] .rich-text-editing h3 {
  font-size: var(--step-0);
}
[data-testid="editor-pane"] .rich-text-editing h4 {
  font-size: var(--step--1);
}
[data-testid="editor-pane"] .rich-text-editing :is(ul, ol) {
  padding-left: 1.4em;
}
[data-testid="editor-pane"] .rich-text-editing blockquote {
  padding-left: 0.8em;
  border-left: 3px solid var(--line-2);
  color: var(--ink-2);
}
[data-testid="editor-pane"] .rich-text-editing code {
  padding: 0 0.25em;
  border-radius: var(--radius-1);
  background: var(--surface-2);
}
/* An internal link has no meaningful href while editing (the Renderer
 * resolves it), so the cue that it *is* a link has to come from styling. */
[data-testid="editor-pane"] .rich-text-editing a {
  color: var(--accent-1);
  text-decoration: underline;
}
[data-testid="editor-pane"] .rich-text-editing a[data-link-kind="page"],
[data-testid="editor-pane"] .rich-text-editing a[data-link-kind="article"] {
  text-decoration-style: dashed;
}
[data-testid="editor-pane"] .rich-text-editing figure {
  margin: 0 0 0.65em 0;
}
[data-testid="editor-pane"] .rich-text-editing figure img {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-1);
}
[data-testid="editor-pane"] .rich-text-editing figcaption {
  margin-top: 4px;
  font-size: var(--step--2);
  color: var(--ink-3);
}
[data-testid="editor-pane"] .rich-text-editing .ProseMirror-selectednode {
  outline: 2px solid var(--accent-1);
}
[data-testid="editor-pane"] [data-testid="rich-text-unsupported"] {
  padding: 12px;
  border: 1px solid var(--line-2);
  border-radius: var(--radius-2);
  background: var(--surface-2);
}
[data-testid="editor-pane"] [data-testid="rich-text-unsupported-types"] {
  font-family: ui-monospace, monospace;
  font-size: var(--step--2);
  color: var(--ink-3);
}

[data-testid="editor-pane"] input[type="text"],
[data-testid="editor-pane"] input[type="number"],
[data-testid="editor-pane"] input[type="search"],
[data-testid="editor-pane"] input[type="email"],
[data-testid="editor-pane"] input[type="url"],
[data-testid="editor-pane"] input[type="tel"],
[data-testid="editor-pane"] textarea,
[data-testid="editor-pane"] select {
  appearance: none;
  width: 100%;
  min-width: 0;
  min-height: var(--control-h);
  padding: 8px 12px;
  font: inherit;
  font-size: var(--step-0);
  line-height: 1.4;
  color: var(--ink);
  background: var(--paper-raised);
  border: 1px solid var(--rule-strong);
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-sm);
  transition: border-color var(--transition), box-shadow var(--transition);
}
[data-testid="editor-pane"] textarea {
  resize: vertical;
  min-height: 84px;
  font-family: var(--font-ui);
}
[data-block-form="customHTML"] textarea {
  font-family: var(--font-mono);
  font-size: var(--step--1);
  min-height: 160px;
}
[data-testid="editor-pane"] input:focus,
[data-testid="editor-pane"] textarea:focus,
[data-testid="editor-pane"] select:focus {
  outline: 0;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
}
[data-testid="editor-pane"] input::placeholder,
[data-testid="editor-pane"] textarea::placeholder {
  color: var(--ink-4);
}
[data-testid="editor-pane"] select {
  background-image:
    linear-gradient(45deg, transparent 50%, var(--ink-3) 50%),
    linear-gradient(135deg, var(--ink-3) 50%, transparent 50%);
  background-position:
    calc(100% - 17px) 50%,
    calc(100% - 12px) 50%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 34px;
  cursor: pointer;
}
[data-testid="editor-pane"] input[type="checkbox"],
[data-testid="editor-pane"] input[type="radio"] {
  width: 18px;
  height: 18px;
  margin: 0;
  flex: 0 0 auto;
  accent-color: var(--accent);
  cursor: pointer;
}
[data-testid="editor-pane"] label:has(> input[type="checkbox"]) {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
  padding: 8px 0;
}
[data-testid="editor-pane"] label:has(> input[type="checkbox"]) > span {
  text-transform: none;
  letter-spacing: 0;
  font-size: var(--step-0);
  font-weight: 500;
  color: var(--ink);
}
[data-testid="editor-pane"] label:has(> input[type="checkbox"]) > .field-hint {
  flex-basis: 100%;
  margin-left: calc(18px + var(--sp-2));
}

/* Choice grid (language checklist) */
[data-testid="editor-pane"] [data-choice-grid] {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 6px;
}
[data-testid="editor-pane"] [data-choice] {
  padding: 6px 10px !important;
  border: 1px solid var(--rule);
  border-radius: var(--r-sm);
  background: var(--paper);
  cursor: pointer;
}
[data-testid="editor-pane"] [data-choice][data-checked="true"] {
  border-color: var(--accent);
  background: var(--accent-soft);
}
[data-testid="editor-pane"] [data-choice] > span {
  font-size: var(--step--1) !important;
}

/* "More options" — collapsible section at the end of each form. Holds
 * the advanced-tier fields so they always appear right under the button. */
[data-testid="editor-pane"] [data-more-options] {
  display: flex;
  flex-direction: column;
  margin-top: var(--sp-1);
  border: 1px dashed var(--rule-strong);
  border-radius: var(--r-md);
  background: transparent;
  overflow: hidden;
}
[data-testid="editor-pane"] [data-more-options][data-open="true"] {
  border-style: solid;
  background: var(--paper-raised);
}
[data-testid="editor-app"] [data-more-options-toggle] {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-2);
  width: 100%;
  min-height: 0;
  padding: 10px 12px;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
  text-align: left;
  white-space: normal;
  cursor: pointer;
}
[data-testid="editor-app"] [data-more-options-toggle]:hover:not(:disabled) {
  background: var(--paper-sunken);
  border-color: transparent;
}
[data-testid="editor-app"] [data-more-options][data-open="true"] > [data-more-options-toggle] {
  border-bottom: 1px solid var(--rule);
}
[data-testid="editor-pane"] [data-more-options-chevron] {
  display: inline-flex;
  flex: 0 0 auto;
  margin-top: 2px;
  color: var(--ink-3);
  transition: transform 120ms ease;
}
[data-testid="editor-pane"] [data-more-options][data-open="true"] [data-more-options-chevron] {
  transform: rotate(90deg);
}
[data-testid="editor-pane"] [data-more-options-text] {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
[data-testid="editor-pane"] [data-more-options-title] {
  font-size: var(--step--1);
  font-weight: 600;
  color: var(--ink-2);
}
[data-testid="editor-pane"] [data-more-options-summary] {
  font-size: var(--step--2);
  line-height: 1.4;
  color: var(--ink-3);
  white-space: normal;
  overflow-wrap: anywhere;
}
[data-testid="editor-pane"] [data-more-options-panel] {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-3);
}
/* Nested cards inside the panel sit on the raised paper already; keep
 * them flat so the panel reads as one group. */
[data-testid="editor-pane"] [data-more-options-panel] > fieldset[data-kind="object"] {
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
}
[data-testid="editor-pane"] [data-more-options-panel] > fieldset[data-kind="object"] > legend {
  font-size: var(--step--1);
  color: var(--ink-2);
  padding-top: var(--sp-1);
  border-top: 1px solid var(--rule-soft);
}

/* Custom HTML block — expert marker + danger notice */
[data-testid="custom-html-advanced-marker"] {
  display: inline-block;
  margin-left: 8px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--warn-soft);
  color: var(--warn);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  vertical-align: middle;
}
[data-testid="custom-html-explainer"] {
  font-size: var(--step--1);
  color: var(--ink-3);
  line-height: 1.5;
}
[data-testid="custom-html-danger"] {
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-sm);
  background: var(--error-soft);
  color: var(--error);
  font-size: var(--step--1);
  font-weight: 500;
  line-height: 1.45;
}

/* ============================================================
 * 13. Upload pickers
 * ============================================================ */
[data-testid="asset-picker"],
[data-testid="document-picker"] {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-2);
  padding: var(--sp-2);
  border: 1px dashed var(--rule-strong);
  border-radius: var(--r-md);
  background: var(--paper-raised);
}
[data-testid="asset-picker"] > [data-testid="asset-picker-thumbnail"] + button,
[data-testid="asset-picker"] > button + button {
  margin-left: 0;
}
[data-testid="asset-picker"]:has([data-testid="asset-picker-thumbnail"]) {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-auto-rows: auto;
  align-items: start;
  column-gap: var(--sp-3);
  row-gap: 6px;
  border-style: solid;
}
[data-testid="asset-picker-thumbnail"] {
  grid-column: 1;
  grid-row: 1 / span 3;
  display: block;
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: var(--r-sm);
  border: 1px solid var(--rule);
  background: var(--paper-sunken);
}
[data-testid="asset-picker"]:has([data-testid="asset-picker-thumbnail"]) > button {
  grid-column: 2;
  justify-self: start;
}
[data-testid="editor-app"] [data-testid="asset-picker-add"],
[data-testid="editor-app"] [data-testid="document-picker-add"] {
  align-self: stretch;
  min-height: 44px;
  border-style: dashed;
  border-color: var(--rule-strong);
  background: var(--paper);
  color: var(--ink-2);
  font-weight: 600;
}
[data-testid="editor-app"] [data-testid="asset-picker-add"]::before,
[data-testid="editor-app"] [data-testid="document-picker-add"]::before {
  content: "+";
  font-size: var(--step-2);
  font-weight: 500;
  color: var(--accent);
  margin-right: 4px;
}
[data-testid="asset-picker-uploading"],
[data-testid="document-picker-uploading"],
[data-testid="asset-picker-error"],
[data-testid="document-picker-error"] {
  grid-column: 1 / -1;
  width: 100%;
  margin: 0;
  padding: 8px 12px;
  border-radius: var(--r-sm);
  background: var(--info-soft);
  color: var(--info);
  font-size: var(--step--1);
  font-weight: 500;
}
[data-testid="asset-picker-error"],
[data-testid="document-picker-error"] {
  background: var(--error-soft);
  color: var(--error);
}
[data-testid="asset-picker-missing"],
[data-testid="document-picker-tile"] {
  grid-column: 1 / -1;
  width: 100%;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 2px var(--sp-2);
  align-items: center;
  padding: var(--sp-2);
  border: 1px solid var(--rule);
  border-radius: var(--r-sm);
  background: var(--paper);
}
[data-testid="asset-picker-missing"] > span {
  grid-column: 1 / 3;
  color: var(--error);
  font-size: var(--step--1);
  font-weight: 500;
}
[data-testid="document-picker-icon"] {
  grid-column: 1;
  grid-row: 1 / 4;
  color: var(--ink-3);
}
[data-testid="document-picker-filename"] {
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: var(--ink);
}
[data-testid="document-picker-type"],
[data-testid="document-picker-size"] {
  grid-column: 2;
  color: var(--ink-3);
  font-size: var(--step--2);
}
[data-testid="document-picker-type"] { grid-row: 2; }
[data-testid="document-picker-size"] { grid-row: 3; }
[data-testid="document-picker-replace"] {
  grid-column: 3;
  grid-row: 1 / 4;
}

/* ============================================================
 * 14. Theme form widgets
 * ============================================================ */
[data-testid="theme-form"] > section {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3);
  background: var(--paper-raised);
  border: 1px solid var(--rule);
  border-radius: var(--r-md);
}
[data-testid="theme-form"] > section > h3 {
  font-size: var(--step-0);
  font-weight: 700;
}
[data-testid="theme-form"] [data-group-hint] {
  font-size: var(--step--1);
  color: var(--ink-3);
  line-height: 1.5;
  margin-bottom: 4px;
}
[data-theme-current-unknown] {
  padding: 8px 12px;
  border-radius: var(--r-sm);
  background: var(--warn-soft);
  color: var(--warn);
  font-size: var(--step--1);
}
[data-testid="theme-picker"] {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}
[data-testid="editor-pane"] [data-theme-option] {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0 var(--sp-2);
  align-items: start;
  padding: 10px 12px 12px;
  border: 1px solid var(--rule);
  border-radius: var(--r-md);
  background: var(--paper);
  cursor: pointer;
  transition: border-color var(--transition), background var(--transition), box-shadow var(--transition);
}
[data-testid="editor-pane"] [data-theme-option]:hover {
  border-color: var(--rule-strong);
  background: var(--paper-raised);
}
[data-testid="editor-pane"] [data-theme-option][data-active="true"] {
  border-color: var(--accent);
  background: var(--paper-raised);
  box-shadow: 0 0 0 3px var(--accent-ring);
}
[data-testid="editor-pane"] [data-theme-option] > input[type="radio"] {
  margin-top: 3px;
}
[data-theme-option-body] {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
[data-theme-option-label] {
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--ink);
}
[data-theme-option-description] {
  font-size: var(--step--1);
  color: var(--ink-3);
  line-height: 1.45;
}
[data-theme-option-preview] {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-bottom: 6px;
}
/* Theme miniature: a real render of the theme, scaled down. The frame is laid
 * out at THEME_PREVIEW_VIEWPORT_WIDTH and transform-scaled by the component,
 * so the wrapper clips it to the miniature's on-screen box. Pointer events
 * pass through to the radio that wraps it, so clicking the picture selects
 * the theme. */
[data-theme-mini-preview] {
  display: block;
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid var(--rule);
  background: var(--paper-sunken);
  pointer-events: none;
  flex: 0 0 auto;
}
[data-theme-mini-preview-frame] {
  position: absolute;
  top: 0;
  left: 0;
  border: 0;
  transform-origin: top left;
  pointer-events: none;
}


[data-testid="color-picker"] {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
[data-color-picker-row] {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
[data-color-swatch] {
  position: relative;
  display: inline-flex;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--rule-strong);
  background:
    linear-gradient(45deg, var(--paper-deep) 25%, transparent 25%, transparent 75%, var(--paper-deep) 75%) 0 0 / 10px 10px,
    linear-gradient(45deg, var(--paper-deep) 25%, transparent 25%, transparent 75%, var(--paper-deep) 75%) 5px 5px / 10px 10px,
    #ffffff;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
}
[data-color-swatch] > input[type="color"] {
  position: absolute;
  inset: -8px;
  width: calc(100% + 16px);
  height: calc(100% + 16px);
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  opacity: 0;
}
[data-testid="color-picker"][data-has-value="false"] [data-color-swatch]::after {
  content: "?";
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-weight: 700;
  color: var(--ink-3);
  pointer-events: none;
}
[data-color-picker-value] {
  font-family: var(--font-mono);
  font-size: var(--step--1);
  color: var(--ink-2);
}
[data-testid="editor-pane"] .color-picker__on-color {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--rule);
  border-radius: var(--r-sm);
  font-size: var(--step--1);
  font-weight: 700;
  line-height: 1;
}
[data-testid="editor-pane"] .color-picker__on-color--default {
  background: var(--paper-sunken);
  color: var(--ink-4);
}
[data-testid="color-picker-default-note"] {
  font-size: var(--step--2);
  color: var(--ink-4);
}
[data-testid="editor-app"] [data-testid="color-picker-reset"] {
  min-height: 28px;
  padding: 2px 10px;
  font-size: var(--step--2);
}
[data-picker-field] {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ============================================================
 * 15. Dialogs
 * ============================================================ */
/*
 * Dialog chrome.
 *
 * Since the editor's modals moved onto Base UI (via EditorDialog), the
 * backdrop and the popup are *siblings* in a portal rather than parent and
 * child, so the backdrop no longer centres the dialog — the popup positions
 * itself. The backdrop must also sit strictly below the popup, or it
 * swallows every click inside the dialog.
 */
[data-dialog-backdrop] {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(17, 24, 39, 0.45);
  backdrop-filter: blur(2px);
  animation: sosb-fade-in 120ms ease;
}
@keyframes sosb-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes sosb-pop-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: none; }
}
/*
 * Positioning and centring come from the shared dialog popup in
 * @sosb/ui, which uses Tailwind's 'translate' longhand. Do NOT add a
 * transform: translate(-50%, -50%) here: 'translate' and 'transform'
 * compose, so the dialog would be offset twice and land off-screen.
 * Only the z-index needs stating, so the popup clears the backdrop's
 * unlayered z-index above.
 *
 * Keyed on the popup's own ARIA contract rather than on a list of test ids.
 * The id list was a trap: a new dialog that forgot to join it rendered in
 * document flow *behind* the fixed backdrop, which then swallowed every
 * click on it. Every EditorDialog popup sets aria-modal, so this cannot be
 * forgotten.
 */
[data-dialog-host] [aria-modal="true"],
[data-testid="add-block-dialog"],
[data-testid="export-confirm-dialog"] {
  z-index: 101;
  width: min(760px, calc(100vw - 2 * var(--sp-4)));
  max-height: min(86vh, 800px);
  overflow-y: auto;
  background: var(--paper-raised);
  border: 1px solid var(--rule);
  border-radius: var(--r-lg);
  padding: var(--sp-4) var(--sp-4) var(--sp-4);
  box-shadow: var(--shadow-lg);
  animation: sosb-pop-in 160ms ease;
}
[data-testid="export-confirm-dialog"],
[data-testid="tag-delete-dialog"],
[data-testid="article-delete-dialog"] {
  width: min(600px, 100%);
}
[data-testid="tag-manager-dialog"] h2,
[data-testid="article-delete-dialog"] h2,
[data-testid="tag-delete-dialog"] h2 {
  margin: 0 0 var(--sp-3) 0;
  font-size: var(--step-1, 1.125rem);
}
[data-testid="add-block-dialog"] > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-3);
  margin-bottom: var(--sp-3);
}
[data-testid="add-block-dialog"] > header h2,
[data-testid="export-confirm-dialog"] h2 {
  font-size: var(--step-3);
  font-weight: 700;
  letter-spacing: -0.015em;
}
[data-dialog-lead] {
  margin-top: 4px;
  font-size: var(--step--1);
  color: var(--ink-3);
}
[data-testid="add-block-search-label"] {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: var(--sp-3);
}
[data-testid="add-block-search-label"] > span {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
[data-testid="add-block-search"] {
  appearance: none;
  width: 100%;
  min-height: 42px;
  padding: 8px 14px;
  font: inherit;
  font-size: var(--step-1);
  color: var(--ink);
  background: var(--paper);
  border: 1px solid var(--rule-strong);
  border-radius: var(--r-md);
}
[data-testid="add-block-search"]:focus {
  outline: 0;
  border-color: var(--accent);
  background: #fff;
  box-shadow: 0 0 0 3px var(--accent-ring);
}
[data-testid="add-block-groups"] {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
[data-testid="add-block-group"] > h3 {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  font-size: var(--step--1);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-2);
  margin: 0 0 var(--sp-2);
}
[data-testid="add-block-group"] > h3 > small {
  font-size: var(--step--2);
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--ink-3);
}
[data-testid="add-block-group"][data-category="advanced"] > h3 {
  color: var(--warn);
}
[data-testid="add-block-group"] > ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: var(--sp-2);
}
[data-testid="editor-app"] [data-testid="add-block-entry"] {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  min-height: 84px;
  padding: var(--sp-2) var(--sp-3);
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: var(--r-md);
  box-shadow: none;
  text-align: left;
  white-space: normal;
}
[data-testid="editor-app"] [data-testid="add-block-entry"]:hover {
  background: var(--paper-raised);
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
}
[data-testid="add-block-entry-label"] {
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--ink);
}
[data-testid="add-block-entry-description"] {
  font-size: var(--step--1);
  font-weight: 400;
  color: var(--ink-3);
  line-height: 1.4;
}
[data-testid="add-block-empty"] {
  color: var(--ink-3);
  padding: var(--sp-4);
  text-align: center;
  border: 1px dashed var(--rule-strong);
  border-radius: var(--r-md);
}

[data-testid="export-confirm-dialog"] h2 {
  margin: 0 0 var(--sp-1);
}
[data-testid="export-confirm-dialog"][data-tone="error"] h2 {
  color: var(--error);
}
[data-testid="export-confirm-dialog"] > p {
  font-size: var(--step-0);
  color: var(--ink-2);
  line-height: 1.5;
  margin: 0 0 var(--sp-3);
}
[data-testid="export-confirm-dialog"] [data-issues-group] {
  margin-top: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-md);
  background: var(--paper);
}
[data-testid="export-confirm-dialog"] [data-issues-group="error"] {
  background: var(--error-soft);
}
[data-testid="export-confirm-dialog"] [data-issues-group="warning"] {
  background: var(--warn-soft);
}
[data-testid="export-confirm-dialog"] [data-issues-group] h3 {
  font-size: var(--step--2);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-2);
  margin: 0 0 var(--sp-1);
}
[data-testid="export-confirm-dialog"] [data-issues-group="error"] h3 { color: var(--error); }
[data-testid="export-confirm-dialog"] [data-issues-group="warning"] h3 { color: var(--warn); }
[data-testid="export-confirm-dialog"] [data-issues-group] ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
[data-testid="export-confirm-dialog"] [data-issue] {
  display: flex;
  flex-direction: column;
}
[data-testid="export-confirm-dialog"] [data-issue-message] {
  font-size: var(--step--1);
  color: var(--ink);
}
[data-testid="export-confirm-dialog"] [data-issue-path] {
  font-size: var(--step--2);
  color: var(--ink-3);
}
[data-testid="export-confirm-input-label"] {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: var(--sp-3);
  padding: var(--sp-3);
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: var(--r-md);
  font-size: var(--step--1);
  color: var(--ink-2);
}
[data-testid="export-confirm-input-label"] strong {
  font-family: var(--font-mono);
  font-weight: 700;
  background: var(--ink);
  color: #fff;
  padding: 1px 6px;
  border-radius: 4px;
  letter-spacing: 0.04em;
}
[data-testid="export-confirm-input"] {
  appearance: none;
  width: 100%;
  min-height: var(--control-h);
  padding: 8px 12px;
  font: inherit;
  font-family: var(--font-mono);
  letter-spacing: 0.06em;
  border: 1px solid var(--rule-strong);
  border-radius: var(--r-sm);
}
[data-testid="export-confirm-input"]:focus {
  outline: 0;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
}
[data-testid="export-confirm-actions"] {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-2);
  margin-top: var(--sp-4);
}
[data-testid="editor-app"] [data-testid="export-confirm-button"]:not(:disabled) {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  font-weight: 600;
}
[data-testid="editor-app"] [data-testid="export-confirm-button"]:not(:disabled):hover {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  color: #fff;
}

/* ============================================================
 * 16. Locale toggle
 * ============================================================ */
[data-testid="locale-toggle"] {
  margin-top: auto;
  padding: var(--sp-3) !important;
  background: var(--paper-raised);
  border: 1px solid var(--rule) !important;
  border-radius: var(--r-md);
  gap: 6px !important;
}
[data-testid="locale-toggle"] > legend {
  font-size: var(--step--1) !important;
  font-weight: 700 !important;
  color: var(--ink-2) !important;
}
[data-testid="locale-help"] {
  font-size: var(--step--2);
  color: var(--ink-3);
  line-height: 1.45;
  margin: 0;
}

/* ============================================================
 * 17. Site health panel (bottom sheet)
 * ============================================================ */
[data-testid="site-health-panel"] {
  position: fixed;
  left: 0;
  right: 0;
  bottom: var(--footer-h);
  z-index: 20;
  max-height: 55vh;
  overflow-y: auto;
  background: var(--paper-raised);
  border-top: 1px solid var(--rule);
  padding: var(--sp-4) var(--sp-5) var(--sp-5);
  box-shadow: 0 -16px 40px -20px rgba(17, 24, 39, 0.35);
  animation: sosb-pop-in 160ms ease;
}
[data-testid="site-health-panel"] h2 {
  font-size: var(--step-2);
  font-weight: 700;
  margin: 0 0 var(--sp-1);
}
[data-testid="site-health-panel"] h2::after {
  content: " — things worth checking before you publish";
  font-size: var(--step--1);
  font-weight: 400;
  color: var(--ink-3);
}
[data-testid="site-health-empty"] {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: var(--sp-1) 0 0;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--ok-soft);
  color: var(--ok);
  font-weight: 600;
  font-size: var(--step--1);
}
[data-severity-group] {
  margin-top: var(--sp-3);
}
[data-severity-group] > h3 {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--step--2);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-2);
  margin: 0 0 var(--sp-1);
}
[data-severity-group="error"]   > h3 { color: var(--error); }
[data-severity-group="warning"] > h3 { color: var(--warn); }
[data-severity-group="info"]    > h3 { color: var(--info); }
[data-severity-group] [data-group-count] {
  font-weight: 500;
  color: var(--ink-3);
}
[data-severity-group] [data-empty-group] {
  font-size: var(--step--1);
  color: var(--ink-4);
  margin: 0;
}
[data-severity-group] > ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 6px;
}
[data-testid="editor-app"] button[data-issue] {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  min-height: 0;
  padding: var(--sp-2) var(--sp-3);
  background: var(--paper);
  border: 1px solid var(--rule);
  border-left-width: 4px;
  border-radius: var(--r-sm);
  box-shadow: none;
  text-align: left;
  white-space: normal;
}
[data-testid="editor-app"] button[data-issue]:hover {
  background: var(--paper-raised);
  border-color: var(--rule-strong);
}
[data-testid="editor-app"] button[data-issue][data-severity="error"]   { border-left-color: var(--error); }
[data-testid="editor-app"] button[data-issue][data-severity="warning"] { border-left-color: var(--warn); }
[data-testid="editor-app"] button[data-issue][data-severity="info"]    { border-left-color: var(--info); }
button[data-issue] [data-issue-message] {
  font-size: var(--step--1);
  font-weight: 500;
  color: var(--ink);
  line-height: 1.4;
}
button[data-issue] [data-issue-path] {
  font-size: var(--step--2);
  color: var(--ink-3);
}
button[data-issue] [data-issue-path]::before {
  content: "Go to: ";
  color: var(--accent);
  font-weight: 600;
}

/* ============================================================
 * 18. Health footer
 * ============================================================ */
[data-testid="health-footer"] {
  display: flex;
  align-items: stretch;
  background: var(--paper-raised);
  border-top: 1px solid var(--rule);
  z-index: 30;
}
[data-testid="editor-app"] [data-testid="health-footer-toggle"] {
  flex: 1;
  height: var(--footer-h);
  min-height: 0;
  padding: 0 var(--sp-4);
  justify-content: flex-start;
  gap: var(--sp-3);
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  color: var(--ink-2);
  font-size: var(--step--1);
  text-align: left;
}
[data-testid="editor-app"] [data-testid="health-footer-toggle"]:hover,
[data-testid="editor-app"] [data-testid="health-footer-toggle"][aria-expanded="true"] {
  background: var(--paper);
  border-color: transparent;
}
[data-health-summary] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}
[data-testid="health-footer"][data-tone="ok"] [data-health-summary] {
  color: var(--ok);
}
[data-testid="health-footer"][data-tone="warning"] [data-health-summary] {
  color: var(--warn);
}
[data-testid="health-footer"][data-tone="error"] [data-health-summary] {
  color: var(--error);
}
[data-health-counts] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
[data-health-counts] > span {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: var(--step--2);
  font-weight: 600;
  background: var(--paper-sunken);
  color: var(--ink-3);
}
[data-health-counts] > [data-count="error"][data-zero="false"]   { background: var(--error-soft); color: var(--error); }
[data-health-counts] > [data-count="warning"][data-zero="false"] { background: var(--warn-soft);  color: var(--warn); }
[data-health-counts] > [data-count="info"][data-zero="false"]    { background: var(--info-soft);  color: var(--info); }
[data-health-chevron] {
  margin-left: auto;
  display: inline-flex;
  color: var(--ink-4);
  transition: transform var(--transition);
}
[data-testid="health-footer-toggle"][aria-expanded="true"] [data-health-chevron] {
  transform: rotate(180deg);
}

/* ============================================================
 * 19. Update banner (Electron only)
 * ============================================================ */
[data-testid="update-banner"],
[data-testid="update-banner-error"] {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-4);
  background: var(--info-soft);
  border-bottom: 1px solid #b7d3fb;
  color: var(--ink);
  font-size: var(--step--1);
}
[data-testid="update-banner-error"] {
  background: var(--error-soft);
  border-bottom-color: #f4b6b0;
  color: var(--error);
}
[data-testid="update-banner-message"] {
  flex: 1;
  font-weight: 500;
}

/* ============================================================
 * 20. Selection + focus polish
 * ============================================================ */
[data-testid="editor-app"] ::selection {
  background: var(--accent-soft);
  color: var(--ink);
}
[data-testid="editor-app"] :focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--r-sm);
}

/* ============================================================
 * 21. Reduced motion
 * ============================================================ */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition: none !important;
    animation: none !important;
  }
}

/* ============================================================
 * 22. Narrow viewport adjustments
 * ============================================================ */
@media (max-width: 767px) {
  :root {
    --topbar-h: 52px;
  }
  [data-testid="top-bar"] {
    padding: 0 var(--sp-2);
    gap: var(--sp-1);
  }
  [data-testid="top-bar"] [data-brand-name] {
    display: none;
  }
  [data-testid="top-bar"] [data-topbar-actions] {
    gap: 4px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  [data-testid="top-bar"] [data-topbar-actions] > button,
  [data-testid="top-bar"] [data-topbar-actions] > [data-button-group] > button {
    font-size: var(--step--2);
    padding: 6px 8px;
  }
  [data-testid="editor-pane"] {
    padding: var(--sp-3) var(--sp-3) var(--sp-5);
    gap: var(--sp-3);
    border-right: 0;
  }
  [data-testid="preview-canvas"] {
    padding: var(--sp-1);
  }
  [data-testid="site-health-panel"] {
    padding: var(--sp-3);
  }
  [data-health-counts] > [data-zero="true"] {
    display: none;
  }
  /*
   * Narrow viewports dock the dialog to the bottom of the screen instead of
   * centring it — a thumb reaches the bottom of a phone, not the middle.
   * This used to fall out of the backdrop's grid (align-items: end); now
   * that the popup positions itself, it has to be stated here.
   *
   * translate: none cancels the shared popup's Tailwind centring, which
   * uses the translate longhand. Leaving it in place would drag the sheet
   * half its own height off the bottom of the screen.
   *
   * Keyed on the same aria-modal contract the desktop rule above uses, for
   * two reasons. Every EditorDialog docks on a phone, including the Articles
   * ones, without anyone remembering to join a list. And — the reason this
   * had to change — a media query contributes nothing to specificity, so the
   * old data-testid selector (0,1,0) lost to the desktop
   * [data-dialog-host] [aria-modal="true"] (0,2,0) and the sheet stopped
   * being full-bleed: it rendered at calc(100vw - 2 * var(--sp-4)) instead
   * of reaching both gutters.
   */
  [data-dialog-host] [aria-modal="true"] {
    top: auto;
    bottom: var(--sp-2);
    left: var(--sp-2);
    right: var(--sp-2);
    translate: none;
    max-height: 92vh;
    padding: var(--sp-3);
    width: auto;
  }
}

/* ---------------------------------------------------------------------------
 * Articles (issue #97 / #98)
 *
 * Scoped to the editor root like every other rule in this sheet. The visual
 * register deliberately matches the Pages list: the two are sibling
 * destinations, and looking different would imply they behave differently.
 * ------------------------------------------------------------------------- */

/* Article settings ------------------------------------------------------- */

[data-testid="editor-app"] .article-settings,
[data-testid="editor-app"] .article-list-inspector {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

[data-testid="editor-app"] .article-settings__field,
[data-testid="editor-app"] .article-list-inspector__field {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}

[data-testid="editor-app"] .article-settings__label-row,
[data-testid="editor-app"] .article-list-inspector__label-row,
[data-testid="editor-app"] .tag-picker__heading {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
}

[data-testid="editor-app"] .article-settings__error,
[data-testid="editor-app"] .tag-manager__error {
  margin: 0;
  color: var(--error);
  font-size: var(--step--1);
}

/* The (i) affordance ----------------------------------------------------- */

[data-testid="editor-app"] .info-hint__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* WCAG 2.2 target size: the icon is 14px, the hit area is not. */
  min-width: 24px;
  min-height: 24px;
  border-radius: 999px;
  border: 0;
  background: none;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
}

[data-testid="editor-app"] .info-hint__trigger:hover,
[data-testid="editor-app"] .info-hint__trigger:focus-visible {
  opacity: 1;
  background: var(--paper-sunken);
}

/* Tags ------------------------------------------------------------------- */

[data-testid="editor-app"] .tag-picker {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

[data-testid="editor-app"] .tag-picker__selected,
[data-testid="editor-app"] .tag-picker__options {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-1);
}

[data-testid="editor-app"] .tag-picker__chip,
[data-testid="editor-app"] .tag-picker__option {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  min-height: 24px;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--rule);
  background: var(--paper-raised);
  font: inherit;
  font-size: var(--step--1);
  color: inherit;
  cursor: pointer;
}

[data-testid="editor-app"] .tag-picker__chip {
  background: var(--accent-soft);
  border-color: var(--accent-ring);
}

[data-testid="editor-app"] .tag-manager {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

[data-testid="editor-app"] .tag-manager__create {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

[data-testid="editor-app"] .tag-manager__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}

[data-testid="editor-app"] .tag-manager__list > li {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-2);
  padding: var(--sp-2);
  border: 1px solid var(--rule-soft);
  border-radius: var(--r-md);
}

[data-testid="editor-app"] .tag-manager__label {
  flex: 1;
  font-weight: 600;
}

/* Article-list configuration --------------------------------------------- */

[data-testid="editor-app"] .article-list-inspector__modes {
  border: 1px solid var(--rule-soft);
  border-radius: var(--r-md);
  padding: var(--sp-2);
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}

[data-testid="editor-app"] .article-list-inspector__modes legend {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  padding: 0 var(--sp-1);
  font-weight: 600;
}

[data-testid="editor-app"] .article-list-inspector__mode {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: 24px;
}

[data-testid="editor-app"] .article-list-inspector__candidates,
[data-testid="editor-app"] .article-list-inspector__selected,
[data-testid="editor-app"] .article-list-inspector__preview ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}

[data-testid="editor-app"] .article-list-inspector__selected > li,
[data-testid="editor-app"] .article-list-inspector__preview li {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-1) var(--sp-2);
  border: 1px solid var(--rule-soft);
  border-radius: var(--r-sm);
}

[data-testid="editor-app"] .article-list-inspector__selected-title,
[data-testid="editor-app"] .article-list-inspector__candidate-title,
[data-testid="editor-app"] .article-list-inspector__preview li > span:first-child {
  flex: 1;
  min-width: 6rem;
}

[data-testid="editor-app"] .article-list-inspector__candidate {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  width: 100%;
  min-height: 24px;
  padding: var(--sp-1) var(--sp-2);
  border: 1px dashed var(--rule);
  border-radius: var(--r-sm);
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

[data-testid="editor-app"] .article-list-inspector__meta {
  font-size: var(--step--2);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.75;
}

[data-testid="editor-app"] .article-list-inspector__preview h3 {
  font-size: var(--step--1);
  margin: 0 0 var(--sp-1) 0;
}


/* ============================================================
 * 23. Builder shell (issue #102): navigation, screens, split view
 * ============================================================ */

/* Root: the top bar over a nav + main grid. The health footer is gone —
 * Site Health lives on the Overview and in the export readiness panel. */
[data-builder-body] {
  display: grid;
  grid-template-columns: var(--nav-w) minmax(0, 1fr);
  min-height: 0;
  min-width: 0;
}
[data-builder-main] {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

/* --- Main navigation ------------------------------------------------ */
[data-testid="main-nav"] {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
  padding: var(--sp-2) var(--sp-1);
  background: var(--paper-raised);
  border-right: 1px solid var(--rule);
  overflow-y: auto;
}
[data-nav-drawer-head],
[data-nav-drawer-scrim] {
  display: none;
}
[data-nav-group-label] {
  padding: var(--sp-3) var(--sp-1) var(--sp-0);
  font-size: var(--step--2);
  font-weight: 600;
  color: var(--ink-4);
}
[data-nav-drawer-head] + [data-nav-group-label] {
  padding-top: var(--sp-0);
}
[data-testid="editor-app"] button[data-nav-item] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-1);
  width: 100%;
  min-height: 34px;
  padding: 0 var(--sp-1);
  border: 0;
  border-radius: var(--r-md);
  background: transparent;
  box-shadow: none;
  font-size: var(--step-0);
  font-weight: 500;
  color: var(--ink-2);
  text-align: left;
  white-space: nowrap;
}
[data-testid="editor-app"] button[data-nav-item]:hover:not(:disabled) {
  background: var(--paper-sunken);
  border-color: transparent;
  color: var(--ink);
}
[data-testid="editor-app"] button[data-nav-item][data-active="true"],
[data-testid="editor-app"] button[data-nav-item][data-active="true"]:hover:not(:disabled) {
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 600;
}
[data-nav-language] {
  padding: 0 var(--sp-1);
}

/* --- Screens: Overview, Pages, Articles ----------------------------- */
[data-screen] {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  width: 100%;
  max-width: 1080px;
  padding: var(--sp-4);
}
[data-screen-head] {
  display: flex;
  flex-direction: column;
  gap: var(--sp-0);
}
[data-screen-head] h1 {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-0);
  font-size: var(--step-3);
  letter-spacing: -0.018em;
}
[data-screen-head] h1[data-display] {
  font-size: var(--step-4);
  letter-spacing: -0.024em;
}
[data-screen-search] {
  display: flex;
  flex-direction: column;
  gap: var(--sp-0);
  max-width: 420px;
}
[data-screen-filters] {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--sp-2);
}
[data-screen-filters] > * {
  display: flex;
  flex: 1 1 150px;
  flex-direction: column;
  gap: var(--sp-0);
  min-width: 150px;
}
[data-screen-filters] > [data-screen-search] {
  flex: 2 1 220px;
  max-width: none;
}
[data-overview-grid] {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--sp-3);
  align-items: stretch;
}
[data-card] {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3);
  background: var(--paper-raised);
  border: 1px solid var(--rule);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
}
[data-card] h2,
[data-card] h3 {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-0);
}
[data-card] h2 {
  font-size: var(--step-2);
  letter-spacing: -0.014em;
}
[data-card] h3 {
  font-size: var(--step-1);
}
[data-overview-grid] > [data-card] > [data-row]:last-child {
  margin-top: auto;
}
[data-row] {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-1);
}
[data-row-between] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
[data-testid="editor-app"] [data-muted] {
  color: var(--ink-3);
}
[data-slug-hint] {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  color: var(--ink-3);
}
[data-truncate] {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
[data-testid="editor-app"] p[data-empty-state] {
  margin: 0;
  padding: var(--sp-4);
  border: 1px dashed var(--rule-strong);
  border-radius: var(--r-lg);
  background: var(--paper-raised);
  color: var(--ink-3);
  font-size: var(--step--1);
  text-align: center;
}

/* --- Summary lists: Overview cards, the Articles list --------------- */
[data-summary-list] {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--rule);
  border-radius: var(--r-lg);
  background: var(--paper-raised);
  overflow: hidden;
}
[data-summary-list] > li {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--rule-soft);
}
[data-summary-list] > li:last-child {
  border-bottom: 0;
}
[data-summary-list] > li[data-active="true"] {
  box-shadow: inset 3px 0 0 var(--accent);
}
[data-summary-list] > li > button[data-sosb-ui] {
  flex: 0 0 auto;
  margin-right: var(--sp-1);
}
[data-testid="editor-app"] button[data-summary-row] {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  min-height: 52px;
  padding: var(--sp-2);
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: inherit;
  font-weight: 500;
  text-align: left;
  white-space: normal;
  transition: background var(--transition);
}
[data-testid="editor-app"] button[data-summary-row]:hover:not(:disabled) {
  background: var(--paper-sunken);
  border-color: transparent;
  color: inherit;
}
[data-testid="editor-app"] button[data-summary-row]:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px var(--accent);
}
[data-testid="editor-app"] button[data-summary-row] > .icon:last-child {
  color: var(--ink-4);
}
/* A summary row standing alone (the workspace's settings link) is a card. */
[data-workspace-outline] > button[data-summary-row] {
  border: 1px solid var(--rule);
  border-radius: var(--r-lg);
  background: var(--paper-raised);
  box-shadow: var(--shadow-sm);
}
[data-testid="editor-app"] [data-workspace-outline] > button[data-summary-row]:hover:not(:disabled) {
  border-color: var(--rule-strong);
}
[data-summary-main] {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
[data-summary-title] {
  font-size: var(--step-0);
  font-weight: 600;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
[data-summary-meta] {
  font-size: var(--step--2);
  color: var(--ink-3);
  line-height: var(--lh-snug);
}

/* --- Findings ------------------------------------------------------- */
[data-finding-list] {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}
[data-finding] {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-2);
  padding: var(--sp-2);
  border: 1px solid var(--rule);
  border-left-width: 3px;
  border-radius: var(--r-md);
  background: var(--paper-raised);
}
[data-finding][data-severity="error"]   { border-left-color: var(--error); }
[data-finding][data-severity="warning"] { border-left-color: var(--warn); }
[data-finding][data-severity="info"]    { border-left-color: var(--info); }
[data-finding][data-severity="ok"]      { border-left-color: var(--ok); }
[data-finding-icon] {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  border-radius: var(--r-pill);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}
[data-finding][data-severity="error"] [data-finding-icon]   { background: var(--error-soft); color: var(--error); }
[data-finding][data-severity="warning"] [data-finding-icon] { background: var(--warn-soft);  color: var(--warn); }
[data-finding][data-severity="info"] [data-finding-icon]    { background: var(--info-soft);  color: var(--info); }
[data-finding][data-severity="ok"] [data-finding-icon]      { background: var(--ok-soft);    color: var(--ok); }
[data-finding][data-severity="error"] [data-finding-icon]::before,
[data-finding][data-severity="warning"] [data-finding-icon]::before { content: "!"; }
[data-finding][data-severity="info"] [data-finding-icon]::before    { content: "i"; }
[data-finding][data-severity="ok"] [data-finding-icon]::before      { content: "✓"; }
[data-finding-body] {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: var(--step--1);
  line-height: var(--lh-snug);
}
[data-finding-message] {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-0);
}
[data-finding-message] strong {
  color: var(--ink);
  font-weight: 600;
}
[data-finding-meta] {
  font-size: var(--step--2);
  color: var(--ink-3);
}
[data-finding-empty] {
  margin: 0;
  padding: var(--sp-1) 0;
  font-size: var(--step--1);
  color: var(--ink-3);
}

/* --- Split view: the workspace, Theme, Site settings ---------------- */
[data-split] {
  display: grid;
  grid-template-columns: minmax(360px, var(--edit-w)) minmax(0, 1fr);
  flex: 1 1 auto;
  min-height: 0;
}
[data-split] > [data-testid="editor-pane"] {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
  padding: 0;
  overflow-y: auto;
}
[data-split-preview] {
  display: flex;
  min-width: 0;
  min-height: 0;
}
[data-split-preview] > [data-testid="preview-pane"] {
  flex: 1 1 auto;
  min-width: 0;
}
[data-split-tabs] {
  display: none;
}
[data-split] > [data-hidden="true"] {
  display: none;
}
[data-pane-bar] {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--sp-1);
  min-height: var(--panebar-h);
  padding: var(--sp-1) var(--sp-2);
  background: var(--paper-raised);
  border-bottom: 1px solid var(--rule);
}
[data-testid="preview-pane"] [data-pane-bar] {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(6px);
}
[data-pane-spacer] {
  flex: 1 1 auto;
}
[data-pane-kicker] {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-0);
  font-size: var(--step--2);
  font-weight: 600;
  color: var(--accent);
  white-space: nowrap;
}
[data-preview-title] {
  font-size: var(--step--1);
  font-weight: 500;
  color: var(--ink-2);
}
[data-pane-body] {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-3);
}
[data-pane-body] > [data-screen] {
  max-width: none;
  padding: 0;
}
[data-preview-devices] {
  display: flex;
  flex: 0 0 auto;
  justify-content: center;
  padding: var(--sp-2) var(--sp-2) 0;
}

/* --- Workspace outline and Inspector chrome ------------------------- */
[data-workspace-outline] {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
[data-title-field] {
  display: flex;
  flex-direction: column;
  gap: var(--sp-0);
}
[data-workspace-blocks] {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
[data-testid="editor-pane"] [data-section-heading] > h2 {
  display: flex;
  align-items: center;
  gap: var(--sp-0);
}
[data-toggle] {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  font-size: var(--step--1);
  color: var(--ink-2);
  cursor: pointer;
}
[data-toggle] input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--accent);
}

/* --- The (i) trigger ------------------------------------------------ */
/* A 24px circle (WCAG 2.2 target size) sitting quietly beside its label,
 * rather than the 32px icon-button square the generic chrome would give it. */
[data-testid="editor-app"] button.info-hint__trigger,
[data-dialog-host] button.info-hint__trigger {
  width: 24px;
  height: 24px;
  min-width: 24px;
  min-height: 24px;
  padding: 0;
  border: 1px solid var(--rule-strong);
  border-radius: var(--r-pill);
  background: var(--paper-raised);
  box-shadow: none;
  color: var(--ink-3);
  vertical-align: middle;
}
[data-testid="editor-app"] button.info-hint__trigger:hover:not(:disabled),
[data-testid="editor-app"] button.info-hint__trigger[aria-expanded="true"],
[data-testid="editor-app"] button.info-hint__trigger[data-popup-open] {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-strong);
}
[data-testid="editor-app"] button.info-hint__trigger .icon {
  width: 13px;
  height: 13px;
}

/* --- Top bar additions ---------------------------------------------- */
[data-testid="top-bar"] [data-drawer-button] {
  display: none;
}

/* --- Export readiness panel ----------------------------------------- */
[data-testid="export-readiness"] h2 {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-0);
  margin-bottom: var(--sp-3);
  font-size: var(--step-2);
}
[data-export-group] {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  margin-top: var(--sp-3);
}
[data-export-group] h3 {
  display: flex;
  align-items: center;
  gap: var(--sp-0);
  font-size: var(--step-1);
}
[data-testid="export-blocked-note"] {
  font-size: var(--step--1);
  color: var(--ink-2);
}
[data-testid="export-override-label"] {
  display: flex;
  flex-direction: column;
  gap: var(--sp-0);
  margin-top: var(--sp-3);
  font-size: var(--step--1);
}
[data-export-override-hint] {
  font-size: var(--step--2);
  color: var(--ink-3);
}
[data-dialog-actions] {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-1);
  margin-top: var(--sp-4);
}

/* --- Phone ---------------------------------------------------------- */
@media (max-width: 767px) {
  [data-testid="editor-app"] {
    grid-template-rows: auto minmax(0, 1fr);
  }
  [data-testid="top-bar"] {
    flex-wrap: wrap;
    padding: var(--sp-1) var(--sp-2);
  }
  [data-testid="top-bar"] [data-drawer-button] {
    display: inline-flex;
  }
  [data-testid="save-status"] {
    order: 3;
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-2);
    width: 100%;
    text-align: left;
  }
  [data-builder-body] {
    grid-template-columns: minmax(0, 1fr);
  }
  [data-testid="main-nav"] {
    display: none;
  }
  [data-testid="main-nav"][data-drawer-open="true"] {
    display: flex;
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 70;
    width: min(320px, 84vw);
    padding-top: 0;
    box-shadow: var(--shadow-lg);
  }
  [data-testid="main-nav"][data-drawer-open="true"] [data-nav-drawer-head] {
    position: sticky;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: var(--sp-2) var(--sp-1);
    margin-bottom: var(--sp-0);
    background: var(--paper-raised);
    border-bottom: 1px solid var(--rule);
  }
  [data-nav-drawer-scrim] {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 69;
    background: rgba(16, 22, 31, 0.42);
  }
  [data-screen] {
    gap: var(--sp-3);
    padding: var(--sp-3);
  }
  [data-split] {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }
  [data-split-tabs] {
    display: flex;
    justify-content: center;
    padding: var(--sp-1);
    background: var(--paper-raised);
    border-bottom: 1px solid var(--rule);
  }
  [data-split-tabs] [role="group"] {
    width: 100%;
  }
  [data-split-tabs] [role="group"] > button {
    flex: 1 1 0;
  }
  [data-split] > [data-testid="editor-pane"] {
    padding: 0;
    border-right: 0;
  }
  [data-pane-body] {
    padding: var(--sp-2);
  }
}
}
`;

/**
 * Inject the editor-app stylesheet into the host document, idempotently.
 *
 * Runs as a top-level side effect when this module is first imported, so
 * the styles are present before React renders into `#root`. Guarded for
 * non-DOM evaluation contexts (SSR builds, Node-side tooling).
 */
function injectEditorAppStyle(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ELEMENT_ID) !== null) return;
  const styleEl = document.createElement("style");
  styleEl.id = STYLE_ELEMENT_ID;
  styleEl.textContent = EDITOR_APP_CSS;
  document.head.appendChild(styleEl);
}

injectEditorAppStyle();
