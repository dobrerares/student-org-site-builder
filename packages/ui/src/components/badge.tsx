/** @jsxImportSource react */
/**
 * Badge — a small tinted label carrying one fact.
 *
 * Issue #102's visual system gives badges a job rather than a decoration:
 * publication state is tinted per state, language is a neutral outline, tags
 * are quiet. Because the tint *is* the information, the tone is a named
 * variant rather than a colour the caller picks — two surfaces showing the
 * same Draft Article must not be able to disagree about what Draft looks like.
 *
 * Colour is never the only channel: every call site renders the state's word
 * ("Draft", "Ciornă") inside the badge, so the meaning survives greyscale,
 * low vision and the colour-blind palettes. That is what keeps this compliant
 * with WCAG 2.2 AA 1.4.1 rather than merely colourful.
 */
import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn.js";

export const badgeVariants = cva(
  [
    "inline-flex items-center gap-1 whitespace-nowrap",
    "rounded-(--radius-sosb-sm) px-1.5 py-0.5",
    "text-(length:--sosb-text-meta) leading-snug font-medium",
  ].join(" "),
  {
    variants: {
      tone: {
        /** Counts and other quiet facts. */
        neutral: "bg-secondary text-muted-foreground",
        /** Language codes — outlined rather than filled, so a row of them
         * does not compete with the publication state beside it. */
        outline: "border border-border bg-card text-muted-foreground",
        /** Tags. Deliberately the quietest thing on the row. */
        quiet: "bg-secondary text-muted-foreground font-normal",
        accent: "bg-primary-soft text-primary",
        published: "bg-severity-ok-soft text-severity-ok",
        draft: "bg-severity-warning-soft text-severity-warning",
        unlisted: "bg-severity-info-soft text-severity-info",
        error: "bg-severity-error-soft text-severity-error",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, tone, ...rest },
  ref,
) {
  return (
    <span ref={ref} data-sosb-ui="" className={cn(badgeVariants({ tone }), className)} {...rest} />
  );
});
