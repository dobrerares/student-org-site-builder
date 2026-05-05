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
  return (
    <footer data-testid="health-footer">
      <button
        type="button"
        data-testid="health-footer-toggle"
        aria-controls="site-health-panel"
        aria-expanded={expanded ? "true" : "false"}
        onClick={() => onToggle()}
      >
        <span data-count="error">{pluralize(result.errors.length, "error")}</span>
        {", "}
        <span data-count="warning">{pluralize(result.warnings.length, "warning")}</span>
        {", "}
        <span data-count="info">{result.info.length} info</span>
      </button>
    </footer>
  );
}
