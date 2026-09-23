/** @jsxImportSource react */
/**
 * FindingList — validation issues as actionable rows.
 *
 * Issue #102's fourth round fixes the shape: the problem and its repair action
 * stay visible, and only the longer explanation hides behind an (i). This is
 * the one list used by both the Overview's Site Health card and the export
 * readiness panel, so a problem reads identically wherever the author meets it.
 *
 * "Blocks exporting" is `ValidationIssue.blocking`, not `severity === "error"`.
 * ADR 0016's rule is that ordinary errors are overridable with a high-friction
 * confirmation and never hard-block; ADR 0048 carves out the narrow set of
 * problems that genuinely cannot produce a correct file. Saying "blocks
 * exporting" about an overridable error would be a lie the author discovers
 * one screen later.
 */
import type { JSX } from "react";
import type { ValidationIssue } from "@sosb/schema";
import { Button } from "@sosb/ui";

import { issuePathLabel } from "./field-labels.js";
import { pathToDotted } from "./issue-navigate.js";
import { InfoHint } from "./info-hint.js";
import { useTranslator } from "./i18n-context.js";

export interface FindingListProps {
  readonly issues: readonly ValidationIssue[];
  /** Open the destination that owns this issue, ready to repair it. */
  readonly onFix: (issue: ValidationIssue) => void;
  /** Shown when there is nothing to report. */
  readonly emptyText?: string;
  readonly testId?: string;
}

export function FindingList(props: FindingListProps): JSX.Element {
  const t = useTranslator();

  if (props.issues.length === 0) {
    return (
      <p data-testid={props.testId ?? "finding-list-empty"} data-finding-empty>
        {props.emptyText ?? t("overview.health.empty")}
      </p>
    );
  }

  return (
    <ul data-testid={props.testId ?? "finding-list"} data-finding-list>
      {props.issues.map((issue, index) => {
        const blocking = issue.blocking === true;
        const dotted = pathToDotted(issue.path);
        const location = issuePathLabel(issue.path);
        return (
          <li
            key={`${issue.code}-${dotted}-${index}`}
            data-finding
            data-severity={issue.severity}
            data-blocking={blocking ? "true" : "false"}
            data-code={issue.code}
            data-path={dotted}
          >
            <span data-finding-icon aria-hidden="true" />
            <div data-finding-body>
              <span data-finding-message>
                <strong>{issue.message}</strong>
                <InfoHint
                  label={t("overview.finding.info.label")}
                  text={location}
                  testId="finding-info"
                />
              </span>
              <span data-finding-meta>
                {blocking ? t("overview.finding.blocks") : t("overview.finding.noBlock")}
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              data-testid="finding-fix"
              // The location is what makes this button's name unique — a
              // column of identical "Fix" buttons is unusable by voice or
              // screen reader.
              aria-label={`${t("overview.finding.fix")} — ${location}`}
              onClick={() => props.onFix(issue)}
            >
              {t("overview.finding.fix")}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
