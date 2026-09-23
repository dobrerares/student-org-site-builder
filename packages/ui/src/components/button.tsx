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
  [
    "inline-flex items-center justify-center gap-2 rounded-(--radius-sosb-md)",
    "font-medium whitespace-nowrap transition-colors",
    "disabled:pointer-events-none disabled:opacity-55",
    // `data-tone="danger"` is how the editor marks destructive row actions
    // (remove a Block, delete a Page). It used to be styled by the editor's
    // own sheet, which now sits in a lower layer than these utilities — so
    // the tone has to be expressed here or the red would simply be lost.
    // The attribute selector also out-specifies the variant's own colour,
    // which is what lets one attribute re-tone any variant.
    "data-[tone=danger]:text-destructive",
    "data-[tone=danger]:hover:bg-destructive/10",
    "data-[tone=danger]:hover:text-destructive",
    "data-[tone=accent]:text-primary",
    "data-[tone=accent]:hover:bg-primary-soft",
    "data-[tone=accent]:hover:text-primary",
  ].join(" "),
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
        // One control system (issue #102): 36px standard, 28px compact.
        sm: "h-7 gap-1.5 px-2.5 text-(length:--sosb-text-sm)",
        md: "h-9 px-3.5 text-(length:--sosb-text-body)",
        lg: "h-11 px-5 text-(length:--sosb-text-lg)",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-7 w-7 p-0",
      },
    },
    // The prototype's resting button is a white card with a hairline border,
    // not a grey fill — the grey one is reserved for controls that sit on
    // white and need to read as recessed.
    defaultVariants: { variant: "outline", size: "md" },
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
