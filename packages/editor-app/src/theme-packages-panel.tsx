/** @jsxImportSource react */
/**
 * Theme packages panel — import, list, export and remove developer-authored
 * Themes (ADR 0050 / ADR 0051).
 *
 * Lives inside the Theme drill-in, under the look picker, because that is
 * where someone who wants a different design is already looking.
 *
 * Two deliberate UX choices, both from ADR 0051:
 *
 *  - Remove is *blocked* while a Theme is in use rather than hidden or
 *    silently destructive. A disabled control with a stated reason teaches
 *    the rule; a missing control just looks broken.
 *  - A failed import says what is wrong with the package and changes nothing.
 *    The previous Theme stays installed and selected, so a bad file is never
 *    able to leave a Site worse than it found it.
 */
import { useId, useRef, useState, type JSX } from "react";
import type { Site } from "@sosb/schema";
import type { ThemeBundle } from "@sosb/renderer";
import { Button, Hint } from "@sosb/ui";

import { themeRemovalBlockedReason } from "./theme-switch.js";

export interface InstalledTheme {
  readonly bundle: ThemeBundle;
}

export interface ThemePackagesPanelProps {
  readonly site: Site;
  readonly installed: readonly ThemeBundle[];
  /** Import a `.sosb-theme.zip`. Rejects with a human-readable message. */
  readonly onImport: (file: File) => Promise<void>;
  /** Download an installed package as a standalone `.sosb-theme.zip`. */
  readonly onExport: (themeId: string) => Promise<void>;
  readonly onRemove: (themeId: string) => Promise<void>;
}

export function ThemePackagesPanel(props: ThemePackagesPanelProps): JSX.Element {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  async function runImport(file: File): Promise<void> {
    setBusy(true);
    setError(undefined);
    try {
      await props.onImport(file);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
      // Clear the input so re-picking the same file after a fix re-fires
      // `change` — browsers suppress it otherwise and the author thinks the
      // button is dead.
      if (inputRef.current !== null) inputRef.current.value = "";
    }
  }

  return (
    <section data-theme-group="packages" aria-labelledby="theme-group-packages">
      <h3 id="theme-group-packages">Theme packages</h3>
      <p data-group-hint>
        A developer can build a Theme for your organisation and send it to you as a file. Imported
        Themes are saved inside this Site, so they travel with your project archive and work
        offline.
      </p>

      <div data-theme-import>
        {/* A plain file input with a visible label. The native picker is the
            only thing that works identically in the browser and in Electron
            (where it becomes the OS dialog), so there is no second code path.
            The label is not decoration: without it the control reaches a
            screen reader as an unnamed "file upload button" and axe flags it
            (ADR 0026). */}
        <label htmlFor={inputId}>Import a Theme package</label>
        <input
          ref={inputRef}
          id={inputId}
          aria-describedby={`${inputId}-hint`}
          type="file"
          accept=".zip,.sosb-theme.zip,application/zip"
          data-testid="theme-import-input"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) void runImport(file);
          }}
        />
        <Hint className="field-hint" id={`${inputId}-hint`}>
          Accepts a .sosb-theme.zip package.
        </Hint>
      </div>

      {error !== undefined && (
        <p data-theme-import-error role="alert" data-testid="theme-import-error">
          That Theme package could not be imported. {error}
        </p>
      )}

      {props.installed.length === 0 ? (
        <p data-theme-packages-empty>No Theme packages imported yet.</p>
      ) : (
        <ul data-theme-packages-list data-testid="theme-packages-list">
          {props.installed.map((bundle) => {
            const blockedReason = themeRemovalBlockedReason(props.site, bundle.id);
            return (
              <li key={bundle.id} data-theme-package data-theme-id={bundle.id}>
                <span data-theme-package-name>{bundle.name}</span>{" "}
                <span data-theme-package-version>v{bundle.version}</span>
                <span data-theme-package-id>{bundle.id}</span>
                <span data-theme-package-actions>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void props.onExport(bundle.id)}
                  >
                    Export
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy || blockedReason !== undefined}
                    aria-describedby={
                      blockedReason === undefined ? undefined : `${bundle.id}-remove-why`
                    }
                    onClick={() => void props.onRemove(bundle.id)}
                  >
                    Remove
                  </Button>
                  {blockedReason !== undefined && (
                    <Hint className="field-hint" id={`${bundle.id}-remove-why`}>
                      {blockedReason}
                    </Hint>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
