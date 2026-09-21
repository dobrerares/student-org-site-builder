/**
 * Resolve a path emitted by the preview iframe's nav-click interceptor
 * (see `@sosb/renderer/preview-nav-script.ts`) back to a page index in
 * `site.pages`.
 *
 * Context
 * -------
 * When a user clicks a nav or language-switcher link inside the preview
 * iframe, the iframe-side script `postMessage`s `{ type: "navigate", path }`
 * to the editor host. The host needs to map that path (e.g. `"/"`,
 * `"/despre/"`, `"/en/"`, `"/en/about/"`) back to a `pageIndex` so the
 * editor can swap `activePageIndex` and re-render the iframe.
 *
 * Path semantics are owned by `@sosb/renderer/routing.ts`'s `pagePath` —
 * this resolver inverts that. Every page has exactly one canonical path;
 * paths that don't match any page are explicit no-matches (returned as
 * `null`).
 */

import type { Site } from "@sosb/schema";
import { pagePath } from "@sosb/renderer";

/**
 * Map a path (as emitted by `pagePath`) back to a page index.
 *
 * @param site The current site snapshot.
 * @param path A path string from a navigate message. Renderer-emitted nav
 *   and language-switcher links are canonical `pagePath` values (leading and
 *   trailing `/`), but author-written link fields may be relative
 *   (`despre/`, `../contact/`) or carry a hash / query, so the path is
 *   normalised before matching.
 * @param fromPageIndex The page currently being previewed — the base a
 *   relative path resolves against. Defaults to `0` (the home page).
 * @returns The matching index in `site.pages`, or `null` when no page in
 *   the current site has this canonical path.
 *
 * Behaviour for the host's `onPreviewEvent` handler to consider:
 *   - `null` is a soft no-match: the user clicked a link that doesn't
 *     correspond to any page in the current snapshot (e.g. a CTA banner
 *     pointing at a slug that was just deleted). The host should ignore
 *     it rather than throw — the iframe already called preventDefault().
 *   - A returned index === current `activePageIndex` is a no-op the host
 *     can elide (no need to re-render for the same page).
 * Trade-offs to consider:
 *  1. Case sensitivity. Slugs are validated as lowercase ASCII by the
 *     schema — strict equality is correct and matches how a real server
 *     serving `dist/<slug>/index.html` would behave (case-sensitive).
 *  2. Trailing slash tolerance. The iframe script forwards `href` verbatim
 *     and `pagePath` always emits trailing slashes — so strict equality
 *     is the right default. If you want to be lenient (e.g. accept
 *     `/despre` as well as `/despre/`), normalize first.
 *  3. Locale fallback. If a clicked path doesn't match (e.g. the user
 *     deleted that page mid-edit), should we fall back to the language
 *     home? The simplest answer is "no — return null and let the host
 *     decide." That keeps this function pure and testable.
 */
export function resolvePathToPageIndex(
  site: Site,
  path: string,
  fromPageIndex = 0,
): number | null {
  const resolved = rootPath(site, path, fromPageIndex);
  if (resolved === null) return null;
  for (let i = 0; i < site.pages.length; i++) {
    const page = site.pages[i];
    if (page !== undefined && pagePath(site, page) === resolved) return i;
  }
  return null;
}

/**
 * Normalise a clicked href into a canonical, root-anchored `pagePath` form.
 *
 * The iframe forwards the href verbatim. Absolute paths (`/despre/`) arrive
 * ready to compare. Relative ones (`despre/`, `../contact/`) must be resolved
 * against the page the user is currently looking at — the iframe cannot do
 * that itself, because a `srcdoc` document's `document.baseURI` is the
 * editor's own URL, not the previewed page's path.
 *
 * Query strings and hash fragments are dropped: they never distinguish two
 * pages in this site model, and a link to `/despre/#echipa` should still
 * resolve to the "despre" page.
 *
 * Returns `null` for anything that cannot be a page path.
 */
function rootPath(site: Site, href: string, fromPageIndex: number): string | null {
  if (href.length === 0) return null;
  const withoutFragment = href.split("#")[0]!.split("?")[0]!;
  if (withoutFragment.length === 0) return null;

  let segments: string[];
  if (withoutFragment.startsWith("/")) {
    segments = withoutFragment.split("/");
  } else {
    const from = site.pages[fromPageIndex];
    const base = from === undefined ? "/" : pagePath(site, from);
    segments = `${base}${withoutFragment}`.split("/");
  }

  const out: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return out.length === 0 ? "/" : `/${out.join("/")}/`;
}
