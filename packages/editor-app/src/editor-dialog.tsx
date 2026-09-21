/** @jsxImportSource react */
/**
 * EditorDialog — the editor's adapter over `@sosb/ui`'s Base UI dialog.
 *
 * Both of the editor's modals (Add block, pre-export confirmation) used to
 * be hand-rolled: a `data-dialog-backdrop` div, a `role="dialog"` div and a
 * local `keydown` handler. That markup had no focus trap, did not return
 * focus to whatever opened it, and left the rest of the page reachable by
 * Tab. Base UI supplies all three.
 *
 * Two deliberate adaptations:
 *
 *  - **Portal target.** Base UI portals to `<body>`. The editor mounts into
 *    a host-provided root (browser shell, Electron renderer, the archival
 *    single-file page), and its unit tests query inside the render
 *    container. So the dialog renders its own portal host as a child of the
 *    editor tree and points Base UI at it. The overlay is still positioned
 *    `fixed`, so it covers the viewport either way.
 *  - **Style hooks preserved.** The backdrop keeps `data-dialog-backdrop`
 *    and the popup keeps whatever `data-testid` / `data-tone` the caller
 *    passes, so the editor stylesheet and the existing tests are unaffected.
 *
 * Closed state renders nothing but the (empty) portal host, matching the
 * previous `return null`.
 */
import type { JSX, ReactNode } from "react";
import { useRef } from "react";
import { Dialog } from "@sosb/ui";

export interface EditorDialogProps {
  /** When `false`, no dialog content is rendered. */
  readonly open: boolean;
  /** Called when the user dismisses (Escape, backdrop click, close button). */
  readonly onClose: () => void;
  /** `data-testid` for the popup element. */
  readonly testId: string;
  /** Accessible name, when the dialog has no `<Dialog.Title>` child. */
  readonly label?: string;
  /** Id of the element labelling the dialog. */
  readonly labelledBy?: string;
  /** Id of the element describing the dialog. */
  readonly describedBy?: string;
  /**
   * Severity hook the editor stylesheet reads (`data-tone`). The union is
   * closed on purpose: `editor-app-css.ts` only has rules for these two,
   * so any other value would be a silently ineffective attribute.
   */
  readonly tone?: "error" | "warning";
  /**
   * Element to focus on open. Without it Base UI focuses the first
   * tabbable element, which is the right default for most dialogs.
   */
  readonly initialFocus?: React.RefObject<HTMLElement | null>;
  readonly children?: ReactNode;
}

export function EditorDialog(props: EditorDialogProps): JSX.Element {
  const portalHostRef = useRef<HTMLDivElement | null>(null);

  return (
    <div ref={portalHostRef} data-dialog-host>
      <Dialog.Root
        open={props.open}
        onOpenChange={(open) => {
          if (!open) props.onClose();
        }}
      >
        <Dialog.Portal container={portalHostRef}>
          <Dialog.Backdrop data-testid="dialog-backdrop" />
          <Dialog.Popup
            data-testid={props.testId}
            // Base UI relies on the focus trap plus `inert` siblings rather
            // than `aria-modal`. The editor's existing contract (and its
            // tests) expect the attribute, and it costs nothing, so it is
            // set explicitly here.
            aria-modal="true"
            {...(props.tone === undefined ? {} : { "data-tone": props.tone })}
            {...(props.label === undefined ? {} : { "aria-label": props.label })}
            {...(props.labelledBy === undefined ? {} : { "aria-labelledby": props.labelledBy })}
            {...(props.describedBy === undefined ? {} : { "aria-describedby": props.describedBy })}
            {...(props.initialFocus === undefined ? {} : { initialFocus: props.initialFocus })}
          >
            {props.children}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
