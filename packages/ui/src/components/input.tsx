/** @jsxImportSource react */
/**
 * Input / Textarea — shared text entry controls.
 *
 * Both render the native element and forward every prop. Native file
 * inputs stay native on purpose (ADR 0044 and the issue #101 contract:
 * "retain specialized native interactions such as file selection"); pass
 * `type="file"` and you get a real `<input type="file">` with the shared
 * focus ring and nothing else layered on top.
 */
import { forwardRef } from "react";

import { cn } from "../lib/cn.js";

const FIELD_BASE =
  "w-full rounded-(--radius-sosb-sm) border border-input bg-card px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} data-sosb-ui="" className={cn(FIELD_BASE, className)} {...rest} />;
});

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      data-sosb-ui=""
      className={cn(FIELD_BASE, "min-h-20 resize-y", className)}
      {...rest}
    />
  );
});

/**
 * NativeSelect — a real `<select>`.
 *
 * The builder keeps native selects for the schema-generated forms: they are
 * the only control that behaves correctly with the platform's own picker on
 * touch devices, and every existing test drives them with
 * `fireEvent.change`. `Select` (Base UI) exists alongside it for the richer
 * cases where a listbox needs custom item rendering.
 */
export type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(function NativeSelect(
  { className, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      data-sosb-ui=""
      className={cn(FIELD_BASE, "cursor-pointer pr-8", className)}
      {...rest}
    />
  );
});
