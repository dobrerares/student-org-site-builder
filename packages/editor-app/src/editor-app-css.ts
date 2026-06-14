/**
 * Editor-app design system stylesheet.
 *
 * Authored as a TypeScript string so it travels with the bundle and applies
 * uniformly across both host shells (`@sosb/browser-shell` and
 * `@sosb/electron-shell`) without per-shell wiring. The module's top-level
 * side effect injects the styles once into `document.head`, idempotently
 * and SSR-safely.
 *
 * Visual direction: focused operations workspace. Neutral surfaces,
 * clear text contrast, and a teal action accent. Selectors hang off the data attributes
 * the components already emit for testing, so no class names need to be
 * threaded through the Preact tree.
 *
 * Token contract (CSS custom properties on `:root`):
 *
 *   --font-display    serif display family (headings, wordmark)
 *   --font-ui         humanist sans for chrome (buttons, inputs)
 *   --font-mono       technical mono for slugs, paths, codes
 *   --paper / --ink   ground palette
 *   --accent          single sharp red used for active + destructive
 *   --error / --warn / --info  severity colours
 *
 * Override any of these at the consuming-document level to retheme without
 * forking this file.
 */

const STYLE_ELEMENT_ID = "sosb-editor-app-style";

export const EDITOR_APP_CSS = String.raw`
/* ============================================================
 * 1. Design tokens
 * ============================================================ */
:root {
  /* Type — distinctive, offline-safe fallbacks */
  --font-display: "Newsreader", "Source Serif 4", "Charter", "Iowan Old Style",
    "Baskerville", "Hoefler Text", Georgia, "Liberation Serif", serif;
  --font-ui: "IBM Plex Sans", "Söhne", "Inter", "Segoe UI Variable", "Segoe UI",
    -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "IBM Plex Mono", "JetBrains Mono", "Fira Code", ui-monospace,
    "SF Mono", "Cascadia Code", Menlo, Consolas, "Liberation Mono", monospace;

  /* Neutral workspace palette */
  --paper:         #f8fafc;
  --paper-raised:  #ffffff;
  --paper-sunken:  #eef2f7;
  --paper-deep:    #dbe4ef;

  /* Ink palette */
  --ink:    #17202a;
  --ink-2:  #344054;
  --ink-3:  #667085;
  --ink-4:  #98a2b3;

  /* Rules — hairline borders */
  --rule:       #cbd5e1;
  --rule-soft:  #e2e8f0;

  /* Accent */
  --accent:        #0f766e;
  --accent-strong: #0b5f59;
  --accent-soft:   #d9f2ee;

  /* Severity */
  --error:      #9b1c1c;
  --error-soft: #f3dada;
  --warn:       #a86b14;
  --warn-soft:  #f5e3c4;
  --info:       #315b8a;
  --info-soft:  #dce9f7;
  --ok:         #2a5f3d;

  /* Type scale (perfect fourth, tuned for editorial density) */
  --step--2: 0.75rem;     /* 12px */
  --step--1: 0.8125rem;   /* 13px */
  --step-0:  0.9375rem;   /* 15px */
  --step-1:  1.0625rem;   /* 17px */
  --step-2:  1.25rem;     /* 20px */
  --step-3:  1.5rem;      /* 24px */
  --step-4:  1.875rem;    /* 30px */
  --step-5:  2.5rem;      /* 40px */

  /* Spacing (4px baseline) */
  --sp-0: 0.25rem;
  --sp-1: 0.5rem;
  --sp-2: 0.75rem;
  --sp-3: 1rem;
  --sp-4: 1.5rem;
  --sp-5: 2.25rem;
  --sp-6: 3.5rem;

  /* Misc */
  --corner: 2px;          /* sharp, editorial — not rounded */
  --topbar-h: 56px;
  --footer-h: 40px;
  --transition: 120ms ease;
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
  font-family: var(--font-display);
  font-weight: 600;
  letter-spacing: 0;
  margin: 0;
}

/* ============================================================
 * 3. Root grid: topbar / content / footer
 * ============================================================ */
[data-testid="editor-app"] {
  display: grid;
  grid-template-rows: var(--topbar-h) 1fr var(--footer-h);
  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-ui);
}

/* ============================================================
 * 4. Top bar
 * ============================================================ */
[data-testid="top-bar"] {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 0 var(--sp-4);
  background: var(--paper-raised);
  border-bottom: 1px solid var(--rule);
  position: relative;
  z-index: 10;
}
[data-testid="top-bar"]::before {
  content: "Site Builder";
  font-family: var(--font-display);
  font-size: var(--step-2);
  font-weight: 600;
  letter-spacing: 0.01em;
  font-variant: small-caps;
  color: var(--ink);
  margin-right: auto;
  padding-right: var(--sp-3);
  border-right: 1px solid var(--rule);
  align-self: stretch;
  display: flex;
  align-items: center;
}
[data-testid="top-bar"]::after {
  content: "";
  position: absolute;
  left: var(--sp-4);
  bottom: -1px;
  width: 32px;
  height: 2px;
  background: var(--accent);
}
[data-testid="save-status"] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 24ch;
  margin: 0 var(--sp-1) 0 0;
  color: var(--ink-3);
  font-size: var(--step--1);
  line-height: 1.2;
  white-space: nowrap;
}
[data-testid="save-status"]::before {
  content: "";
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ink-4);
}
[data-testid="save-status"][data-status="saved"]::before {
  background: var(--ok);
}
[data-testid="save-status"][data-status="saving"]::before {
  background: var(--info);
}
[data-testid="save-status"][data-status="error"] {
  color: var(--error);
}
[data-testid="save-status"][data-status="error"]::before {
  background: var(--error);
}

/* ============================================================
 * 5. Two-pane layout
 * ============================================================ */
[data-testid="layout-two-pane"] {
  display: grid;
  grid-template-columns: minmax(380px, 460px) 1fr;
  min-height: 0;
  overflow: hidden;
}

/* ============================================================
 * 6. Tab layout (narrow viewports)
 * ============================================================ */
[data-testid="layout-tabs"] {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
[data-testid="layout-tabs"] > [role="tablist"] {
  display: flex;
  background: var(--paper-raised);
  border-bottom: 1px solid var(--rule);
}
[data-testid="layout-tab"] {
  flex: 1;
  appearance: none;
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  padding: var(--sp-2) var(--sp-3);
  font-family: var(--font-ui);
  font-size: var(--step--1);
  font-weight: 500;
  color: var(--ink-3);
  cursor: pointer;
  letter-spacing: 0.02em;
  transition: color var(--transition), border-color var(--transition);
}
[data-testid="layout-tab"][data-active="true"] {
  color: var(--ink);
  border-bottom-color: var(--accent);
}
[data-testid="layout-tab"]:hover:not([data-active="true"]) {
  color: var(--ink-2);
}

/* ============================================================
 * 7. Panes
 * ============================================================ */
[data-testid="editor-pane"] {
  min-height: 0;
  overflow-y: auto;
  padding: var(--sp-4) var(--sp-4) var(--sp-5);
  background: var(--paper);
  border-right: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}
[data-testid="preview-pane"] {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-4);
  background:
    linear-gradient(135deg, transparent 49%, var(--rule-soft) 49.5%, transparent 50%) 0 0 / 24px 24px,
    var(--paper-sunken);
}
[data-testid="preview-toolbar"] {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
}
[data-testid="viewport-preview-controls"] {
  display: inline-flex;
  max-width: 100%;
  overflow-x: auto;
  border: 1px solid var(--rule);
  background: var(--paper-raised);
}
[data-testid="editor-app"] [data-testid="viewport-preview-option"] {
  display: inline-grid;
  grid-template-rows: auto auto;
  gap: 1px;
  min-width: 84px;
  padding: 5px 10px;
  border: 0;
  border-right: 1px solid var(--rule);
  border-radius: 0;
  background: transparent;
  text-align: left;
}
[data-testid="editor-app"] [data-testid="viewport-preview-option"]:last-child {
  border-right: 0;
}
[data-testid="editor-app"] [data-testid="viewport-preview-option"][data-active="true"],
[data-testid="editor-app"] [data-testid="viewport-preview-option"][data-active="true"]:hover:not(:disabled):not([disabled]) {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}
[data-testid="viewport-preview-label"] {
  font-weight: 700;
  line-height: 1.1;
}
[data-testid="viewport-preview-size"] {
  color: var(--ink-3);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  line-height: 1.1;
  white-space: nowrap;
}
[data-testid="viewport-preview-option"][data-active="true"] [data-testid="viewport-preview-size"],
[data-testid="viewport-preview-option"][data-active="true"]:hover:not(:disabled):not([disabled]) [data-testid="viewport-preview-size"] {
  color: var(--paper-deep);
}
[data-testid="preview-canvas"] {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  place-items: start center;
  overflow: auto;
  padding: var(--sp-3);
}
[data-testid="preview-frame-shell"] {
  flex: 0 0 auto;
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: white;
  border: 1px solid var(--ink-4);
  box-shadow:
    0 1px 0 var(--rule),
    0 2px 0 var(--paper-deep),
    0 24px 56px -28px rgba(26, 24, 20, 0.35),
    0 8px 16px -8px rgba(26, 24, 20, 0.10);
}
[data-testid="preview-frame-shell"][data-preview-viewport="desktop"] {
  width: 1440px;
  height: 900px;
}
[data-testid="preview-frame-shell"][data-preview-viewport="tablet"] {
  width: 768px;
  height: 1024px;
}
[data-testid="preview-frame-shell"][data-preview-viewport="phone"] {
  width: 390px;
  height: 844px;
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
 * 8. Section headings (PagesList, BlockList, etc.)
 * ============================================================ */
[data-testid="editor-pane"] section > h2,
[data-testid="editor-pane"] section > header > h2,
[data-testid="editor-pane"] section > h3 {
  font-family: var(--font-display);
  font-size: var(--step-2);
  font-weight: 600;
  letter-spacing: 0;
  color: var(--ink);
  margin: 0;
  padding-bottom: var(--sp-1);
  border-bottom: 2px solid var(--ink);
  position: relative;
}
[data-testid="editor-pane"] section > h2::after,
[data-testid="editor-pane"] section > header > h2::after {
  /* Small accent tick under each section title */
  content: "";
  position: absolute;
  left: 0;
  bottom: -2px;
  width: 24px;
  height: 2px;
  background: var(--accent);
}

/* ============================================================
 * 9. Pages list
 * ============================================================ */
[data-testid="pages-list"] {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
[data-testid="pages-list-items"] {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--rule);
  background: var(--paper-raised);
}
[data-testid="pages-list-language-group"] {
  margin-top: var(--sp-2);
}
[data-testid="pages-list-language-group"] > h4 {
  font-family: var(--font-display);
  font-size: var(--step--1);
  font-weight: 600;
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
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--rule-soft);
  position: relative;
  transition: background var(--transition);
}
[data-testid="pages-list-item"]:last-child {
  border-bottom: 0;
}
[data-testid="pages-list-item"][data-active="true"] {
  background: var(--accent-soft);
}
[data-testid="pages-list-item"][data-active="true"]::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--accent);
}
[data-testid="pages-list-item"] > button[data-action="select"] {
  flex: 1 1 200px;
  min-width: 0;
  appearance: none;
  background: transparent;
  border: 0;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
}
[data-testid="pages-list-item"] > button[data-action="select"]:hover {
  color: var(--accent);
}
[data-testid="pages-list-item"] > button[data-action="select"] [data-field="navLabel"] {
  font-family: var(--font-display);
  font-size: var(--step-1);
  font-weight: 600;
  color: var(--ink);
}
[data-testid="pages-list-item"][data-active="true"] > button[data-action="select"] [data-field="navLabel"] {
  color: var(--accent-strong);
}
[data-testid="pages-list-item"] > button[data-action="select"] [data-field="slug"] {
  font-family: var(--font-mono);
  font-size: var(--step--1);
  color: var(--ink-3);
}
[data-testid="pages-list-item"] > button[data-action="select"] [data-field="lang"] {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  font-weight: 600;
  color: var(--ink-4);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 6px;
  border: 1px solid var(--rule);
  border-radius: var(--corner);
  background: var(--paper);
}
[data-testid="pages-list-item"] [data-testid="missing-translation-indicator"] {
  font-size: var(--step--2);
  color: var(--warn);
  background: var(--warn-soft);
  padding: 2px 8px;
  border-radius: var(--corner);
  flex-basis: 100%;
  margin-top: var(--sp-1);
}
[data-testid="pages-list-add"] {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--sp-2);
  align-items: end;
  padding: var(--sp-2) 0 0;
}
[data-testid="pages-list-add"] [role="alert"] {
  grid-column: 1 / -1;
  font-size: var(--step--1);
  color: var(--error);
  margin: 0;
}

/* ============================================================
 * 10. Block list
 * ============================================================ */
[data-testid="block-list"] {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
[data-testid="block-list"] > header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-3);
  padding-bottom: var(--sp-1);
  border-bottom: 2px solid var(--ink);
  position: relative;
}
[data-testid="block-list"] > header::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: -2px;
  width: 24px;
  height: 2px;
  background: var(--accent);
}
[data-testid="block-list-ol"] {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--rule);
  background: var(--paper-raised);
}
[data-testid="block-row"] {
  display: grid;
  grid-template-columns: 24px 1fr auto auto auto;
  grid-template-rows: auto auto;
  column-gap: var(--sp-2);
  align-items: center;
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--rule-soft);
  transition: background var(--transition);
}
[data-testid="block-row"]:last-child {
  border-bottom: 0;
}
[data-testid="block-row"]:hover {
  background: var(--paper);
}
[data-testid="block-drag-handle"] {
  grid-column: 1;
  grid-row: 1 / -1;
  align-self: center;
  cursor: grab;
  user-select: none;
  color: var(--ink-4);
  font-family: var(--font-mono);
  font-size: var(--step-2);
  line-height: 1;
  padding: 0 2px;
  border-radius: var(--corner);
  transition: color var(--transition), background var(--transition);
}
[data-testid="block-drag-handle"]:hover {
  color: var(--ink-2);
  background: var(--paper-sunken);
}
[data-testid="block-drag-handle"]:active {
  cursor: grabbing;
  color: var(--accent);
}
[data-testid="block-row-label"] {
  grid-column: 2;
  grid-row: 1;
  font-family: var(--font-mono);
  font-size: var(--step--2);
  font-weight: 500;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
[data-testid="block-row-title"] {
  grid-column: 2;
  grid-row: 2;
  font-family: var(--font-display);
  font-size: var(--step-1);
  font-weight: 500;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
[data-testid="block-row"] > [data-testid="block-move-up"] { grid-column: 3; grid-row: 1 / -1; }
[data-testid="block-row"] > [data-testid="block-move-down"] { grid-column: 4; grid-row: 1 / -1; }
[data-testid="block-row"] > [data-testid="block-remove"] { grid-column: 5; grid-row: 1 / -1; }

/* Drill-in select button — wraps the row's label/title and acts as the
 * primary "edit this block" affordance. Sits inside the row's CSS grid
 * at column 2, spanning both rows; spans inside use a column flex so
 * label-on-top / title-below stays visually identical to the legacy
 * non-button layout. Reset typical button chrome so the row reads as a
 * single text-target rather than a chunky pill. */
[data-testid="block-row"] > [data-testid="block-row-select"] {
  grid-column: 2;
  grid-row: 1 / -1;
  appearance: none;
  background: transparent;
  border: 0;
  padding: 0;
  margin: 0;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  color: inherit;
  font: inherit;
  letter-spacing: 0;
  border-radius: var(--corner);
  transition: color var(--transition);
}
[data-testid="block-row"] > [data-testid="block-row-select"]:hover:not(:disabled):not([disabled]) {
  background: transparent;
  border-color: transparent;
}
[data-testid="block-row"] > [data-testid="block-row-select"]:hover [data-testid="block-row-title"] {
  color: var(--accent);
}
[data-testid="block-row"] > [data-testid="block-row-select"] > [data-testid="block-row-label"],
[data-testid="block-row"] > [data-testid="block-row-select"] > [data-testid="block-row-title"] {
  /* Inside the select button the spans no longer need their own grid
   * placement — the button is the grid cell, they stack via flex. */
  grid-column: auto;
  grid-row: auto;
  display: block;
}

/* ============================================================
 * 10b. Drill-in inspector (block / site settings)
 * ============================================================ */
[data-testid="editor-pane"] [data-testid="inspector"] {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
/* Back-to-blocks affordance — left-aligned text button with an arrow.
 * Borrows the editorial-link feel: small caps, accent-coloured arrow,
 * no border so it reads as navigation rather than action. */
[data-testid="editor-pane"] [data-testid="drill-back"] {
  align-self: flex-start;
  appearance: none;
  background: transparent;
  border: 0;
  padding: var(--sp-1) 0;
  color: var(--ink-2);
  font-family: var(--font-ui);
  font-size: var(--step--1);
  font-weight: 600;
  letter-spacing: 0.04em;
  font-variant: small-caps;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  transition: color var(--transition);
}
[data-testid="editor-pane"] [data-testid="drill-back"]:hover:not(:disabled):not([disabled]) {
  background: transparent;
  border-color: transparent;
  color: var(--accent);
}
[data-testid="editor-pane"] [data-testid="drill-back"]::before {
  content: "←";
  font-family: var(--font-mono);
  font-size: var(--step-1);
  color: var(--accent);
  line-height: 1;
}
/* Inspector header — block label + block title above the form. Uses the
 * same display family + accent tick the section headings get. */
[data-testid="editor-pane"] [data-testid="inspector-header"] {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: var(--sp-1);
  border-bottom: 2px solid var(--ink);
  position: relative;
}
[data-testid="editor-pane"] [data-testid="inspector-header"]::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: -2px;
  width: 24px;
  height: 2px;
  background: var(--accent);
}
[data-testid="editor-pane"] [data-testid="inspector-header"] [data-testid="inspector-eyebrow"] {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  font-weight: 500;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
[data-testid="editor-pane"] [data-testid="inspector-header"] h2 {
  font-family: var(--font-display);
  font-size: var(--step-2);
  font-weight: 600;
  letter-spacing: 0;
  border-bottom: 0;
  padding-bottom: 0;
}
[data-testid="editor-pane"] [data-testid="inspector-header"] h2::after {
  display: none;
}
/* Site-settings affordance — sits between the block list and the locale
 * toggle in the un-drilled view. Visual register: looks like a row in
 * its own one-row "list" so it pairs with the BlockList's chrome. */
[data-testid="editor-pane"] [data-testid="site-settings-link"],
[data-testid="editor-pane"] [data-testid="drill-in-theme"] {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3);
  background: var(--paper-raised);
  border: 1px solid var(--rule);
  border-radius: var(--corner);
  text-align: left;
  cursor: pointer;
  font-family: var(--font-ui);
  color: var(--ink);
  transition: border-color var(--transition), color var(--transition), background var(--transition);
}
[data-testid="editor-pane"] [data-testid="site-settings-link"]:hover:not(:disabled):not([disabled]),
[data-testid="editor-pane"] [data-testid="drill-in-theme"]:hover:not(:disabled):not([disabled]) {
  border-color: var(--ink);
  background: var(--paper);
  color: var(--accent);
}
[data-testid="editor-pane"] [data-testid="site-settings-link"] [data-testid="site-settings-link-label"],
[data-testid="editor-pane"] [data-testid="drill-in-theme"] [data-testid="drill-in-theme-label"] {
  font-family: var(--font-display);
  font-size: var(--step-1);
  font-weight: 600;
  letter-spacing: 0;
  color: inherit;
}
[data-testid="editor-pane"] [data-testid="site-settings-link"] [data-testid="site-settings-link-hint"],
[data-testid="editor-pane"] [data-testid="drill-in-theme"] [data-testid="drill-in-theme-hint"] {
  font-family: var(--font-mono);
  font-size: var(--step--1);
  color: var(--ink-3);
}
[data-testid="editor-pane"] [data-testid="site-settings-link"]:hover [data-testid="site-settings-link-hint"],
[data-testid="editor-pane"] [data-testid="drill-in-theme"]:hover [data-testid="drill-in-theme-hint"] {
  color: var(--accent);
}

/* ============================================================
 * 11. Forms — fieldsets, legends, inputs
 * ============================================================ */
[data-testid="spine-form"],
[data-testid="block-form"] {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  margin: 0;
}
[data-testid="editor-pane"] fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
[data-testid="editor-pane"] fieldset > legend {
  font-family: var(--font-display);
  font-size: var(--step-1);
  font-weight: 600;
  color: var(--ink);
  padding: 0;
  margin: 0 0 var(--sp-1);
  letter-spacing: 0;
}
[data-testid="editor-pane"] fieldset[data-kind="object"] {
  padding: var(--sp-2) 0 0 var(--sp-3);
  border-left: 1px solid var(--rule);
  margin-left: var(--sp-1);
}
[data-testid="editor-pane"] fieldset[data-kind="object"] > legend {
  margin-left: calc(-1 * var(--sp-3) - 1px);
  padding: 0 var(--sp-2) 0 0;
  background: var(--paper);
  font-size: var(--step-0);
  font-weight: 600;
  font-variant: small-caps;
  letter-spacing: 0.04em;
  color: var(--ink-2);
}
[data-testid="editor-pane"] fieldset[data-kind="array"] [data-testid="array-summary"] {
  font-size: var(--step--1);
  color: var(--ink-3);
  font-style: italic;
  margin: 0;
}

[data-testid="editor-pane"] label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--step--1);
}
[data-testid="editor-pane"] label > span {
  font-size: var(--step--2);
  font-weight: 600;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
[data-testid="editor-pane"] label[data-field-label][data-field-label*="."]:not([data-field-label$=".title"]) > span {
  /* keep deep-path field labels readable */
  text-transform: none;
  letter-spacing: 0.02em;
}

/* Advisory length/phrasing hints (Guardrail 1). Muted small print beneath
 * an input — soft guidance, never validation. Reset the label's uppercase
 * span treatment so the hint reads as a plain sentence. */
[data-testid="editor-pane"] .field-hint {
  margin: 0;
  font-size: var(--step--2);
  font-weight: 400;
  color: var(--ink-3);
  text-transform: none;
  letter-spacing: 0;
  line-height: 1.4;
}

/* On-color preview chip (Guardrail 2). A small swatch showing the chosen
 * palette colour with sample text in the renderer-derived readable
 * on-colour — so the author sees their pick stays legible. */
[data-testid="editor-pane"] .color-picker__on-color {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--rule);
  border-radius: var(--corner);
  font-size: var(--step--1);
  font-weight: 600;
  line-height: 1;
  vertical-align: middle;
}
[data-testid="editor-pane"] .color-picker__on-color--default {
  background: var(--paper-raised);
  color: var(--ink-3);
  font-style: italic;
  opacity: 0.6;
}

[data-testid="editor-pane"] input[type="text"],
[data-testid="editor-pane"] input[type="number"],
[data-testid="editor-pane"] input[type="search"],
[data-testid="editor-pane"] select {
  appearance: none;
  font: inherit;
  font-size: var(--step-0);
  padding: 8px 10px;
  background: var(--paper-raised);
  border: 1px solid var(--rule);
  border-radius: var(--corner);
  color: var(--ink);
  width: 100%;
  transition: border-color var(--transition), background var(--transition), box-shadow var(--transition);
}
[data-testid="editor-pane"] input:focus,
[data-testid="editor-pane"] select:focus {
  outline: 0;
  border-color: var(--ink);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(168, 40, 32, 0.12);
}
[data-testid="editor-pane"] select {
  background-image:
    linear-gradient(45deg, transparent 50%, var(--ink-3) 50%),
    linear-gradient(135deg, var(--ink-3) 50%, transparent 50%);
  background-position:
    calc(100% - 18px) 50%,
    calc(100% - 12px) 50%;
  background-size: 6px 6px, 6px 6px;
  background-repeat: no-repeat;
  padding-right: 32px;
}
[data-testid="editor-pane"] input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--accent);
}
[data-testid="editor-pane"] label:has(input[type="checkbox"]) {
  flex-direction: row;
  align-items: center;
  gap: var(--sp-2);
}
[data-testid="editor-pane"] label:has(input[type="checkbox"]) > span {
  text-transform: none;
  letter-spacing: 0;
  font-size: var(--step-0);
  font-weight: 400;
  color: var(--ink);
}
[data-testid="editor-pane"] ol {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
[data-testid="editor-pane"] fieldset[data-kind="array"] > ol > li {
  padding: var(--sp-2);
  background: var(--paper-raised);
  border: 1px solid var(--rule-soft);
  border-radius: var(--corner);
}
.block-form__item-controls {
  display: flex;
  gap: var(--sp-1);
  margin-top: var(--sp-1);
  padding-top: var(--sp-1);
  border-top: 1px dashed var(--rule-soft);
}

/* ============================================================
 * 12. Upload pickers
 * ============================================================ */
[data-testid="asset-picker"],
[data-testid="document-picker"] {
  display: grid;
  gap: var(--sp-2);
  padding: var(--sp-2);
  border: 1px solid var(--rule-soft);
  background: var(--paper-raised);
}
[data-testid="asset-picker-thumbnail"] {
  display: block;
  width: min(100%, 280px);
  max-height: 180px;
  object-fit: contain;
  border: 1px solid var(--rule);
  background: #ffffff;
}
[data-testid="asset-picker-uploading"],
[data-testid="document-picker-uploading"],
[data-testid="asset-picker-error"],
[data-testid="document-picker-error"] {
  margin: 0;
  padding: var(--sp-2) var(--sp-3);
  border-left: 3px solid var(--info);
  background: var(--info-soft);
  color: var(--ink-2);
  font-size: var(--step--1);
}
[data-testid="asset-picker-error"],
[data-testid="document-picker-error"] {
  border-left-color: var(--error);
  background: var(--error-soft);
  color: var(--error);
}
[data-testid="asset-picker-missing"],
[data-testid="document-picker-tile"] {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--sp-1) var(--sp-2);
  align-items: center;
  padding: var(--sp-2);
  border: 1px solid var(--rule);
  background: var(--paper);
}
[data-testid="asset-picker-missing"] > span {
  grid-column: 1 / 3;
  color: var(--error);
  font-size: var(--step--1);
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
  font-family: var(--font-mono);
  font-size: var(--step--2);
}
[data-testid="document-picker-type"] {
  grid-row: 2;
}
[data-testid="document-picker-size"] {
  grid-row: 3;
}
[data-testid="document-picker-replace"] {
  grid-column: 3;
  grid-row: 1 / 4;
}

/* ============================================================
 * 13. Buttons — base + variants
 * ============================================================ */
[data-testid="editor-app"] button {
  appearance: none;
  font: inherit;
  font-family: var(--font-ui);
  font-size: var(--step--1);
  font-weight: 500;
  letter-spacing: 0.01em;
  padding: 6px 12px;
  background: var(--paper-raised);
  color: var(--ink-2);
  border: 1px solid var(--rule);
  border-radius: var(--corner);
  cursor: pointer;
  transition:
    background var(--transition),
    border-color var(--transition),
    color var(--transition),
    transform var(--transition);
  font-variant-numeric: tabular-nums;
}
[data-testid="editor-app"] button:hover:not(:disabled):not([disabled]) {
  background: var(--paper);
  border-color: var(--ink-3);
  color: var(--ink);
}
[data-testid="editor-app"] button:active:not(:disabled):not([disabled]) {
  transform: translateY(0.5px);
}
[data-testid="editor-app"] button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
[data-testid="editor-app"] button:disabled,
[data-testid="editor-app"] button[disabled] {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Primary action: Export */
[data-testid="top-bar"] button[data-action="export"] {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}
[data-testid="top-bar"] button[data-action="export"]:hover:not(:disabled) {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--paper);
}

/* Destructive states */
[data-testid="editor-app"] button[data-action="delete"][data-confirming="true"],
[data-testid="block-remove"]:hover:not(:disabled),
button[data-action="delete"]:hover:not(:disabled) {
  background: var(--accent);
  color: var(--paper);
  border-color: var(--accent);
}

/* Arrow buttons (move up / move down) */
[data-testid="pages-list-item"] button[data-action="move-up"],
[data-testid="pages-list-item"] button[data-action="move-down"] {
  width: 28px;
  padding: 4px 0;
  font-family: var(--font-mono);
  text-align: center;
}

/* "Add block" + "Add page" primary affirm */
[data-testid="block-add"],
[data-testid="pages-list-add"] button[type="submit"] {
  background: var(--ink-2);
  color: var(--paper);
  border-color: var(--ink-2);
  font-weight: 500;
}
[data-testid="block-add"]:hover:not(:disabled),
[data-testid="pages-list-add"] button[type="submit"]:hover:not(:disabled) {
  background: var(--accent);
  border-color: var(--accent);
}

/* ============================================================
 * 14. Add-block dialog
 * ============================================================ */
[data-testid="add-block-dialog"] {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 100;
  width: min(720px, calc(100vw - 2 * var(--sp-4)));
  max-height: min(80vh, 720px);
  overflow-y: auto;
  background: var(--paper-raised);
  border: 1px solid var(--ink);
  border-top: 4px solid var(--accent);
  padding: var(--sp-4) var(--sp-5);
  box-shadow:
    0 32px 80px -32px rgba(26, 24, 20, 0.55),
    0 12px 24px -12px rgba(26, 24, 20, 0.20);
}
[data-testid="add-block-dialog"] > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-3);
  padding-bottom: var(--sp-3);
  margin-bottom: var(--sp-3);
  border-bottom: 1px solid var(--rule);
}
[data-testid="add-block-dialog"] > header > h2 {
  font-family: var(--font-display);
  font-size: var(--step-4);
  font-weight: 600;
  letter-spacing: 0;
  color: var(--ink);
}
[data-testid="add-block-search-label"] {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  margin-bottom: var(--sp-4);
}
[data-testid="add-block-search-label"] > span {
  font-size: var(--step--2);
  font-weight: 600;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
[data-testid="add-block-search"] {
  appearance: none;
  font: inherit;
  font-size: var(--step-1);
  padding: 10px 14px;
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: var(--corner);
  color: var(--ink);
  width: 100%;
}
[data-testid="add-block-search"]:focus {
  outline: 0;
  border-color: var(--ink);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(168, 40, 32, 0.12);
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
  font-family: var(--font-display);
  font-size: var(--step--1);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--ink-3);
  margin: 0 0 var(--sp-2);
  padding-bottom: var(--sp-1);
  border-bottom: 1px dashed var(--rule);
}
[data-testid="add-block-group"] > ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--sp-2);
}
[data-testid="add-block-entry"] {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-0);
  padding: var(--sp-3);
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: var(--corner);
  cursor: pointer;
  text-align: left;
  min-height: 88px;
  transition: border-color var(--transition), background var(--transition), transform var(--transition);
}
[data-testid="add-block-entry"]:hover {
  background: var(--paper-raised);
  border-color: var(--ink);
  transform: translateY(-1px);
}
[data-testid="add-block-entry-label"] {
  font-family: var(--font-display);
  font-size: var(--step-1);
  font-weight: 600;
  color: var(--ink);
}
[data-testid="add-block-entry-description"] {
  font-size: var(--step--1);
  color: var(--ink-3);
  line-height: 1.4;
}
[data-testid="add-block-close"] {
  font-size: var(--step--2);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
[data-testid="add-block-empty"] {
  font-style: italic;
  color: var(--ink-3);
  padding: var(--sp-3);
  text-align: center;
  border: 1px dashed var(--rule);
  border-radius: var(--corner);
}

/* ============================================================
 * 15. Export-confirm dialog
 * ============================================================ */
[data-testid="export-confirm-dialog"] {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 100;
  width: min(640px, calc(100vw - 2 * var(--sp-4)));
  max-height: min(80vh, 720px);
  overflow-y: auto;
  background: var(--paper-raised);
  border: 1px solid var(--ink);
  border-top: 4px solid var(--accent);
  padding: var(--sp-4) var(--sp-5);
  box-shadow:
    0 32px 80px -32px rgba(26, 24, 20, 0.55),
    0 12px 24px -12px rgba(26, 24, 20, 0.20);
}
[data-testid="export-confirm-dialog"] h2 {
  font-family: var(--font-display);
  font-size: var(--step-3);
  font-weight: 600;
  letter-spacing: 0;
  margin: 0 0 var(--sp-2);
}
[data-testid="export-confirm-dialog"]:has([data-issues-group="error"]) h2 {
  color: var(--accent-strong);
}
[data-testid="export-confirm-dialog"] > p {
  font-size: var(--step-0);
  color: var(--ink-2);
  line-height: 1.5;
  margin: 0 0 var(--sp-3);
}
[data-testid="export-confirm-dialog"] [data-issues-group] {
  margin-top: var(--sp-3);
  padding: var(--sp-2) var(--sp-3);
  border-left: 3px solid var(--rule);
  background: var(--paper);
}
[data-testid="export-confirm-dialog"] [data-issues-group="error"] {
  border-left-color: var(--error);
  background: var(--error-soft);
}
[data-testid="export-confirm-dialog"] [data-issues-group="warning"] {
  border-left-color: var(--warn);
  background: var(--warn-soft);
}
[data-testid="export-confirm-dialog"] [data-issues-group] h3 {
  font-family: var(--font-ui);
  font-size: var(--step--1);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-2);
  margin: 0 0 var(--sp-1);
}
[data-testid="export-confirm-dialog"] [data-issues-group] ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
[data-testid="export-confirm-dialog"] [data-issue-message] {
  display: inline;
  font-size: var(--step--1);
  color: var(--ink);
}
[data-testid="export-confirm-dialog"] [data-issue-path] {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  color: var(--ink-3);
  margin-left: var(--sp-1);
}
[data-testid="export-confirm-input-label"] {
  display: flex !important;
  flex-direction: column !important;
  gap: var(--sp-1);
  margin-top: var(--sp-4);
  padding: var(--sp-3);
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: var(--corner);
}
[data-testid="export-confirm-input-label"] > span {
  text-transform: none !important;
  letter-spacing: 0 !important;
  font-size: var(--step-0) !important;
  font-weight: 400 !important;
  color: var(--ink-2) !important;
}
[data-testid="export-confirm-input-label"] strong {
  font-family: var(--font-mono);
  font-weight: 700;
  background: var(--ink);
  color: var(--paper);
  padding: 1px 6px;
  border-radius: var(--corner);
  letter-spacing: 0.04em;
}
[data-testid="export-confirm-input"] {
  font-family: var(--font-mono) !important;
  font-size: var(--step-1) !important;
  padding: 10px 12px !important;
  letter-spacing: 0.06em !important;
}
[data-testid="export-confirm-actions"] {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-2);
  margin-top: var(--sp-4);
  padding-top: var(--sp-3);
  border-top: 1px solid var(--rule);
}
[data-testid="export-confirm-button"]:not(:disabled) {
  background: var(--accent);
  color: var(--paper);
  border-color: var(--accent);
  font-weight: 600;
}
[data-testid="export-confirm-button"]:not(:disabled):hover {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
}

/* ============================================================
 * 16. Locale toggle
 * ============================================================ */
[data-testid="locale-toggle"] {
  border: 1px solid var(--rule);
  background: var(--paper-raised);
  padding: var(--sp-3);
  margin: 0;
  border-radius: var(--corner);
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}
[data-testid="locale-toggle"] > legend {
  font-family: var(--font-display);
  font-size: var(--step--1);
  font-weight: 600;
  font-variant: small-caps;
  letter-spacing: 0.06em;
  padding: 0;
  margin: 0 0 var(--sp-1);
  background: transparent;
  border: 0;
}
[data-testid="locale-help"] {
  font-size: var(--step--1);
  color: var(--ink-3);
  line-height: 1.4;
  margin: 0;
}

/* ============================================================
 * 17. Site health panel
 * ============================================================ */
[data-testid="site-health-panel"] {
  position: fixed;
  left: 0;
  right: 0;
  bottom: var(--footer-h);
  z-index: 20;
  max-height: 50vh;
  overflow-y: auto;
  background: var(--paper-raised);
  border-top: 3px solid var(--ink);
  padding: var(--sp-4) var(--sp-5);
  box-shadow: 0 -12px 32px -16px rgba(26, 24, 20, 0.30);
}
[data-testid="site-health-panel"] h2 {
  font-family: var(--font-display);
  font-size: var(--step-3);
  font-weight: 600;
  letter-spacing: 0;
  margin: 0 0 var(--sp-3);
}
[data-testid="site-health-empty"] {
  font-family: var(--font-display);
  font-style: italic;
  color: var(--ok);
  font-size: var(--step-1);
  margin: 0;
}
[data-severity-group] {
  margin-top: var(--sp-3);
  padding: var(--sp-2) 0 var(--sp-2) var(--sp-3);
  border-left: 3px solid var(--rule);
}
[data-severity-group="error"]   { border-left-color: var(--error); }
[data-severity-group="warning"] { border-left-color: var(--warn); }
[data-severity-group="info"]    { border-left-color: var(--info); }
[data-severity-group] > h3 {
  font-family: var(--font-ui);
  font-size: var(--step--1);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-2);
  margin: 0 0 var(--sp-2);
}
[data-severity-group="error"]   > h3 { color: var(--error); }
[data-severity-group="warning"] > h3 { color: var(--warn); }
[data-severity-group="info"]    > h3 { color: var(--info); }
[data-severity-group] [data-group-count] {
  font-family: var(--font-mono);
  font-weight: 400;
  color: var(--ink-3);
}
[data-severity-group] [data-empty-group] {
  font-size: var(--step--1);
  font-style: italic;
  color: var(--ink-4);
  margin: 0;
}
[data-severity-group] > ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
button[data-issue] {
  display: flex !important;
  flex-direction: column;
  align-items: flex-start !important;
  gap: 2px;
  width: 100%;
  padding: var(--sp-2) var(--sp-3) !important;
  background: var(--paper) !important;
  text-align: left;
  border-radius: var(--corner);
}
button[data-issue]:hover {
  background: var(--paper-raised) !important;
}
button[data-issue][data-severity="error"]   { border-left: 4px solid var(--error) !important; }
button[data-issue][data-severity="warning"] { border-left: 4px solid var(--warn) !important; }
button[data-issue][data-severity="info"]    { border-left: 4px solid var(--info) !important; }
button[data-issue] [data-issue-message] {
  font-size: var(--step-0);
  font-weight: 500;
  color: var(--ink);
}
button[data-issue] [data-issue-path] {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  color: var(--ink-3);
}

/* ============================================================
 * 18. Health footer
 * ============================================================ */
[data-testid="health-footer"] {
  background: var(--ink);
  color: var(--paper);
  border-top: 1px solid var(--ink-2);
  display: flex;
  align-items: stretch;
  z-index: 30;
}
[data-testid="editor-app"] [data-testid="health-footer-toggle"] {
  flex: 1;
  height: var(--footer-h);
  padding: 0 var(--sp-4);
  background: transparent;
  border: 0;
  border-radius: 0;
  color: var(--paper);
  font-family: var(--font-mono);
  font-size: var(--step--1);
  letter-spacing: 0.04em;
  text-align: left;
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  cursor: pointer;
  position: relative;
  transition: background var(--transition);
}
[data-testid="editor-app"] [data-testid="health-footer-toggle"]:hover {
  background: var(--ink-2);
}
[data-testid="editor-app"] [data-testid="health-footer-toggle"][aria-expanded="true"] {
  background: var(--ink-2);
}
[data-testid="editor-app"] [data-testid="health-footer-toggle"]::before {
  content: "▴";
  display: inline-block;
  font-size: var(--step--2);
  transition: transform var(--transition);
  color: var(--paper-deep);
  margin-right: var(--sp-1);
}
[data-testid="editor-app"] [data-testid="health-footer-toggle"][aria-expanded="true"]::before {
  transform: rotate(180deg);
}
[data-testid="health-footer-toggle"] [data-count="error"]   { color: #f4b8b8; font-weight: 600; }
[data-testid="health-footer-toggle"] [data-count="warning"] { color: #f4d6a0; font-weight: 600; }
[data-testid="health-footer-toggle"] [data-count="info"]    { color: #afd0e6; }
[data-testid="health-footer-toggle"] [data-count="error"]:has(+ *)::before,
[data-testid="health-footer-toggle"] [data-count="warning"]::before,
[data-testid="health-footer-toggle"] [data-count="info"]::before {
  /* visual divider between counts */
  content: "·";
  color: var(--ink-4);
  margin: 0 var(--sp-1);
}
[data-testid="health-footer-toggle"] [data-count="error"]::before {
  content: "";
  margin: 0;
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
  border-bottom: 1px solid var(--info);
  color: var(--ink);
  font-size: var(--step--1);
}
[data-testid="update-banner-error"] {
  background: var(--error-soft);
  border-bottom-color: var(--error);
  color: var(--error);
}
[data-testid="update-banner-message"] {
  flex: 1;
  font-weight: 500;
}

/* ============================================================
 * 20. Selection + focus polish
 * ============================================================ */
::selection {
  background: var(--accent);
  color: var(--paper);
}
[data-testid="editor-app"] :focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--corner);
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
  [data-testid="top-bar"] {
    padding: 0 var(--sp-3);
    gap: 4px;
    overflow-x: auto;
  }
  [data-testid="top-bar"]::before {
    font-size: var(--step-1);
    padding-right: var(--sp-2);
  }
  [data-testid="save-status"] {
    max-width: 18ch;
    white-space: normal;
  }
  [data-testid="editor-pane"] {
    padding: var(--sp-3);
    gap: var(--sp-4);
  }
  [data-testid="preview-pane"] {
    padding: var(--sp-2);
  }
  [data-testid="preview-toolbar"] {
    justify-content: flex-start;
  }
  [data-testid="preview-canvas"] {
    padding: var(--sp-2);
  }
  [data-testid="editor-app"] [data-testid="viewport-preview-option"] {
    min-width: 78px;
    padding: 5px 8px;
  }
}

/* ============================================================
 * 23. Theme picker previews
 * ============================================================ */
[data-theme-picker-root] [data-theme-option] {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.35rem 0.65rem;
  align-items: start;
  padding: 0.7rem;
  border: 1px solid var(--border);
  margin-block: 0.5rem;
}
[data-theme-option-label],
[data-theme-option-description],
[data-theme-option-preview] {
  grid-column: 2;
}
[data-theme-option-label] {
  font-weight: 700;
}
[data-theme-option-description] {
  color: var(--muted);
  font-size: 0.92rem;
}
[data-theme-option-preview] {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.6rem;
  align-items: center;
  margin-top: 0.35rem;
}
[data-theme-preview-swatches] {
  display: flex;
  gap: 0.25rem;
}
[data-theme-preview-swatch] {
  width: 1rem;
  height: 1rem;
  border: 1px solid var(--border);
}
[data-theme-preview-type] {
  display: grid;
  gap: 0.1rem;
  font-size: 0.8rem;
}
`;

/**
 * Inject the editor-app stylesheet into the host document, idempotently.
 *
 * Runs as a top-level side effect when this module is first imported, so
 * the styles are present before Preact renders into `#root`. Guarded for
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
