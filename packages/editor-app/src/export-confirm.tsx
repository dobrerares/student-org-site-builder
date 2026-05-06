/**
 * Pre-export confirmation dialog.
 *
 * Two flows depending on `result`:
 *
 *  - If `errors.length > 0`: a high-friction confirmation gate. The user
 *    must type the literal string `EXPORT` into a textbox before the
 *    confirm button enables. Lists every error in the dialog body.
 *  - If `errors.length === 0` (warnings only): a single-click "Export
 *    anyway" button is enabled immediately. Lists every warning in the
 *    dialog body.
 *
 * Implements the WAI-ARIA dialog pattern:
 *  - `role="dialog"`, `aria-modal="true"`.
 *  - `aria-labelledby` points at the heading.
 *  - `aria-describedby` points at the explanatory paragraph.
 *
 * The component does NOT render itself when there are no issues — that
 * branch is handled by the caller (the editor shell) which simply calls
 * `onExport` directly.
 */
import type { JSX } from "preact";
import { useState } from "preact/hooks";
import type { ValidationIssue, ValidationResult } from "@sosb/schema";
import { pathToDotted } from "./issue-navigate.js";

const CONFIRM_PHRASE = "EXPORT";

export interface ExportConfirmDialogProps {
  readonly result: ValidationResult;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ExportConfirmDialog({
  result,
  onConfirm,
  onCancel,
}: ExportConfirmDialogProps): JSX.Element {
  const hasErrors = result.errors.length > 0;
  const [phrase, setPhrase] = useState<string>("");
  const confirmEnabled = hasErrors ? phrase === CONFIRM_PHRASE : true;

  const headingId = "export-confirm-heading";
  const descId = "export-confirm-description";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-describedby={descId}
      data-testid="export-confirm-dialog"
    >
      <h2 id={headingId}>{hasErrors ? "Errors block this export" : "Export with warnings?"}</h2>
      <p id={descId}>
        {hasErrors
          ? `${result.errors.length} error(s) and ${result.warnings.length} warning(s) found. Errors should be fixed before publishing — but you can override.`
          : `${result.warnings.length} warning(s) found. These won't break your site, but addressing them will improve quality.`}
      </p>

      {hasErrors ? <IssueList severity="error" issues={result.errors} /> : null}
      {result.warnings.length > 0 ? (
        <IssueList severity="warning" issues={result.warnings} />
      ) : null}

      {hasErrors ? (
        <label data-testid="export-confirm-input-label">
          <span>
            Type <strong>{CONFIRM_PHRASE}</strong> to override:
          </span>
          <input
            type="text"
            data-testid="export-confirm-input"
            value={phrase}
            onInput={(event: JSX.TargetedEvent<HTMLInputElement>) =>
              setPhrase(event.currentTarget.value)
            }
            autoComplete="off"
            spellcheck={false}
          />
        </label>
      ) : null}

      <div data-testid="export-confirm-actions">
        <button type="button" data-testid="export-cancel-button" onClick={() => onCancel()}>
          {hasErrors ? "Fix first" : "Cancel"}
        </button>
        <button
          type="button"
          data-testid="export-confirm-button"
          disabled={!confirmEnabled}
          onClick={() => {
            if (confirmEnabled) onConfirm();
          }}
        >
          {hasErrors ? "Export anyway" : "Export anyway"}
        </button>
      </div>
    </div>
  );
}

interface IssueListProps {
  readonly severity: "error" | "warning" | "info";
  readonly issues: readonly ValidationIssue[];
}

function IssueList({ severity, issues }: IssueListProps): JSX.Element {
  const label = severity === "error" ? "Errors" : severity === "warning" ? "Warnings" : "Info";
  return (
    <div data-issues-group={severity}>
      <h3>
        {label} ({issues.length})
      </h3>
      <ul>
        {issues.map((issue, idx) => (
          <li key={`${severity}-${idx}-${issue.code}`}>
            <span
              data-issue
              data-severity={severity}
              data-path={pathToDotted(issue.path)}
              data-code={issue.code}
            >
              <span data-issue-message>{issue.message}</span>
              <span data-issue-path>
                {" "}
                {pathToDotted(issue.path) === "" ? "(site)" : pathToDotted(issue.path)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
