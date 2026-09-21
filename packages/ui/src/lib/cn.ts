/**
 * `cn` — the shadcn class-name helper.
 *
 * `clsx` resolves conditionals; `tailwind-merge` resolves conflicts so a
 * caller-supplied `px-4` beats a component default of `px-3` regardless of
 * the order the two end up in the stylesheet.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
