/**
 * Builder navigation — the destinations the redesigned builder can be at.
 *
 * Issue #102's accepted design replaces the old "one editor pane with a
 * `contentKind` switch" shape with persistent main navigation over five
 * destinations, two of which open a focused *workspace* for a single piece of
 * content:
 *
 *   Overview · Pages · Articles · Theme · Site settings
 *                └ page workspace  └ article workspace
 *
 * This module is deliberately pure and free of React. Getting navigation right
 * is mostly about the awkward cases — the page you were editing is deleted, the
 * Article you drilled into is gone, a Block disappears underneath an open
 * Inspector — and those are far easier to pin down in a unit test than by
 * clicking around. The shell holds a `Destination` in state and runs it through
 * `reconcileDestination` on every snapshot, so a vanished target lands the user
 * on the surrounding list rather than on an empty pane.
 *
 * Page identity is an index rather than a slug because every patch path in the
 * editor is already index-rooted (`["pages", i, "blocks", j, ...]`). Articles
 * are identified by id: they are reordered by date and filtered by the list, so
 * an index would mean something different from one render to the next.
 */
import type { Site } from "@sosb/schema";

/** The five entries in the persistent main navigation. */
export type NavSection = "overview" | "pages" | "articles" | "theme" | "settings";

/** Every main-navigation entry, in the order the navigation renders them. */
export const NAV_SECTIONS: readonly NavSection[] = [
  "overview",
  "pages",
  "articles",
  "theme",
  "settings",
];

/**
 * Where the builder currently is.
 *
 * The list destinations (`pages`, `articles`) and the workspace destinations
 * (`pageWorkspace`, `articleWorkspace`) are separate cases rather than one case
 * with an optional target, so that "no content is open" is unrepresentable as a
 * workspace and the compiler forces every consumer to handle both.
 */
export type Destination =
  | { readonly kind: "overview" }
  | { readonly kind: "pages" }
  | { readonly kind: "pageWorkspace"; readonly pageIndex: number }
  | { readonly kind: "articles" }
  | { readonly kind: "articleWorkspace"; readonly articleId: string }
  | { readonly kind: "theme" }
  | { readonly kind: "settings" };

/** The destination the builder opens a Site into (issue #102, round four). */
export const INITIAL_DESTINATION: Destination = { kind: "overview" };

/**
 * Which main-navigation entry should read as current.
 *
 * A workspace highlights the list it belongs to: while editing a page you are
 * still "in" Pages, and the navigation should not go blank just because you
 * drilled one level down.
 */
export function sectionOf(destination: Destination): NavSection {
  switch (destination.kind) {
    case "overview":
      return "overview";
    case "pages":
    case "pageWorkspace":
      return "pages";
    case "articles":
    case "articleWorkspace":
      return "articles";
    case "theme":
      return "theme";
    case "settings":
      return "settings";
  }
}

/** The destination a main-navigation entry opens. */
export function destinationForSection(section: NavSection): Destination {
  switch (section) {
    case "overview":
      return { kind: "overview" };
    case "pages":
      return { kind: "pages" };
    case "articles":
      return { kind: "articles" };
    case "theme":
      return { kind: "theme" };
    case "settings":
      return { kind: "settings" };
  }
}

/** True when this destination shows a focused editing workspace. */
export function isWorkspace(destination: Destination): boolean {
  return destination.kind === "pageWorkspace" || destination.kind === "articleWorkspace";
}

/**
 * Where the workspace's back affordance goes — the list the content came from.
 *
 * Non-workspace destinations answer themselves, so callers can use this without
 * first checking `isWorkspace`.
 */
export function backDestination(destination: Destination): Destination {
  if (destination.kind === "pageWorkspace") return { kind: "pages" };
  if (destination.kind === "articleWorkspace") return { kind: "articles" };
  return destination;
}

/**
 * Drill state *within* a workspace — ADR 0042's Inspector pattern, preserved.
 *
 * `outline` is the un-drilled view (title, state, settings affordance, Block
 * outline, and for an Article the Related Articles switch). The other three are
 * focused Inspectors, each of which renders a back button naming the content.
 */
export type WorkspaceDrill =
  | { readonly kind: "outline" }
  | { readonly kind: "block"; readonly blockId: string }
  | { readonly kind: "settings" }
  | { readonly kind: "related" };

/** The un-drilled workspace view. */
export const OUTLINE_DRILL: WorkspaceDrill = { kind: "outline" };

/**
 * Drop a destination that no longer points at anything.
 *
 * Deleting the page you are editing, removing the last Article matching a
 * filter, or importing a different project entirely all leave the held
 * destination dangling. Rather than rendering an empty workspace, fall back to
 * the surrounding list — the user keeps their bearings and the navigation stays
 * truthful.
 *
 * Returns the *same object* when nothing needs to change, so callers can use a
 * `===` check to avoid a pointless state update (and the render loop it would
 * cause if they set state unconditionally from an effect).
 */
export function reconcileDestination(destination: Destination, site: Site): Destination {
  if (destination.kind === "pageWorkspace") {
    const page = site.pages[destination.pageIndex];
    return page === undefined ? { kind: "pages" } : destination;
  }
  if (destination.kind === "articleWorkspace") {
    const exists = (site.articles ?? []).some((a) => a.id === destination.articleId);
    return exists ? destination : { kind: "articles" };
  }
  return destination;
}

/**
 * Drop a drill state whose target has gone.
 *
 * Mirrors `reconcileDestination` one level down: a Block removed from the
 * outline while its Inspector is open drills back out instead of leaving a form
 * bound to nothing. `related` survives being switched off — the configuration is
 * deliberately kept (issue #102, round three) and the author may be about to
 * switch it straight back on.
 */
export function reconcileDrill(drill: WorkspaceDrill, blockIds: readonly string[]): WorkspaceDrill {
  if (drill.kind !== "block") return drill;
  return blockIds.includes(drill.blockId) ? drill : OUTLINE_DRILL;
}
