/**
 * Health footer — a thin always-visible band at the bottom of the editor
 * showing aggregate counts (e.g. "3 errors, 7 warnings, 2 info"). Clicking
 * the footer toggles the Site Health panel.
 *
 * Markup contract:
 *
 *   <footer data-testid="health-footer">
 *     <button
 *       data-testid="health-footer-toggle"
 *       aria-controls="site-health-panel"
 *       aria-expanded="false"
 *     >
 *       <span data-count="error">3 errors</span>
 *       <span data-count="warning">7 warnings</span>
 *       <span data-count="info">2 info</span>
 *     </button>
 *   </footer>
 *
 * The `aria-controls`/`aria-expanded` wiring is what assistive tech relies
 * on for the disclosure pattern; the editor shell flips `expanded` when it
 * mounts the panel.
 */
import type { JSX } from "preact";
import type { ValidationResult } from "@sosb/schema";

import { IconCheck, IconChevronUp } from "./icons.js";

export interface HealthFooterProps {
  readonly result: ValidationResult;
  readonly onToggle: () => void;
  /** Whether the panel is currently shown. Drives `aria-expanded`. */
  readonly expanded?: boolean;
}

function pluralize(n: number, singular: string, plural?: string): string {
  if (n === 1) return `${n} ${singular}`;
  return `${n} ${plural ?? `${singular}s`}`;
}

export function HealthFooter({
  result,
  onToggle,
  expanded = false,
}: HealthFooterProps): JSX.Element {
  const errors = result.errors.length;
  const warnings = result.warnings.length;
  const info = result.info.length;
  const allClear = errors === 0 && warnings === 0;
  const tone = errors > 0 ? "error" : warnings > 0 ? "warning" : "ok";

  return (
    <footer data-testid="health-footer" data-tone={tone}>
      <button
        type="button"
        data-testid="health-footer-toggle"
        aria-controls="site-health-panel"
        aria-expanded={expanded ? "true" : "false"}
        onClick={() => onToggle()}
      >
        <span data-health-summary>
          {allClear ? <IconCheck size={14} /> : null}
          <span data-health-title>{allClear ? "Site check: all good" : "Site check"}</span>
        </span>
        <span data-health-counts>
          <span data-count="error" data-zero={errors === 0}>
            {pluralize(errors, "error")}
          </span>
          <span data-count="warning" data-zero={warnings === 0}>
            {pluralize(warnings, "warning")}
          </span>
          <span data-count="info" data-zero={info === 0}>
            {info} info
          </span>
        </span>
        <span data-health-chevron>
          <IconChevronUp size={14} />
        </span>
      </button>
    </footer>
  );
}
