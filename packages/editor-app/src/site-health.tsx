/**
 * Site Health panel — renders a `ValidationResult` as three grouped lists
 * (Errors / Warnings / Info). Each issue is a real `<button>` so it is
 * keyboard-activable and screen-readers announce it as a control. Click /
 * Enter / Space all fire `onJump(issue)` so the editor shell can scroll +
 * focus the offending field.
 *
 * Markup contract (used by tests, axe, and future styling):
 *
 *   <section data-testid="site-health-panel" aria-label="Site health">
 *     <h2>Site health</h2>
 *     <div data-severity-group="error">
 *       <h3>Errors</h3>
 *       <ul>
 *         <li>
 *           <button
 *             data-issue
 *             data-severity="error"
 *             data-path="pages.1.slug"
 *             data-code="site.page.slug.duplicate"
 *           >
 *             <span data-issue-message>...</span>
 *             <span data-issue-path>pages.1.slug</span>
 *           </button>
 *         </li>
 *       </ul>
 *     </div>
 *     <div data-severity-group="warning"> ... </div>
 *     <div data-severity-group="info"> ... </div>
 *   </section>
 *
 * Empty groups still render their `data-severity-group` wrapper so the
 * three-tier structure stays stable even when one tier is empty (this is
 * what the "renders three distinct severity groups" test asserts).
 */
import type { JSX } from "preact";
import type { ValidationIssue, ValidationResult } from "@sosb/schema";
import { pathToDotted } from "./issue-navigate.js";

export interface SiteHealthPanelProps {
  readonly result: ValidationResult;
  readonly onJump: (issue: ValidationIssue) => void;
}

const GROUP_LABEL: Record<"error" | "warning" | "info", string> = {
  error: "Errors",
  warning: "Warnings",
  info: "Info",
};

export function SiteHealthPanel({ result, onJump }: SiteHealthPanelProps): JSX.Element {
  const totalIssues =
    result.errors.length + result.warnings.length + result.info.length;

  return (
    <section data-testid="site-health-panel" aria-label="Site health">
      <h2>Site health</h2>
      {totalIssues === 0 ? <p data-testid="site-health-empty">No issues — all clear.</p> : null}
      <IssueGroup severity="error" issues={result.errors} onJump={onJump} />
      <IssueGroup severity="warning" issues={result.warnings} onJump={onJump} />
      <IssueGroup severity="info" issues={result.info} onJump={onJump} />
    </section>
  );
}

interface IssueGroupProps {
  readonly severity: "error" | "warning" | "info";
  readonly issues: readonly ValidationIssue[];
  readonly onJump: (issue: ValidationIssue) => void;
}

function IssueGroup({ severity, issues, onJump }: IssueGroupProps): JSX.Element {
  const label = GROUP_LABEL[severity];
  const headingId = `site-health-group-${severity}`;
  return (
    <div data-severity-group={severity}>
      <h3 id={headingId}>
        {label} <span data-group-count>({issues.length})</span>
      </h3>
      {issues.length === 0 ? (
        <p data-empty-group={severity}>No {label.toLowerCase()}.</p>
      ) : (
        <ul aria-labelledby={headingId}>
          {issues.map((issue, idx) => (
            <li key={`${severity}-${idx}-${issue.code}`}>
              <IssueRow severity={severity} issue={issue} onJump={onJump} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface IssueRowProps {
  readonly severity: "error" | "warning" | "info";
  readonly issue: ValidationIssue;
  readonly onJump: (issue: ValidationIssue) => void;
}

function IssueRow({ severity, issue, onJump }: IssueRowProps): JSX.Element {
  const dotted = pathToDotted(issue.path);
  return (
    <button
      type="button"
      data-issue
      data-severity={severity}
      data-path={dotted}
      data-code={issue.code}
      onClick={() => onJump(issue)}
    >
      <span data-issue-message>{issue.message}</span>
      <span data-issue-path>
        {" "}
        {dotted === "" ? "(site)" : dotted}
      </span>
    </button>
  );
}
