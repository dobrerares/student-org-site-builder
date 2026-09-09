/**
 * Welcome and wizard shell stylesheet.
 *
 * The editor app injects its own stylesheet when it mounts, but the
 * pre-editor welcome and wizard screens live in the browser shell. Keep their
 * host chrome here so the archival build has usable first-run UI.
 *
 * The palette and type mirror the editor's design tokens (`editor-app-css.ts`)
 * so the hand-off from welcome → wizard → editor feels like one product. The
 * `--sosb-shell-*` names are local so this file has no hard dependency on
 * the editor stylesheet being present; when it is, the shared Inter
 * `@font-face` rules simply apply.
 */

const STYLE_ELEMENT_ID = "sosb-welcome-shell-style";

export const WELCOME_SHELL_CSS = String.raw`
:root {
  color-scheme: light;
  --sosb-shell-font: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  --sosb-shell-bg: #f4f6f8;
  --sosb-shell-surface: #ffffff;
  --sosb-shell-soft: #eceff3;
  --sosb-shell-border: #e2e6eb;
  --sosb-shell-border-strong: #cbd2db;
  --sosb-shell-text: #111827;
  --sosb-shell-text-2: #374151;
  --sosb-shell-muted: #6b7280;
  --sosb-shell-primary: #0f766e;
  --sosb-shell-primary-strong: #0b5f59;
  --sosb-shell-primary-soft: #e3f3f0;
  --sosb-shell-ring: rgba(15, 118, 110, 0.28);
  --sosb-shell-error: #b42318;
  --sosb-shell-error-soft: #fee4e2;
  --sosb-shell-radius: 12px;
  --sosb-shell-radius-sm: 8px;
  --sosb-shell-shadow: 0 4px 12px -2px rgba(17, 24, 39, 0.08), 0 1px 3px rgba(17, 24, 39, 0.06);
}

body {
  margin: 0;
  background: var(--sosb-shell-bg);
  color: var(--sosb-shell-text);
  font-family: var(--sosb-shell-font);
  -webkit-font-smoothing: antialiased;
}

[data-testid="welcome-screen"],
[data-testid="wizard"] {
  box-sizing: border-box;
  min-height: 100vh;
  padding: clamp(1rem, 4vw, 3rem) clamp(1rem, 3vw, 2rem);
  font-family: var(--sosb-shell-font);
  font-size: 0.9375rem;
  line-height: 1.5;
}
[data-testid="welcome-screen"] *,
[data-testid="wizard"] * {
  box-sizing: border-box;
}

/* ------------------------------------------------------------
 * Welcome screen
 * ------------------------------------------------------------ */
[data-testid="welcome-screen"] {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
  grid-template-areas:
    "header nav"
    "error error"
    "recent recent"
    "footer footer";
  align-content: start;
  align-items: start;
  column-gap: clamp(1.5rem, 4vw, 3.5rem);
  row-gap: 1.25rem;
  max-width: 1120px;
  margin: 0 auto;
}
[data-testid="welcome-screen"] > header {
  grid-area: header;
  display: grid;
  gap: 1rem;
  padding-top: 0.5rem;
}
[data-testid="welcome-screen"] > nav {
  grid-area: nav;
}
[data-testid="welcome-import-error"] {
  grid-area: error;
}
[data-testid="welcome-recent-sites"] {
  grid-area: recent;
}
[data-welcome-footer] {
  grid-area: footer;
}

[data-welcome-kicker] {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--sosb-shell-text-2);
  letter-spacing: 0.01em;
}
[data-welcome-mark] {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--sosb-shell-primary);
  background-image:
    linear-gradient(#ffffff, #ffffff),
    linear-gradient(#ffffff, #ffffff);
  background-size: 14px 2px, 2px 8px;
  background-position: 7px 10px, 13px 14px;
  background-repeat: no-repeat;
}
[data-testid="welcome-screen"] h1,
[data-testid="welcome-screen"] h2,
[data-testid="wizard"] h1,
[data-testid="wizard"] legend {
  margin: 0;
  line-height: 1.12;
  letter-spacing: -0.02em;
  font-weight: 800;
}
[data-testid="welcome-screen"] h1 {
  max-width: 16ch;
  font-size: clamp(2.1rem, 4.6vw, 3.4rem);
}
[data-testid="welcome-screen"] p,
[data-testid="wizard"] p {
  color: var(--sosb-shell-muted);
}
[data-welcome-lead] {
  max-width: 52ch;
  margin: 0;
  font-size: 1.0625rem;
  line-height: 1.55;
  color: var(--sosb-shell-text-2) !important;
}
[data-welcome-points] {
  display: grid;
  gap: 0.5rem;
  margin: 0.25rem 0 0;
  padding: 0;
  list-style: none;
  color: var(--sosb-shell-text-2);
  font-size: 0.9375rem;
}
[data-welcome-points] > li {
  position: relative;
  padding-left: 1.75rem;
}
[data-welcome-points] > li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.2rem;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--sosb-shell-primary-soft);
  background-image:
    linear-gradient(135deg, transparent 45%, var(--sosb-shell-primary) 45%, var(--sosb-shell-primary) 55%, transparent 55%);
  background-size: 0;
}
[data-welcome-points] > li::after {
  content: "";
  position: absolute;
  left: 6px;
  top: 0.42rem;
  width: 5px;
  height: 9px;
  border: solid var(--sosb-shell-primary);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
[data-testid="welcome-drop-hint"] {
  display: inline-flex;
  width: fit-content;
  margin: 0.25rem 0 0;
  padding: 0.5rem 0.75rem;
  border: 1px dashed var(--sosb-shell-border-strong);
  border-radius: var(--sosb-shell-radius-sm);
  background: var(--sosb-shell-surface);
  color: var(--sosb-shell-text-2) !important;
  font-size: 0.85rem !important;
}

[data-testid="welcome-screen"] nav {
  display: grid;
  gap: 0.75rem;
}
[data-testid="welcome-screen"] button,
[data-testid="wizard"] button {
  min-height: 2.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--sosb-shell-border-strong);
  border-radius: var(--sosb-shell-radius-sm);
  background: var(--sosb-shell-surface);
  color: var(--sosb-shell-text);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease, box-shadow 140ms ease, transform 140ms ease;
}
[data-testid="welcome-screen"] nav button {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    "title arrow"
    "detail arrow";
  align-items: center;
  column-gap: 0.75rem;
  row-gap: 0.2rem;
  padding: 1rem 1.1rem;
  border-radius: var(--sosb-shell-radius);
  box-shadow: var(--sosb-shell-shadow);
  text-align: left;
}
[data-testid="welcome-screen"] nav button::after {
  content: "";
  grid-area: arrow;
  width: 9px;
  height: 9px;
  border: solid currentColor;
  border-width: 2px 2px 0 0;
  transform: rotate(45deg);
  opacity: 0.45;
  transition: transform 140ms ease, opacity 140ms ease;
}
[data-testid="welcome-screen"] nav button:hover:not(:disabled)::after {
  opacity: 1;
  transform: translateX(3px) rotate(45deg);
}
[data-action-title] {
  grid-area: title;
  display: block;
  color: inherit;
  font-size: 1.0625rem;
  font-weight: 700;
  line-height: 1.25;
}
[data-action-detail] {
  grid-area: detail;
  display: block;
  color: var(--sosb-shell-muted);
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.4;
}

[data-testid="welcome-screen"] button:hover:not(:disabled),
[data-testid="wizard"] button:hover:not(:disabled) {
  border-color: var(--sosb-shell-primary);
}
[data-testid="welcome-screen"] nav button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 0 0 3px var(--sosb-shell-ring), var(--sosb-shell-shadow);
}
[data-testid="welcome-screen"] button:focus-visible,
[data-testid="wizard"] button:focus-visible,
[data-testid="wizard"] input:focus-visible,
[data-testid="wizard"] select:focus-visible,
[data-testid="wizard"] textarea:focus-visible {
  outline: 3px solid var(--sosb-shell-primary);
  outline-offset: 2px;
}
[data-testid="welcome-screen"] button:disabled,
[data-testid="wizard"] button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  box-shadow: none;
}

/* Primary actions: continue-draft and the wizard entry point. */
[data-testid="welcome-screen"] nav [data-testid="welcome-action-wizard"],
[data-testid="welcome-screen"] nav [data-testid="welcome-action-continue"],
[data-testid="wizard"] [data-action="next"],
[data-testid="wizard"] [data-action="create"] {
  background: var(--sosb-shell-primary);
  border-color: var(--sosb-shell-primary);
  color: #ffffff;
}
[data-testid="welcome-action-wizard"] [data-action-detail],
[data-testid="welcome-action-continue"] [data-action-detail] {
  color: rgba(255, 255, 255, 0.82);
}
[data-testid="welcome-screen"] nav [data-testid="welcome-action-wizard"]:hover:not(:disabled),
[data-testid="welcome-screen"] nav [data-testid="welcome-action-continue"]:hover:not(:disabled),
[data-testid="wizard"] [data-action="next"]:hover:not(:disabled),
[data-testid="wizard"] [data-action="create"]:hover:not(:disabled) {
  background: var(--sosb-shell-primary-strong);
  border-color: var(--sosb-shell-primary-strong);
}
/* When a draft exists it takes the primary slot; the wizard steps down. */
[data-testid="welcome-screen"] nav:has([data-testid="welcome-action-continue"]) [data-testid="welcome-action-wizard"] {
  background: var(--sosb-shell-surface);
  border-color: var(--sosb-shell-border-strong);
  color: var(--sosb-shell-text);
}
[data-testid="welcome-screen"] nav:has([data-testid="welcome-action-continue"]) [data-testid="welcome-action-wizard"] [data-action-detail] {
  color: var(--sosb-shell-muted);
}

[data-testid="welcome-import-error"] {
  margin: 0;
  padding: 0.75rem 1rem;
  border: 1px solid #f4b6b0;
  border-radius: var(--sosb-shell-radius-sm);
  background: var(--sosb-shell-error-soft);
  color: var(--sosb-shell-error) !important;
  font-weight: 500;
}

[data-testid="welcome-recent-sites"] {
  padding: 1rem 1.25rem;
  border: 1px solid var(--sosb-shell-border);
  border-radius: var(--sosb-shell-radius);
  background: var(--sosb-shell-surface);
}
[data-testid="welcome-recent-sites"] h2 {
  font-size: 1.125rem;
}
[data-testid="welcome-recent-sites"] p {
  margin: 0.5rem 0 0;
  font-size: 0.9rem;
}
[data-testid="welcome-recent-sites"] ol {
  display: grid;
  gap: 0.5rem;
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
}
[data-testid="welcome-recent-site"] {
  width: 100%;
  padding: 0.75rem 1rem;
  text-align: left;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85rem;
}

[data-welcome-footer] {
  padding-top: 0.5rem;
  border-top: 1px solid var(--sosb-shell-border);
}
[data-welcome-footer] p {
  margin: 0;
  font-size: 0.8125rem;
}

/* ------------------------------------------------------------
 * Wizard
 * ------------------------------------------------------------ */
[data-testid="wizard"] {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 1.25rem;
  width: min(880px, 100%);
  margin: 0 auto;
  padding: clamp(1.25rem, 3vw, 2rem);
  background: var(--sosb-shell-surface);
  border: 1px solid var(--sosb-shell-border);
  border-radius: 16px;
  box-shadow: 0 18px 50px -24px rgba(17, 24, 39, 0.28);
  min-height: 0;
}
@media (min-width: 761px) {
  [data-testid="wizard"] {
    min-height: min(720px, calc(100vh - 2 * clamp(1rem, 4vw, 3rem)));
  }
}
[data-wizard-header] {
  display: grid;
  gap: 0.35rem;
}
[data-wizard-kicker] {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--sosb-shell-primary) !important;
}
[data-testid="wizard"] h1 {
  font-size: clamp(1.5rem, 3vw, 2rem);
}
[data-wizard-progress] {
  margin: 0;
  font-size: 0.875rem;
}

[data-testid="step-indicator"] {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
[data-testid="wizard"] [data-wizard-step-indicator] {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.4rem 0.6rem;
  border-color: transparent;
  background: var(--sosb-shell-soft);
  color: var(--sosb-shell-muted);
  text-align: left;
  font-size: 0.85rem;
  font-weight: 600;
}
[data-testid="wizard"] [data-wizard-step-indicator]:hover:not(:disabled) {
  border-color: var(--sosb-shell-border-strong);
  color: var(--sosb-shell-text);
}
[data-step-number] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--sosb-shell-surface);
  color: var(--sosb-shell-muted);
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
[data-step-label] {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
[data-step-status="done"] [data-wizard-step-indicator] {
  color: var(--sosb-shell-text-2);
}
[data-step-status="done"] [data-step-number] {
  background: var(--sosb-shell-primary-soft);
  color: var(--sosb-shell-primary);
}
[data-testid="wizard"] [data-wizard-step-indicator][data-active="true"] {
  background: var(--sosb-shell-primary);
  border-color: var(--sosb-shell-primary);
  color: #ffffff;
}
[data-wizard-step-indicator][data-active="true"] [data-step-number] {
  background: rgba(255, 255, 255, 0.22);
  color: #ffffff;
}

[data-testid="wizard-step"] {
  min-width: 0;
}
[data-testid="wizard"] fieldset {
  display: grid;
  gap: 1rem;
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
[data-testid="wizard"] legend {
  padding: 0;
  margin-bottom: 0.25rem;
  font-size: 1.375rem;
  float: left;
  width: 100%;
}
[data-testid="wizard"] legend + p {
  margin: 0 0 0.25rem;
  font-size: 0.9375rem;
}
[data-testid="wizard"] label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sosb-shell-text-2);
}
[data-testid="wizard"] input:not([type="checkbox"]):not([type="radio"]),
[data-testid="wizard"] select,
[data-testid="wizard"] textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 2.625rem;
  border: 1px solid var(--sosb-shell-border-strong);
  border-radius: var(--sosb-shell-radius-sm);
  padding: 0.55rem 0.8rem;
  background: var(--sosb-shell-surface);
  color: var(--sosb-shell-text);
  font: inherit;
  font-weight: 400;
  transition: border-color 140ms ease, box-shadow 140ms ease;
}
[data-testid="wizard"] input:focus,
[data-testid="wizard"] select:focus,
[data-testid="wizard"] textarea:focus {
  outline: 0;
  border-color: var(--sosb-shell-primary);
  box-shadow: 0 0 0 3px var(--sosb-shell-ring);
}
[data-testid="wizard"] input[type="checkbox"],
[data-testid="wizard"] input[type="radio"] {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: var(--sosb-shell-primary);
}
[data-testid="wizard"] label:has(> input[type="checkbox"]) {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--sosb-shell-border);
  border-radius: var(--sosb-shell-radius-sm);
  font-weight: 500;
  color: var(--sosb-shell-text);
  cursor: pointer;
}
[data-testid="wizard"] label:has(> input[type="checkbox"]:checked) {
  border-color: var(--sosb-shell-primary);
  background: var(--sosb-shell-primary-soft);
}
[data-testid="sections-list"] {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

[data-testid="theme-list"] {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
[data-testid="theme-list"] > li {
  min-width: 0;
}
[data-testid="theme-list"] label {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 0 0.7rem;
  height: 100%;
  padding: 0.9rem;
  border: 1px solid var(--sosb-shell-border);
  border-radius: var(--sosb-shell-radius);
  background: var(--sosb-shell-surface);
  cursor: pointer;
  font-weight: 400;
  transition: border-color 140ms ease, box-shadow 140ms ease;
}
[data-testid="theme-list"] label:hover {
  border-color: var(--sosb-shell-border-strong);
}
[data-testid="theme-list"] label:has(input:checked) {
  border-color: var(--sosb-shell-primary);
  box-shadow: 0 0 0 3px var(--sosb-shell-ring);
}
[data-testid="theme-list"] input[type="radio"] {
  margin-top: 2px;
}
[data-theme-card-body] {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
}
[data-theme-card-swatches] {
  display: inline-flex;
  width: fit-content;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--sosb-shell-border);
  margin-bottom: 0.2rem;
}
[data-theme-card-swatches] > span {
  width: 20px;
  height: 20px;
}
[data-theme-card-label] {
  font-size: 1rem;
  font-weight: 700;
  color: var(--sosb-shell-text);
}
[data-theme-card-description] {
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--sosb-shell-muted);
}

[data-testid="confirm-summary"] {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 0.6rem 1.5rem;
  margin: 0;
  padding: 1rem 1.25rem;
  border: 1px solid var(--sosb-shell-border);
  border-radius: var(--sosb-shell-radius);
  background: var(--sosb-shell-bg);
}
[data-testid="confirm-summary"] dt {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--sosb-shell-muted);
}
[data-testid="confirm-summary"] dd {
  margin: 0;
  font-weight: 500;
  color: var(--sosb-shell-text);
  overflow-wrap: anywhere;
}

[data-testid="wizard-nav"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  border-top: 1px solid var(--sosb-shell-border);
  padding-top: 1rem;
}
[data-wizard-nav-spacer] {
  flex: 1 1 auto;
}
[data-testid="wizard-nav"] button {
  padding: 0.55rem 1.1rem;
}
[data-testid="wizard-nav"] [data-action="cancel"] {
  border-color: transparent;
  color: var(--sosb-shell-muted);
}
[data-testid="wizard-nav"] [data-action="cancel"]:hover:not(:disabled) {
  background: var(--sosb-shell-soft);
  border-color: transparent;
  color: var(--sosb-shell-text);
}
[data-testid="wizard-nav"] [data-action="next"],
[data-testid="wizard-nav"] [data-action="create"] {
  font-weight: 700;
  padding-inline: 1.5rem;
}

@media (max-width: 860px) {
  [data-testid="welcome-screen"] {
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "nav"
      "error"
      "recent"
      "footer";
  }
}
@media (max-width: 760px) {
  [data-testid="welcome-screen"],
  [data-testid="wizard"] {
    padding: 1rem;
  }
  [data-testid="wizard"] {
    width: 100%;
    border-radius: 12px;
  }
  [data-testid="step-indicator"] {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  [data-testid="wizard"] [data-wizard-step-indicator] {
    min-height: 2.5rem;
    padding: 0.35rem 0.5rem;
    font-size: 0.8rem;
  }
  [data-testid="wizard-nav"] {
    justify-content: stretch;
  }
  [data-testid="wizard-nav"] button {
    flex: 1 1 auto;
  }
  [data-wizard-nav-spacer] {
    display: none;
  }
}
`;

export function injectWelcomeShellCss(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ELEMENT_ID) !== null) return;

  const styleEl = document.createElement("style");
  styleEl.id = STYLE_ELEMENT_ID;
  styleEl.textContent = WELCOME_SHELL_CSS;
  document.head.appendChild(styleEl);
}

injectWelcomeShellCss();
