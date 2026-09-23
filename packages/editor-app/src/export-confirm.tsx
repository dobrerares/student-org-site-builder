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
import type { OmittedBlock } from "@sosb/renderer";
import { issuePathLabel } from "./field-labels.js";
import { pathToDotted } from "./issue-navigate.js";
import { EditorDialog } from "./editor-dialog.js";
import { Button, Input } from "@sosb/ui";

const CONFIRM_PHRASE = "DOWNLOAD";

export interface ExportConfirmDialogProps {
  readonly result: ValidationResult;
  /**
   * Blocks the active Theme has no design for, which the published Site will
   * leave out (ADR 0045). Non-empty means the author must tick an
   * acknowledgement before the download proceeds — on top of, not instead of,
   * whatever the validation result requires.
   */
  readonly omittedBlocks?: readonly OmittedBlock[] | undefined;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ExportConfirmDialog({
  result,
  omittedBlocks = [],
  onConfirm,
  onCancel,
}: ExportConfirmDialogProps): JSX.Element {
  const hasErrors = result.errors.length > 0;
  const hasIssues = hasErrors || result.warnings.length > 0;
  const hasOmissions = omittedBlocks.length > 0;
  // ADR 0016's rule is "blocking-on-confirmation, never hard-block", and it
  // still governs every ordinary error. ADR 0048 carves out one narrow
  // exception: public content that cannot be produced correctly at all — today,
  // an Article list pointing at a Draft or deleted Article. There is no typed
  // phrase for those, because there is no correct file to write. Saving the
  // editable project archive is deliberately unaffected.
  const blocked = hasBlockingIssues(result);
  const [phrase, setPhrase] = useState<string>("");
  const [omissionsAcknowledged, setOmissionsAcknowledged] = useState<boolean>(false);
  const issueGate = blocked ? false : hasErrors ? phrase === CONFIRM_PHRASE : true;
  const confirmEnabled = issueGate && (!hasOmissions || omissionsAcknowledged);

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
              : hasIssues
                ? "Download with warnings?"
                : "Some blocks will be left out"}
        </h2>
        <p id={descId}>
          {blocked
            ? `${count(result.errors.length, "problem")} must be fixed before the website can be built. Your project is still saved — only the website download is affected.`
            : hasErrors
              ? `${count(result.errors.length, "problem")} and ${count(result.warnings.length, "warning")} were found. Fixing them first is best, but you can still download a copy.`
              : hasIssues
                ? `${count(result.warnings.length, "warning")} found. These won't break your site, but fixing them will make it better.`
                : `${count(omittedBlocks.length, "block")} will not appear on the website because this Theme has no design for ${omittedBlocks.length === 1 ? "it" : "them"}. Your content is kept — switch Theme to show ${omittedBlocks.length === 1 ? "it" : "them"} again.`}
        </p>

        {hasErrors ? <IssueList severity="error" issues={result.errors} /> : null}
        {result.warnings.length > 0 ? (
          <IssueList severity="warning" issues={result.warnings} />
        ) : null}
        {hasOmissions ? (
          <OmittedBlockList
            omitted={omittedBlocks}
            acknowledged={omissionsAcknowledged}
            onAcknowledge={setOmissionsAcknowledged}
          />
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

interface OmittedBlockListProps {
  readonly omitted: readonly OmittedBlock[];
  readonly acknowledged: boolean;
  readonly onAcknowledge: (value: boolean) => void;
}

/**
 * The ADR 0045 acknowledgement.
 *
 * Omission is not an error: the Site is publishable and nothing is lost, so
 * there is no typed phrase. But it is not a warning either — a warning can be
 * clicked past without reading, and the whole point of the rule is that the
 * author knows, before the download, which parts of their Site the visitors
 * will not see. A checkbox is the smallest control that cannot be passed by
 * accident.
 */
function OmittedBlockList({
  omitted,
  acknowledged,
  onAcknowledge,
}: OmittedBlockListProps): JSX.Element {
  return (
    <div data-issues-group="omitted" data-testid="export-omitted-blocks">
      <h3>Left out of the website ({omitted.length})</h3>
      <ul>
        {omitted.map((entry) => (
          <li key={`${entry.document.kind}-${entry.document.id}-${entry.blockId}`}>
            <span data-omitted-block data-block-type={entry.blockType} data-block-id={entry.blockId}>
              <span data-issue-message>
                {entry.document.kind === "article" ? "Article" : "Page"} “{entry.document.title}”:
                the {entry.blockType} block has no design in this Theme.
              </span>
            </span>
          </li>
        ))}
      </ul>
      <label data-testid="export-omitted-ack-label">
        <input
          type="checkbox"
          data-testid="export-omitted-ack"
          checked={acknowledged}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onAcknowledge(event.currentTarget.checked)
          }
        />{" "}
        I understand these blocks will not appear on the downloaded website.
      </label>
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
