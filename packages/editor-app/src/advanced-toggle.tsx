/**
 * AdvancedToggle — per-form "Show advanced" checkbox (ADR 0043 + CONTEXT.md).
 *
 * Reveals fields whose `FieldNode.tier === "advanced"`. Fields with
 * `tier === "hidden"` are NEVER rendered (the toggle has no effect on
 * them — that's a separate concern, owned by the consuming form).
 *
 * The toggle is intentionally:
 *  - **per-form-instance**: each consuming form owns its own `useState`
 *    cell. Mounting a second form starts hidden again.
 *  - **session-scoped**: no localStorage, no persistence. Target audience
 *    is yearly-rotating non-technical leadership; an inherited
 *    already-toggled-on editor would be a foot-gun.
 *  - **not wired into the wizard**: the wizard has its own bespoke
 *    happy-path UI (ADR 0041) and does not consume this component.
 *
 * The component is deliberately tiny: state lives in the parent form,
 * not here. This keeps each form's "advanced revealed" flag independent
 * across mounts.
 */
import type { JSX } from "preact";

export interface AdvancedToggleProps {
  /** Current toggle state — `true` means advanced fields are revealed. */
  readonly value: boolean;
  /** Called with the new boolean state when the user flips the toggle. */
  readonly onChange: (next: boolean) => void;
}

export function AdvancedToggle({ value, onChange }: AdvancedToggleProps): JSX.Element {
  return (
    <label data-testid="advanced-toggle" class="advanced-toggle">
      <input
        type="checkbox"
        checked={value}
        aria-label="Show expert options"
        onChange={(event: JSX.TargetedEvent<HTMLInputElement>) => {
          onChange(event.currentTarget.checked);
        }}
      />
      <span>Show expert options</span>
    </label>
  );
}
