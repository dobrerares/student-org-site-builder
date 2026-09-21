/** @jsxImportSource react */
/**
 * Popover — shadcn-shaped composition over Base UI's Popover.
 *
 * Positioning, outside-click dismissal, Escape and focus return come from
 * Base UI. The builder supplies the surface styling and the
 * `data-sosb-ui-portal` stacking hook so a popover opened from inside the
 * editor's scrolling inspector still paints above the preview pane.
 */
import { Popover as BasePopover } from "@base-ui-components/react/popover";
import { forwardRef } from "react";

import { cn } from "../lib/cn.js";

export const PopoverRoot = BasePopover.Root;
export const PopoverTrigger = BasePopover.Trigger;
export const PopoverPortal = BasePopover.Portal;
export const PopoverClose = BasePopover.Close;

export type PopoverPositionerProps = React.ComponentPropsWithoutRef<typeof BasePopover.Positioner>;

export const PopoverPositioner = forwardRef<HTMLDivElement, PopoverPositionerProps>(
  function PopoverPositioner({ className, sideOffset, ...rest }, ref) {
    return (
      <BasePopover.Positioner
        ref={ref}
        data-sosb-ui-portal=""
        sideOffset={sideOffset ?? 6}
        className={cn("z-80", className)}
        {...rest}
      />
    );
  },
);

export type PopoverPopupProps = React.ComponentPropsWithoutRef<typeof BasePopover.Popup>;

export const PopoverPopup = forwardRef<HTMLDivElement, PopoverPopupProps>(function PopoverPopup(
  { className, ...rest },
  ref,
) {
  return (
    <BasePopover.Popup
      ref={ref}
      data-sosb-ui=""
      className={cn(
        "min-w-52 rounded-(--radius-sosb-md) border border-border bg-popover p-3 text-sm text-popover-foreground shadow-xl",
        className,
      )}
      {...rest}
    />
  );
});

export const Popover = {
  Root: PopoverRoot,
  Trigger: PopoverTrigger,
  Portal: PopoverPortal,
  Positioner: PopoverPositioner,
  Popup: PopoverPopup,
  Close: PopoverClose,
};
