/** @jsxImportSource react */
/**
 * InfoHint — a small (i) button that reveals an explanation on demand.
 *
 * Issue #102's third interview round made this a global presentation rule:
 * explanatory help belongs behind an openable information icon rather than
 * sitting on screen as persistent prose. The distinction from `FieldHint`
 * matters and is worth keeping straight:
 *
 *  - **`FieldHint`** is a short always-visible nudge attached to a field
 *    ("keep this under a line"). It is part of reading the form.
 *  - **`InfoHint`** is the longer "what does this actually mean" explanation —
 *    publication states, any-tag matching, what export does and does not do.
 *    Leaving those on screen turns a simple form into a wall of text for the
 *    ninety-nine percent of visits where the author already knows.
 *
 * Base UI's Popover supplies the behaviours the round required: pointer, touch
 * and keyboard activation, Escape to close, outside-tap to close, and focus
 * returning to the trigger afterwards. The button carries a real accessible
 * name because the icon itself is decorative.
 */
import type { JSX } from "react";
import { Popover } from "@sosb/ui";
import { IconInfo } from "./icons.js";

export interface InfoHintProps {
  /** Accessible name for the trigger, e.g. "About publication status". */
  readonly label: string;
  /** The explanation shown when the popover opens. */
  readonly text: string;
  /** Test hook, so specs can target one hint among several on a form. */
  readonly testId?: string;
}

export function InfoHint(props: InfoHintProps): JSX.Element {
  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <button
            type="button"
            className="info-hint__trigger"
            data-icon-button
            data-testid={props.testId ?? "info-hint"}
            aria-label={props.label}
          >
            <IconInfo size={14} />
          </button>
        }
      />
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup className="info-hint__popup" data-testid="info-hint-popup">
            {props.text}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
