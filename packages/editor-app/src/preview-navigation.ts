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
 * @param path A path string from a navigate message — always starts with
 *   `/` and (per `pagePath` contract) ends with `/`. Hash fragments and
 *   query strings have already been filtered out by the iframe-side
 *   script.
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
 *
 * TODO(user): implement this resolver. The body should be 3–6 lines:
 * iterate `site.pages` and compare each `pagePath(site, page)` against
 * `path`. Return the first matching index, or `null` if none match.
 *
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
export function resolvePathToPageIndex(site: Site, path: string): number | null {
  // TODO(user): implement
  void site;
  void path;
  return null;
}
