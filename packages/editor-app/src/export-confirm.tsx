/** @jsxImportSource react */
/**
 * Pre-export confirmation dialog.
 *
 * Two flows depending on `result`:
 *
 *  - If `errors.length > 0`: a high-friction confirmation gate. The user
 *    must type the literal string `DOWNLOAD` into a textbox before the
 *    confirm button enables. Lists every error in the dialog body.
 *  - If `errors.length === 0` (warnings only): a single-click "Export
 *    anyway" button is enabled immediately. Lists every warning in the
 *    dialog body.
 *
 * Implements the WAI-ARIA dialog pattern through `<EditorDialog>` (Base UI
 * via `@sosb/ui`), which adds the focus trap and focus return the
 * hand-rolled overlay never had:
 *  - `role="dialog"`, `aria-modal="true"`.
 *  - `aria-labelledby` points at the heading.
 *  - `aria-describedby` points at the explanatory paragraph.
 *
 * The component does NOT render itself when there are no issues — that
 * branch is handled by the caller (the editor shell) which simply calls
 * `onExport` directly.
 */
import type { JSX } from "react";
import type * as React from "react";
import { useState } from "react";
import type { ValidationIssue, ValidationResult } from "@sosb/schema";
import { hasBlockingIssues } from "@sosb/schema";
import { issuePathLabel } from "./field-labels.js";
import { pathToDotted } from "./issue-navigate.js";
import { EditorDialog } from "./editor-dialog.js";
import { Button, Input } from "@sosb/ui";

const CONFIRM_PHRASE = "DOWNLOAD";

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
  // ADR 0016's rule is "blocking-on-confirmation, never hard-block", and it
  // still governs every ordinary error. ADR 0048 carves out one narrow
  // exception: public content that cannot be produced correctly at all — today,
  // an Article list pointing at a Draft or deleted Article. There is no typed
  // phrase for those, because there is no correct file to write. Saving the
  // editable project archive is deliberately unaffected.
  const blocked = hasBlockingIssues(result);
  const [phrase, setPhrase] = useState<string>("");
  const confirmEnabled = blocked ? false : hasErrors ? phrase === CONFIRM_PHRASE : true;

  const headingId = "export-confirm-heading";
  const descId = "export-confirm-description";

  return (
    <EditorDialog
      open
      onClose={onCancel}
      testId="export-confirm-dialog"
      labelledBy={headingId}
      describedBy={descId}
      tone={hasErrors ? "error" : "warning"}
    >
      <>
        <h2 id={headingId}>
          {blocked
            ? "Fix these before downloading the website"
            : hasErrors
              ? "Some things need fixing first"
              : "Download with warnings?"}
        </h2>
        <p id={descId}>
          {blocked
            ? `${count(result.errors.length, "problem")} must be fixed before the website can be built. Your project is still saved — only the website download is affected.`
            : hasErrors
              ? `${count(result.errors.length, "problem")} and ${count(result.warnings.length, "warning")} were found. Fixing them first is best, but you can still download a copy.`
              : `${count(result.warnings.length, "warning")} found. These won't break your site, but fixing them will make it better.`}
        </p>

        {hasErrors ? <IssueList severity="error" issues={result.errors} /> : null}
        {result.warnings.length > 0 ? (
          <IssueList severity="warning" issues={result.warnings} />
        ) : null}

        {hasErrors && !blocked ? (
          <label data-testid="export-confirm-input-label">
            <span>
              To download anyway, type <strong>{CONFIRM_PHRASE}</strong> below:
            </span>
            <Input
              type="text"
              data-testid="export-confirm-input"
              value={phrase}
              onInput={(event: React.FormEvent<HTMLInputElement>) =>
                setPhrase(event.currentTarget.value)
              }
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        ) : null}

        <div data-testid="export-confirm-actions">
          <Button type="button" data-testid="export-cancel-button" onClick={() => onCancel()}>
            {hasErrors ? "Go back and fix" : "Cancel"}
          </Button>
          <Button
            type="button"
            data-testid="export-confirm-button"
            disabled={!confirmEnabled}
            data-blocked={blocked ? "true" : "false"}
            onClick={() => {
              if (confirmEnabled) onConfirm();
            }}
          >
            Download anyway
          </Button>
        </div>
      </>
    </EditorDialog>
  );
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
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
            <IssueRow severity={severity} issue={issue} />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface IssueRowProps {
  readonly severity: "error" | "warning" | "info";
  readonly issue: ValidationIssue;
}

function IssueRow({ severity, issue }: IssueRowProps): JSX.Element {
  const dotted = pathToDotted(issue.path);
  return (
    <span data-issue data-severity={severity} data-path={dotted} data-code={issue.code}>
      <span data-issue-message>{issue.message}</span>
      <span data-issue-path> {issuePathLabel(issue.path)}</span>
    </span>
  );
}
