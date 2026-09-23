/** @jsxImportSource react */
/**
 * Dialog — shadcn-shaped composition over Base UI's Dialog.
 *
 * Base UI supplies what the builder's hand-rolled dialogs never had: a
 * focus trap, focus return to the trigger on close, `aria-modal` wiring,
 * scroll locking and Escape handling. The issue #101 evidence list calls
 * for "dialog/popover focus entry and return, keyboard operation" — that is
 * the reason this primitive exists rather than another bespoke overlay.
 *
 * Two builder-specific affordances:
 *
 *  - `container`: Base UI portals to `<body>` by default. The editor's unit
 *    tests query inside the render container, and the archival build runs
 *    inside a single mounted root, so callers can pin the portal to a node
 *    they control.
 *  - The parts keep the existing `data-dialog-backdrop` / `data-icon-button`
 *    style hooks so the editor stylesheet continues to apply.
 */
import { Dialog as BaseDialog } from "@base-ui-components/react/dialog";
import { forwardRef } from "react";

import { cn } from "../lib/cn.js";

export const DialogRoot = BaseDialog.Root;
export const DialogTrigger = BaseDialog.Trigger;
export const DialogClose = BaseDialog.Close;
export const DialogPortal = BaseDialog.Portal;

export type DialogBackdropProps = React.ComponentPropsWithoutRef<typeof BaseDialog.Backdrop>;

export const DialogBackdrop = forwardRef<HTMLDivElement, DialogBackdropProps>(
  function DialogBackdrop({ className, ...rest }, ref) {
    return (
      <BaseDialog.Backdrop
        ref={ref}
        data-sosb-ui=""
        data-dialog-backdrop=""
        className={cn("fixed inset-0 z-70 bg-black/45", className)}
        {...rest}
      />
    );
  },
);

export type DialogPopupProps = React.ComponentPropsWithoutRef<typeof BaseDialog.Popup>;

export const DialogPopup = forwardRef<HTMLDivElement, DialogPopupProps>(function DialogPopup(
  { className, ...rest },
  ref,
) {
  return (
    <BaseDialog.Popup
      ref={ref}
      data-sosb-ui=""
      className={cn(
        "fixed top-1/2 left-1/2 z-80 flex max-h-[85vh] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-auto rounded-(--radius-sosb-lg) border border-border bg-card p-5 text-card-foreground shadow-2xl",
        // Phones dock the dialog to the bottom of the screen instead of
        // centring it: a thumb reaches the bottom, not the middle. Stated
        // here rather than in the editor stylesheet because these utilities
        // outrank it (issue #102's layer order), so an override there loses.
        "max-md:top-auto max-md:right-2 max-md:bottom-2 max-md:left-2 max-md:w-auto max-md:max-h-[92vh] max-md:translate-none max-md:p-3",
        className,
      )}
      {...rest}
    />
  );
});

export type DialogTitleProps = React.ComponentPropsWithoutRef<typeof BaseDialog.Title>;

export const DialogTitle = forwardRef<HTMLHeadingElement, DialogTitleProps>(function DialogTitle(
  { className, ...rest },
  ref,
) {
  return (
    <BaseDialog.Title
      ref={ref}
      data-sosb-ui=""
      className={cn("m-0 text-lg leading-tight font-semibold", className)}
      {...rest}
    />
  );
});

export type DialogDescriptionProps = React.ComponentPropsWithoutRef<typeof BaseDialog.Description>;

export const DialogDescription = forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  function DialogDescription({ className, ...rest }, ref) {
    return (
      <BaseDialog.Description
        ref={ref}
        data-sosb-ui=""
        className={cn("m-0 text-sm text-muted-foreground", className)}
        {...rest}
      />
    );
  },
);

export const Dialog = {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Portal: DialogPortal,
  Backdrop: DialogBackdrop,
  Popup: DialogPopup,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: DialogClose,
};
