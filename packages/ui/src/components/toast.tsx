/** @jsxImportSource react */
/**
 * Toast — shadcn-shaped composition over Base UI's Toast.
 *
 * The builder's transient messages (save status, import errors) are
 * currently inline banners. This primitive is here so those surfaces have a
 * shared, accessible home to move to: Base UI handles the live region,
 * priority, timeout and focus behaviour that a hand-rolled banner does not.
 *
 * Mount `<ToastProvider>` once per shell and call `useToast().add({...})`.
 */
import { Toast as BaseToast } from "@base-ui-components/react/toast";
import { forwardRef } from "react";

import { cn } from "../lib/cn.js";

export const ToastProvider = BaseToast.Provider;
export const useToast = BaseToast.useToastManager;

/**
 * Thin wrapper rather than a re-export: Base UI's portal type is only
 * nameable through a deep internal path, which `declaration: true` cannot
 * emit portably. Wrapping gives the declaration a local, stable type.
 */
export type ToastPortalProps = React.ComponentPropsWithoutRef<typeof BaseToast.Portal>;

export function ToastPortal(props: ToastPortalProps): React.ReactElement {
  return <BaseToast.Portal {...props} />;
}

export type ToastViewportProps = React.ComponentPropsWithoutRef<typeof BaseToast.Viewport>;

export const ToastViewport = forwardRef<HTMLDivElement, ToastViewportProps>(function ToastViewport(
  { className, ...rest },
  ref,
) {
  return (
    <BaseToast.Viewport
      ref={ref}
      data-sosb-ui=""
      data-sosb-ui-portal=""
      className={cn("fixed right-4 bottom-4 z-90 flex w-80 flex-col gap-2", className)}
      {...rest}
    />
  );
});

export type ToastRootProps = React.ComponentPropsWithoutRef<typeof BaseToast.Root>;

export const ToastRoot = forwardRef<HTMLDivElement, ToastRootProps>(function ToastRoot(
  { className, ...rest },
  ref,
) {
  return (
    <BaseToast.Root
      ref={ref}
      data-sosb-ui=""
      className={cn(
        "rounded-(--radius-sosb-md) border border-border bg-card p-3 text-sm text-card-foreground shadow-lg",
        className,
      )}
      {...rest}
    />
  );
});

export const ToastTitle = BaseToast.Title;
export const ToastDescription = BaseToast.Description;
export const ToastClose = BaseToast.Close;

export const Toast = {
  Provider: ToastProvider,
  Portal: ToastPortal,
  Viewport: ToastViewport,
  Root: ToastRoot,
  Title: ToastTitle,
  Description: ToastDescription,
  Close: ToastClose,
};
