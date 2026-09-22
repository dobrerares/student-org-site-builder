/** @jsxImportSource react */
/**
 * Vendored editorcn toolbar primitives.
 *
 * Derived from shadcn-labs/editorcn at `99232190` (MIT — see `LICENSE` and
 * `README.md` in this directory, which record the upstream revision and every
 * local change). Upstream files: `rte-toolbar.tsx`, `ui/rte-button.tsx`,
 * `ui/rte-button-group.tsx`, `ui/rte-separator.tsx`.
 *
 * Edit this file freely. ADR 0049 makes local adaptations and manually
 * reviewed upstream updates a repository responsibility, not a package-update
 * one — but add anything you change to the README's list, because a future
 * sync has to re-apply it by hand.
 *
 * The primitives are deliberately dumb: a roving-focus container, a pressed-
 * state button, a group and a separator. They know nothing about Tiptap,
 * about the Site, or about which commands exist. All of that lives in
 * `../../rich-text/rich-text-toolbar.tsx`, which is the editor-owned,
 * Site-aware layer ADR 0049 keeps separate.
 */
import type { JSX, ReactNode } from "react";
import { useCallback, useRef } from "react";
import { cn } from "@sosb/ui";

export interface ToolbarProps {
  readonly label: string;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * `role="toolbar"` with arrow-key roving focus.
 *
 * The roving behaviour matters for more than politeness: without it a
 * fourteen-button toolbar sits between the author and the text they are
 * trying to edit, and every Tab press walks through all of it. With it the
 * toolbar is a single tab stop and the arrows move within.
 */
export function Toolbar(props: ToolbarProps): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const root = ref.current;
    if (root === null) return;
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
    if (buttons.length === 0) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = (current + delta + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }, []);

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={props.label}
      aria-orientation="horizontal"
      data-sosb-ui
      onKeyDown={onKeyDown}
      className={cn("flex flex-wrap items-center gap-0.5 p-1", props.className)}
    >
      {props.children}
    </div>
  );
}

export interface ToolbarButtonProps {
  readonly label: string;
  readonly pressed?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly testId?: string;
  readonly tabIndex?: number;
  readonly children: ReactNode;
}

/**
 * A toggle button.
 *
 * `aria-pressed` rather than `aria-checked`: these are formatting toggles,
 * not radio choices, and several may be active at once.
 *
 * `onMouseDown` preventing default is load-bearing, not a tweak. Clicking a
 * toolbar button would otherwise move focus out of the editing surface,
 * which collapses the selection — so "select three words, click Bold" would
 * bold nothing. Keeping focus in the document is what makes the toolbar
 * usable at all.
 */
export function ToolbarButton(props: ToolbarButtonProps): JSX.Element {
  return (
    <button
      type="button"
      data-sosb-ui
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.pressed ?? false}
      disabled={props.disabled ?? false}
      tabIndex={props.tabIndex ?? -1}
      {...(props.testId === undefined ? {} : { "data-testid": props.testId })}
      onMouseDown={(event) => event.preventDefault()}
      onClick={props.onClick}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded px-1.5",
        "text-sm leading-none",
        "hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-1",
        "disabled:opacity-40 disabled:pointer-events-none",
        "aria-pressed:bg-black/10",
      )}
    >
      {props.children}
    </button>
  );
}

export function ToolbarGroup(props: { children: ReactNode }): JSX.Element {
  return (
    <div role="group" className="flex items-center gap-0.5">
      {props.children}
    </div>
  );
}

export function ToolbarSeparator(): JSX.Element {
  return <span aria-hidden="true" className="mx-1 h-5 w-px self-center bg-black/10" />;
}
