/**
 * WelcomeScreen — the pre-editor entry surface.
 *
 * Per issue #32 (and PRD §"Welcome screen & onboarding"):
 *
 *   - Four primary paths: wizard / template / import / blank. Each is a
 *     button. Clicking fires the matching callback. The host wires the
 *     callbacks to the actual flows (the wizard is #33; the demo template
 *     is #34; import goes through `@sosb/zip`'s `importFromZip`; blank
 *     goes through `createBlankSite()`).
 *   - Recent sites list: most-recent-first, click to open, right-click to
 *     "reveal in OS" (Electron-only — the host receives the callback and
 *     decides whether the platform supports the gesture).
 *   - Drag-drop zip import: the screen is a drop zone; dropping a file
 *     fires `onImportFile(file)` so the host can run `importFromZip`.
 *
 * The component is intentionally pure UI. It owns no state beyond the
 * drag-active boolean used to give the drop zone a hover affordance.
 *
 * Tracking issue: #32. ADR 0006 records the recent-sites storage choice.
 */

import type { JSX } from "preact";
import { useState } from "preact/hooks";

import type { RecentSite } from "./recent-sites.js";

export interface WelcomeScreenProps {
  /** Persisted recent-sites list, most-recent-first. */
  readonly recents: readonly RecentSite[];
  /** Wizard path (#33). Optional so the screen renders before #33 lands. */
  readonly onWizard?: () => void;
  /** Template path (#34). Optional pending demo content. */
  readonly onTemplate?: () => void;
  /** Import path: open OS file picker. */
  readonly onImport?: () => void;
  /** Blank path: create an empty site. */
  readonly onBlank?: () => void;
  /** Drag-drop import: a zip File was dropped on the screen. */
  readonly onImportFile?: (file: File) => void;
  /** Click on a recent-sites row. Receives the row's `key`. */
  readonly onOpenRecent?: (key: string) => void;
  /** Right-click on a recent-sites row. Receives the row's `key`. */
  readonly onRevealRecent?: (key: string) => void;
}

/**
 * Static metadata for the four primary paths. Kept out-of-render so the
 * test that asserts "exactly four affordances with these IDs" inspects
 * the same source the renderer walks.
 */
const PATHS: ReadonlyArray<{
  id: "wizard" | "template" | "import" | "blank";
  label: string;
  description: string;
}> = [
  {
    id: "wizard",
    label: "Start with the wizard",
    description: "Six guided steps to a credible starter site.",
  },
  {
    id: "template",
    label: "Start from a template",
    description: "Use the curated demo as a starting point.",
  },
  {
    id: "import",
    label: "Open an existing site",
    description: "Import a zip exported from this editor.",
  },
  {
    id: "blank",
    label: "Start blank",
    description: "One page, one hero block. Build from scratch.",
  },
];

export function WelcomeScreen(props: WelcomeScreenProps): JSX.Element {
  const [dragActive, setDragActive] = useState(false);

  const callbacks: Record<(typeof PATHS)[number]["id"], (() => void) | undefined> = {
    wizard: props.onWizard,
    template: props.onTemplate,
    import: props.onImport,
    blank: props.onBlank,
  };

  function handleDragOver(event: JSX.TargetedDragEvent<HTMLElement>): void {
    event.preventDefault();
    setDragActive(true);
  }
  function handleDragLeave(event: JSX.TargetedDragEvent<HTMLElement>): void {
    event.preventDefault();
    setDragActive(false);
  }
  function handleDrop(event: JSX.TargetedDragEvent<HTMLElement>): void {
    event.preventDefault();
    setDragActive(false);
    const files = event.dataTransfer?.files;
    if (files === undefined || files.length === 0) return;
    const file = files[0];
    if (file === undefined) return;
    props.onImportFile?.(file);
  }

  return (
    <div
      data-testid="welcome-screen"
      data-drag-active={dragActive ? "true" : "false"}
    >
      <header data-testid="welcome-header">
        <h1>Student Org Site Builder</h1>
        <p>Pick a starting point.</p>
      </header>

      <section
        data-testid="drop-zone"
        data-drag-active={dragActive ? "true" : "false"}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <ul data-testid="welcome-paths">
          {PATHS.map((path) => (
            <li key={path.id}>
              <button
                type="button"
                data-welcome-path={path.id}
                onClick={() => callbacks[path.id]?.()}
              >
                <span data-testid="welcome-path-label">{path.label}</span>
                <span data-testid="welcome-path-description">
                  {path.description}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p data-testid="drop-zone-hint">
          …or drop a previously-exported zip anywhere on this screen.
        </p>
      </section>

      <section data-testid="recent-sites">
        <h2>Recent sites</h2>
        {props.recents.length === 0 ? (
          <p data-testid="recent-sites-empty">No recent sites yet.</p>
        ) : (
          <ul data-testid="recent-sites-list">
            {props.recents.map((entry) => (
              <li key={entry.key}>
                <button
                  type="button"
                  data-testid="recent-site"
                  data-recent-key={entry.key}
                  onClick={() => props.onOpenRecent?.(entry.key)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    props.onRevealRecent?.(entry.key);
                  }}
                >
                  <span data-testid="recent-site-label">{entry.label}</span>
                  <span data-testid="recent-site-modified">
                    {formatLastModified(entry.lastModified)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Render a Unix-epoch-ms timestamp as a stable string. Locale-free and
 * timezone-stable so the test corpus doesn't drift between machines —
 * we render the ISO 8601 date prefix and let the host swap in a
 * locale-aware formatter later (i18n is owned by #34).
 */
function formatLastModified(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return "";
  const date = new Date(epochMs);
  // YYYY-MM-DD
  return date.toISOString().slice(0, 10);
}
