/**
 * MoreOptions — the collapsible "More options" section that closes each
 * generated form (ADR 0043 progressive disclosure, revised).
 *
 * Replaces the old free-floating "Show expert options" checkbox. The
 * difference is *where* the extra fields show up: the section is a real
 * container, so opening it reveals its fields directly beneath the
 * button, and the collapsed state lists what is inside so nobody has to
 * open it just to find out.
 *
 * Still intentionally:
 *  - **per-form-instance**: state lives in the consuming form's
 *    `useState`, so a freshly mounted form starts collapsed.
 *  - **session-scoped**: nothing persisted. The target audience is
 *    yearly-rotating leadership; an inherited always-open editor would
 *    be a foot-gun.
 *  - **absent when empty**: forms with no advanced fields render no
 *    section at all (the consuming form checks this).
 */
import type { ComponentChildren, JSX } from "preact";
import { useId } from "preact/hooks";

import { IconChevronRight } from "./icons.js";
import { summarizeLabels } from "./field-tiers.js";

export interface MoreOptionsProps {
  /** `true` when the section is expanded. */
  readonly open: boolean;
  /** Called with the next open state when the user clicks the header. */
  readonly onToggle: (next: boolean) => void;
  /** Friendly names of the fields inside, shown in the collapsed summary. */
  readonly labels: readonly string[];
  /** The rendered advanced fields. Only mounted while `open`. */
  readonly children?: ComponentChildren;
}

export function MoreOptions({ open, onToggle, labels, children }: MoreOptionsProps): JSX.Element {
  const panelId = useId();
  const summary = summarizeLabels(labels);
  return (
    <section data-testid="more-options" data-more-options data-open={open}>
      <button
        type="button"
        data-testid="advanced-toggle"
        data-more-options-toggle
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onToggle(!open)}
      >
        <span data-more-options-chevron aria-hidden="true">
          <IconChevronRight size={16} />
        </span>
        <span data-more-options-text>
          <span data-more-options-title>{open ? "Hide more options" : "More options"}</span>
          <small data-more-options-summary>
            {open
              ? "These rarely need changing. Sensible values are already filled in."
              : summary.length > 0
                ? `${summary}. Rarely needed — sensible values are already filled in.`
                : "Rarely needed — sensible values are already filled in."}
          </small>
        </span>
      </button>
      {open ? (
        <div id={panelId} data-testid="more-options-panel" data-more-options-panel>
          {children}
        </div>
      ) : null}
    </section>
  );
}
