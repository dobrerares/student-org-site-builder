/** @jsxImportSource react */
/**
 * ExportReadinessPanel — what "Export website" opens.
 *
 * Issue #102's third round replaces the old pre-export confirmation with a
 * readiness panel: the problems that stop an export, listed with a repair
 * action that takes you to them; the warnings that do not, listed separately;
 * an (i) explaining that exporting does not update the live website; and the
 * export button itself.
 *
 * The three-way gate mirrors the schema's own semantics rather than inventing
 * a new one:
 *
 *  - `blocking` errors (ADR 0048 — public content that cannot be produced
 *    correctly at all, such as a list pointing at a Draft) disable the export
 *    button outright. There is no override because there is no correct file
 *    to write.
 *  - ordinary errors keep ADR 0016's high-friction override: type the phrase
 *    and the export proceeds. Silently hard-blocking these would break the
 *    PRD's "never hard-block" rule.
 *  - warnings never gate anything.
 *
 * Saving the editable project is deliberately unaffected in all three cases,
 * and the panel says so.
 */
import type { JSX } from "react";
import type * as React from "react";
import { useEffect, useState } from "react";
import type { ValidationIssue, ValidationResult } from "@sosb/schema";
import { hasBlockingIssues } from "@sosb/schema";
import { Button, Input } from "@sosb/ui";

import { EditorDialog } from "./editor-dialog.js";
import { FindingList } from "./findings-list.js";
import { InfoHint } from "./info-hint.js";
import { useTranslator } from "./i18n-context.js";

const CONFIRM_PHRASE = "DOWNLOAD";

export interface ExportReadinessPanelProps {
  readonly open: boolean;
  readonly result: ValidationResult;
  readonly onClose: () => void;
  /** Run the export. Only reachable when the gate above allows it. */
  readonly onExport: () => void;
  /** Open the destination owning an issue, closing the panel on the way. */
  readonly onFix: (issue: ValidationIssue) => void;
}

export function ExportReadinessPanel(props: ExportReadinessPanelProps): JSX.Element {
  const t = useTranslator();
  const [phrase, setPhrase] = useState("");
  // The gate starts over every time the panel opens. The old confirmation
  // dialog got this for free by being unmounted on cancel; this panel stays
  // mounted, so a phrase typed and then abandoned must be cleared by hand.
  useEffect(() => {
    if (!props.open) setPhrase("");
  }, [props.open]);

  const blocked = hasBlockingIssues(props.result);
  const errors = props.result.errors;
  const warnings = props.result.warnings;
  const hasErrors = errors.length > 0;
  const needsOverride = hasErrors && !blocked;
  const canExport = blocked ? false : needsOverride ? phrase === CONFIRM_PHRASE : true;

  const headingId = "export-readiness-heading";

  return (
    <EditorDialog
      open={props.open}
      onClose={props.onClose}
      testId="export-readiness"
      labelledBy={headingId}
      // Spread rather than a ternary ending in `undefined`: the repo runs
      // with `exactOptionalPropertyTypes`, under which an explicit
      // `undefined` is not the same as an absent optional prop.
      {...(hasErrors
        ? { tone: "error" as const }
        : warnings.length > 0
          ? { tone: "warning" as const }
          : {})}
    >
      <>
        <h2 id={headingId}>
          {t("export.title")}
          <InfoHint label={t("export.info.label")} text={t("export.info")} testId="export-info" />
        </h2>

        {hasErrors ? (
          <section data-export-group="blockers">
            <h3>{t("export.blockers", { count: errors.length })}</h3>
            {blocked && <p data-testid="export-blocked-note">{t("export.blocked.note")}</p>}
            <FindingList issues={errors} onFix={props.onFix} testId="export-blockers" />
          </section>
        ) : (
          <div data-finding data-severity="ok" data-testid="export-ready">
            <span data-finding-icon aria-hidden="true" />
            <div data-finding-body>
              <strong>{t("export.ready")}</strong>
              <span data-finding-meta>{t("export.ready.detail")}</span>
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <section data-export-group="warnings">
            <h3>
              {t("export.warnings", { count: warnings.length })}
              <InfoHint
                label={t("export.warnings", { count: warnings.length })}
                text={t("export.warnings.info")}
                testId="export-warnings-info"
              />
            </h3>
            <FindingList issues={warnings} onFix={props.onFix} testId="export-warnings" />
          </section>
        )}

        {needsOverride && (
          <label data-testid="export-override-label">
            <span>
              {/* The phrase is a literal the user must reproduce, so it is
                  interpolated rather than translated. */}
              {t("export.override.label", { phrase: CONFIRM_PHRASE })}
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
            <span data-export-override-hint>{t("export.override.hint")}</span>
          </label>
        )}

        <div data-testid="export-readiness-actions" data-dialog-actions>
          <Button type="button" data-testid="export-cancel-button" onClick={props.onClose}>
            {t("export.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            data-testid="export-confirm-button"
            data-blocked={blocked ? "true" : "false"}
            disabled={!canExport}
            onClick={() => {
              if (canExport) props.onExport();
            }}
          >
            {t("export.action")}
          </Button>
        </div>
      </>
    </EditorDialog>
  );
}
