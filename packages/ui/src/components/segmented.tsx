/** @jsxImportSource react */
/**
 * Segmented — a small set of mutually exclusive choices, all visible at once.
 *
 * Issue #102 uses one control family for every "pick one of a few" job:
 * publication state, the phone layout's Edit / Preview switch, and the
 * preview's device presets. Making them the same component is the point —
 * three hand-rolled button rows drift in height, radius and focus treatment
 * the moment anyone touches one of them.
 *
 * Accessibility shape: a `role="group"` of real buttons carrying
 * `aria-pressed`, not a `radiogroup`. These are actions that take effect
 * immediately (switching a pane, changing a state) rather than a form value
 * read at submit time, and `aria-pressed` is what conveys "this one is on"
 * for a toggle button. Every option is tab-reachable, which is what the
 * accepted design asked for on phones where this is the primary control.
 */
import { forwardRef } from "react";

import { cn } from "../lib/cn.js";

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** Optional secondary line, e.g. a device preset's pixel size. */
  readonly detail?: string;
  /** Accessible name, when the visible label is too terse on its own. */
  readonly ariaLabel?: string;
  readonly testId?: string;
  /** Extra attributes for the option button — test and style hooks. */
  readonly data?: Readonly<Record<string, string>>;
}

export interface SegmentedProps<T extends string>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  readonly value: T;
  readonly options: readonly SegmentedOption<T>[];
  readonly onValueChange: (value: T) => void;
  /** Required: a group of unlabelled buttons is meaningless to a screen reader. */
  readonly ariaLabel: string;
  /** Compact (28px) rather than standard (36px). */
  readonly size?: "sm" | "md";
}

function SegmentedInner<T extends string>(
  { value, options, onValueChange, ariaLabel, size = "md", className, ...rest }: SegmentedProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  return (
    <div
      ref={ref}
      role="group"
      aria-label={ariaLabel}
      data-sosb-ui=""
      className={cn(
        "inline-flex items-center gap-0.5 rounded-(--radius-sosb-md) border border-border bg-secondary p-0.5",
        className,
      )}
      {...rest}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            data-sosb-ui=""
            aria-pressed={selected}
            {...(option.ariaLabel === undefined ? {} : { "aria-label": option.ariaLabel })}
            {...(option.testId === undefined ? {} : { "data-testid": option.testId })}
            {...(option.data ?? {})}
            // `data-active` mirrors `aria-pressed` for stylesheets and tests
            // that would otherwise have to parse an ARIA attribute.
            data-active={selected}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "inline-flex flex-col items-center justify-center rounded-(--radius-sosb-sm) font-medium transition-colors",
              size === "sm" ? "h-6 px-2" : "h-8 px-3",
              option.detail === undefined
                ? "text-(length:--sosb-text-sm)"
                : "gap-0 text-(length:--sosb-text-sm) leading-tight",
              selected
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{option.label}</span>
            {option.detail !== undefined && (
              <span className="text-(length:--sosb-text-micro) font-normal opacity-70">
                {option.detail}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * `forwardRef` erases generics, so the cast restores the parameterised
 * signature callers actually want (`Segmented<PubState>` keeping its union
 * rather than collapsing to `string`).
 */
export const Segmented = forwardRef(SegmentedInner) as <T extends string>(
  props: SegmentedProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> },
) => React.ReactElement;
