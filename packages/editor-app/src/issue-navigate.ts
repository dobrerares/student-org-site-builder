/**
 * Map a `ValidationIssue.path` to a DOM selector + focus the matching
 * spine-form input (or, where the path lands inside `pages[].blocks`,
 * the future block-form input — when those land in #9-#22).
 *
 * The spine form emits `[data-field="<dotted.path>"]` attributes for every
 * leaf input. The shortest path that selects an existing element wins —
 * so a path like `pages[0].blocks[2].data.title` falls back to
 * `pages.0.blocks` if no per-block input is yet rendered. The fallback
 * keeps the click "do something" instead of silently doing nothing while
 * #9-#22 fill in.
 */
export interface IssueLike {
  readonly path: readonly (string | number)[];
}

/**
 * Convert a path array to a dotted string (e.g. `["pages", 0, "slug"]` ->
 * `pages.0.slug`). Numeric indices are stringified — the spine-form's
 * `data-field` attribute uses the same dotted convention.
 */
export function pathToDotted(path: readonly (string | number)[]): string {
  return path.map((segment) => String(segment)).join(".");
}

/**
 * Find the closest match in the DOM for the issue's path. Walks the path
 * from longest to shortest, picking the first selector that resolves to
 * an element. Returns `null` when nothing matches (e.g. issue points at a
 * site-spine field the renderer doesn't surface).
 */
export function findIssueTarget(root: ParentNode, issue: IssueLike): HTMLElement | null {
  for (let depth = issue.path.length; depth > 0; depth--) {
    const dotted = pathToDotted(issue.path.slice(0, depth));
    const escaped = cssEscape(dotted);
    const selector = `[data-field="${escaped}"]`;
    const found = root.querySelector<HTMLElement>(selector);
    if (found !== null) return found;
  }
  return null;
}

/**
 * Scroll-into-view + focus the matching element, if any. Returns whether
 * a target was found (callers can announce "couldn't navigate" otherwise).
 */
export function navigateToIssue(root: ParentNode, issue: IssueLike): boolean {
  const target = findIssueTarget(root, issue);
  if (target === null) return false;
  // `focus()` already brings the element into view in jsdom (and in real
  // browsers — though `scrollIntoView` is the modern safe-belt for nested
  // scroll containers). jsdom's no-op `scrollIntoView` is harmless.
  if (typeof target.scrollIntoView === "function") {
    target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  }
  target.focus();
  return true;
}

/**
 * Minimal CSS attribute-value escape: covers `\` and `"` so dotted paths
 * with special characters still slot into a `[data-field="..."]`
 * selector. We deliberately keep this in-house rather than depending on
 * `CSS.escape` (which is browser-only and ships behind a polyfill in jsdom).
 */
function cssEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
