/** @jsxImportSource react */
/**
 * Input / Textarea / NativeSelect — shared form controls.
 *
 * All three render the native element and forward every prop, so the
 * `data-*` hooks the builder's stylesheets and tests hang off are
 * untouched.
 *
 * `<Input>` is type-aware. A text box wants a border, a background, inner
 * padding and full width; a checkbox, radio, colour swatch or file picker
 * wants none of those — giving a checkbox `w-full` and `px-2.5` stretches
 * it across the form and pads it into the wrong place. So the text chrome
 * is applied only to text-like types, and the rest get nothing but the
 * shared focus/disabled treatment.
 *
 * Native file inputs stay native on purpose (ADR 0044 and the issue #101
 * contract: "retain specialized native interactions such as file
 * selection"); pass `type="file"` and you get a real `<input type="file">`
 * with the shared focus ring and nothing else layered on top.
 */
import { forwardRef } from "react";

import { cn } from "../lib/cn.js";

/** Chrome for controls the user types into, and for `<select>`. */
const TEXT_FIELD_BASE =
  "w-full rounded-(--radius-sosb-sm) border border-input bg-card px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60";

/** Everything a non-text control should still get. */
const CONTROL_BASE = "disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Input types that are *not* text entry. Listed as an exclusion set rather
 * than an inclusion set because the text-like list keeps growing (`date`,
 * `datetime-local`, `month`, `week`, `time`, …) and a new one showing up
 * unstyled is a worse failure than a new widget type inheriting the
 * minimal treatment.
 */
const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type, ...rest },
  ref,
) {
  // An omitted `type` means `text` per HTML, so it gets the text chrome.
  const isTextLike = type === undefined || !NON_TEXT_INPUT_TYPES.has(type);
  const base = isTextLike ? TEXT_FIELD_BASE : CONTROL_BASE;
  // Checkboxes and radios are the two non-text types with a tint worth
  // setting: `accent-color` is the whole of their theming surface.
  const accent = type === "checkbox" || type === "radio" ? "accent-primary cursor-pointer" : "";
  return (
    <input
      ref={ref}
      data-sosb-ui=""
      {...(type === undefined ? {} : { type })}
      className={cn(base, accent, className)}
      {...rest}
    />
  );
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
      className={cn(TEXT_FIELD_BASE, "min-h-20 resize-y", className)}
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
      className={cn(TEXT_FIELD_BASE, "cursor-pointer pr-8", className)}
      {...rest}
    />
  );
});
