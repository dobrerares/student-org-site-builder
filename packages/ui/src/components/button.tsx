/** @jsxImportSource react */
/**
 * Button — the shared builder action control.
 *
 * Renders a plain `<button>` and forwards every prop it is given. That is
 * deliberate: the editor, Wizard and welcome shells identify their controls
 * with `data-action`, `data-testid` and `data-icon-button` attributes, and
 * their hand-written stylesheets hang off those same attributes. Swapping a
 * bare `<button>` for `<Button>` must therefore change nothing about the
 * emitted DOM except the added `class` and the `data-sosb-ui` marker that
 * scopes the shared reset.
 *
 * `data-sosb-ui` is how the builder stylesheet opts an element into its
 * reset without a global preflight (see `src/styles/builder.css`).
 */
import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn.js";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-(--radius-sosb-md) font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-55",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-card text-foreground hover:bg-secondary",
        ghost: "text-foreground hover:bg-secondary",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        sm: "h-8 px-2.5 text-[0.8125rem]",
        md: "h-9 px-3.5 text-sm",
        lg: "h-11 px-5 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      // Default to `type="button"`: an un-typed button inside a `<form>`
      // submits it, which has bitten every hand-rolled control in this repo
      // at least once.
      type={type ?? "button"}
      data-sosb-ui=""
      className={cn(buttonVariants({ variant, size }), className)}
      {...rest}
    />
  );
});
