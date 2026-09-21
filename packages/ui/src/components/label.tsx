/** @jsxImportSource react */
/**
 * Label and Hint — the two text parts of a form field.
 *
 * `Hint` is advisory copy only (never validation); the editor's
 * `FieldHint` wraps it so the `field-hint` class the editor stylesheet
 * already targets is preserved.
 */
import { forwardRef } from "react";

import { cn } from "../lib/cn.js";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, ...rest },
  ref,
) {
  return (
    <label
      ref={ref}
      data-sosb-ui=""
      className={cn("text-sm leading-tight font-medium text-foreground", className)}
      {...rest}
    />
  );
});

export type HintProps = React.HTMLAttributes<HTMLParagraphElement>;

export const Hint = forwardRef<HTMLParagraphElement, HintProps>(function Hint(
  { className, ...rest },
  ref,
) {
  return (
    <p
      ref={ref}
      data-sosb-ui=""
      className={cn("text-[0.8125rem] leading-snug text-muted-foreground", className)}
      {...rest}
    />
  );
});
