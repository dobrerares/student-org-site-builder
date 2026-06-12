/**
 * Welcome and wizard shell stylesheet.
 *
 * The editor app injects its own stylesheet when it mounts, but the
 * pre-editor welcome and wizard screens live in the browser shell. Keep their
 * host chrome here so the archival build has usable first-run UI.
 */

const STYLE_ELEMENT_ID = "sosb-welcome-shell-style";

export const WELCOME_SHELL_CSS = String.raw`
:root {
  color-scheme: light;
  --sosb-shell-bg: #f6f7f9;
  --sosb-shell-surface: #ffffff;
  --sosb-shell-border: #d7dde5;
  --sosb-shell-text: #17202a;
  --sosb-shell-muted: #52606d;
  --sosb-shell-primary: #1f3a5f;
  --sosb-shell-primary-strong: #152a46;
  --sosb-shell-accent: #7a2d16;
  --sosb-shell-focus: #3b82f6;
}

body {
  background: var(--sosb-shell-bg);
  color: var(--sosb-shell-text);
}

[data-testid="welcome-screen"],
[data-testid="wizard"] {
  box-sizing: border-box;
  min-height: 100vh;
  padding: clamp(1rem, 3vw, 2rem);
}

[data-testid="welcome-screen"] {
  display: grid;
  align-content: start;
  gap: 1.25rem;
  max-width: 980px;
  margin: 0 auto;
}

[data-testid="welcome-screen"] > header,
[data-testid="wizard"] {
  background: var(--sosb-shell-surface);
  border: 1px solid var(--sosb-shell-border);
  border-radius: 8px;
  box-shadow: 0 14px 40px rgba(23, 32, 42, 0.08);
}

[data-testid="welcome-screen"] > header {
  padding: clamp(1.25rem, 3vw, 2rem);
}

[data-testid="welcome-screen"] h1,
[data-testid="welcome-screen"] h2,
[data-testid="wizard"] legend {
  margin: 0;
  line-height: 1.15;
  letter-spacing: 0;
}

[data-testid="welcome-screen"] h1 {
  max-width: 14ch;
  font-size: clamp(2rem, 6vw, 4.5rem);
}

[data-testid="welcome-screen"] p,
[data-testid="wizard"] p {
  color: var(--sosb-shell-muted);
}

[data-testid="welcome-screen"] nav {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 0.75rem;
}

[data-testid="welcome-screen"] button,
[data-testid="wizard"] button {
  min-height: 2.5rem;
  border: 1px solid var(--sosb-shell-border);
  border-radius: 6px;
  background: var(--sosb-shell-surface);
  color: var(--sosb-shell-text);
  font: inherit;
  cursor: pointer;
}

[data-testid="welcome-screen"] nav button {
  padding: 1rem;
  text-align: left;
  font-weight: 700;
}

[data-testid="welcome-screen"] button:hover:not(:disabled),
[data-testid="wizard"] button:hover:not(:disabled) {
  border-color: var(--sosb-shell-primary);
}

[data-testid="welcome-screen"] button:focus-visible,
[data-testid="wizard"] button:focus-visible,
[data-testid="wizard"] input:focus-visible,
[data-testid="wizard"] textarea:focus-visible {
  outline: 3px solid var(--sosb-shell-focus);
  outline-offset: 2px;
}

[data-testid="welcome-screen"] button:disabled,
[data-testid="wizard"] button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

[data-testid="welcome-action-wizard"],
[data-testid="welcome-action-continue"],
[data-testid="wizard"] [data-action="next"],
[data-testid="wizard"] [data-action="create"] {
  background: var(--sosb-shell-primary);
  border-color: var(--sosb-shell-primary);
  color: #ffffff;
}

[data-testid="welcome-action-wizard"]:hover:not(:disabled),
[data-testid="welcome-action-continue"]:hover:not(:disabled),
[data-testid="wizard"] [data-action="next"]:hover:not(:disabled),
[data-testid="wizard"] [data-action="create"]:hover:not(:disabled) {
  background: var(--sosb-shell-primary-strong);
}

[data-testid="welcome-import-error"] {
  margin: 0;
  padding: 0.75rem 1rem;
  border: 1px solid #efb4a8;
  border-radius: 6px;
  background: #fff4f1;
  color: #8a1f0f;
}

[data-testid="welcome-recent-sites"] {
  padding: 1rem;
  border: 1px solid var(--sosb-shell-border);
  border-radius: 8px;
  background: var(--sosb-shell-surface);
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
}

[data-testid="wizard"] {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 1rem;
  width: min(1040px, calc(100% - 2rem));
  margin: 0 auto;
}

[data-testid="step-indicator"] {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

[data-wizard-step-indicator] {
  display: grid;
  width: 100%;
  min-height: 3.25rem;
  padding: 0.5rem;
  text-align: left;
}

[data-wizard-step-indicator="true"],
[data-wizard-step-indicator][data-active="true"] {
  border-color: var(--sosb-shell-primary);
  background: #edf4ff;
}

[data-testid="wizard-step"] {
  min-width: 0;
}

[data-testid="wizard"] fieldset {
  display: grid;
  gap: 1rem;
  margin: 0;
  padding: clamp(1rem, 3vw, 1.5rem);
  border: 1px solid var(--sosb-shell-border);
  border-radius: 8px;
}

[data-testid="wizard"] legend {
  padding: 0 0.5rem;
  font-size: 1.5rem;
  font-weight: 800;
}

[data-testid="wizard"] label {
  display: grid;
  gap: 0.35rem;
  font-weight: 650;
}

[data-testid="wizard"] input,
[data-testid="wizard"] textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 2.5rem;
  border: 1px solid var(--sosb-shell-border);
  border-radius: 6px;
  padding: 0.55rem 0.7rem;
  color: var(--sosb-shell-text);
  font: inherit;
}

[data-testid="theme-list"] {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

[data-testid="theme-list"] label {
  min-height: 6rem;
  padding: 0.8rem;
  border: 1px solid var(--sosb-shell-border);
  border-radius: 8px;
}

[data-testid="wizard-nav"] {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  border-top: 1px solid var(--sosb-shell-border);
  padding-top: 1rem;
}

[data-testid="wizard-nav"] button {
  padding: 0.5rem 0.9rem;
}

@media (max-width: 760px) {
  [data-testid="welcome-screen"],
  [data-testid="wizard"] {
    padding: 1rem;
  }

  [data-testid="wizard"] {
    width: 100%;
  }

  [data-testid="step-indicator"] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  [data-wizard-step-indicator] {
    min-height: 2.75rem;
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
