/** @jsxImportSource react */
/**
 * Select — shadcn-shaped composition over Base UI's Select (a listbox, not
 * a native `<select>`).
 *
 * Use this where a choice needs richer item rendering than an `<option>`
 * allows — theme swatches, font previews. For plain value lists the builder
 * keeps `NativeSelect`: schema-generated forms drive it with
 * `fireEvent.change`, and the platform picker is the better experience on
 * touch devices.
 */
import { Select as BaseSelect } from "@base-ui-components/react/select";
import { forwardRef } from "react";

import { cn } from "../lib/cn.js";

export const SelectRoot = BaseSelect.Root;
export const SelectValue = BaseSelect.Value;
export const SelectPortal = BaseSelect.Portal;
export const SelectItemText = BaseSelect.ItemText;
export const SelectGroup = BaseSelect.Group;
export const SelectGroupLabel = BaseSelect.GroupLabel;

export type SelectTriggerProps = React.ComponentPropsWithoutRef<typeof BaseSelect.Trigger>;

export const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  function SelectTrigger({ className, ...rest }, ref) {
    return (
      <BaseSelect.Trigger
        ref={ref}
        data-sosb-ui=""
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-(--radius-sosb-sm) border border-input bg-card px-2.5 text-sm text-foreground",
          className,
        )}
        {...rest}
      />
    );
  },
);

export type SelectPositionerProps = React.ComponentPropsWithoutRef<typeof BaseSelect.Positioner>;

export const SelectPositioner = forwardRef<HTMLDivElement, SelectPositionerProps>(
  function SelectPositioner({ className, sideOffset, ...rest }, ref) {
    return (
      <BaseSelect.Positioner
        ref={ref}
        data-sosb-ui-portal=""
        sideOffset={sideOffset ?? 4}
        className={cn("z-80", className)}
        {...rest}
      />
    );
  },
);

export type SelectPopupProps = React.ComponentPropsWithoutRef<typeof BaseSelect.Popup>;

export const SelectPopup = forwardRef<HTMLDivElement, SelectPopupProps>(function SelectPopup(
  { className, ...rest },
  ref,
) {
  return (
    <BaseSelect.Popup
      ref={ref}
      data-sosb-ui=""
      className={cn(
        "max-h-72 min-w-[var(--anchor-width)] overflow-auto rounded-(--radius-sosb-md) border border-border bg-popover p-1 text-popover-foreground shadow-xl",
        className,
      )}
      {...rest}
    />
  );
});

export type SelectItemProps = React.ComponentPropsWithoutRef<typeof BaseSelect.Item>;

export const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(function SelectItem(
  { className, ...rest },
  ref,
) {
  return (
    <BaseSelect.Item
      ref={ref}
      data-sosb-ui=""
      className={cn(
        "cursor-pointer rounded-(--radius-sosb-sm) px-2.5 py-1.5 text-sm data-[highlighted]:bg-secondary data-[selected]:font-medium",
        className,
      )}
      {...rest}
    />
  );
});

export const Select = {
  Root: SelectRoot,
  Trigger: SelectTrigger,
  Value: SelectValue,
  Portal: SelectPortal,
  Positioner: SelectPositioner,
  Popup: SelectPopup,
  Item: SelectItem,
  ItemText: SelectItemText,
  Group: SelectGroup,
  GroupLabel: SelectGroupLabel,
};
