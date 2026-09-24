/**
 * Build the `srcdoc` HTML for the editor's preview iframe.
 *
 * In v1, the editor renders the preview HTML directly on the host side via
 * `renderPreviewHtml(...)` (which is `renderSite(...)`) and writes the
 * complete document into the iframe via `srcdoc`. The iframe runs the
 * renderer-emitted inline scripts (lightbox, event-list, embed-loader,
 * preview-nav) — same renderer output as the build pipeline, plus the
 * preview-only nav-click interceptor that routes link clicks back to the
 * host via the preview-bridge envelope.
 *
 * Subsequent edits update the iframe by re-writing its `srcdoc` (and a
 * `postMessage` envelope is also dispatched, so future iframe-side
 * receivers — e.g. interactive blocks added by #9-#22 — get a uniform
 * surface to listen on).
 */

import type { Site } from "@sosb/schema";
import type { RenderOptions } from "@sosb/renderer";
import { renderPreviewHtml } from "./preview-html.js";

/**
 * Preview-only switches, threaded through unchanged to `renderSite`.
 *
 * `includePublicScript` emits the active Theme package's `public.js` into the
 * preview document. Off by default: ADR 0046 keeps ordinary editing static so
 * a Theme script's external calls never fire while an author types. The
 * interactive-preview toggle (issue #110, ADR 0056) flips exactly this flag —
 * nothing else about the render changes, so what the toggle shows is what
 * ships. The toggle also swaps the asset resolver for one that inlines
 * `data:` URLs, but that goes through the ordinary `assetUrlForPath` seam.
 */
export interface PreviewOptions {
  readonly includePublicScript?: boolean | undefined;
}

/**
 * Preview an Article instead of a Page.
 *
 * Kept as a separate entry point rather than an overload of `iframeSrcdoc`
 * because the two take different index spaces (`site.pages` vs `site.articles`)
 * and a single numeric parameter meaning either would be an easy thing to get
 * silently wrong at a call site.
 */
export function iframeSrcdocForArticle(
  site: Site,
  themeId: string,
  articleIndex: number,
  assetUrlForPath?: RenderOptions["assetUrlForPath"],
  theme?: RenderOptions["theme"],
  preview?: PreviewOptions,
): string {
  return renderPreviewHtml(site, themeId, {
    mode: "preview",
    articleIndex,
    ...(assetUrlForPath !== undefined ? { assetUrlForPath } : {}),
    // Same resolved bundle the Page preview and the export use (ADR 0052).
    // An Article previewed under a different theme object than the Page next
    // to it is exactly the drift the seam exists to prevent.
    ...(theme !== undefined ? { theme } : {}),
    ...(preview?.includePublicScript === true ? { includePublicScript: true } : {}),
  });
}

export function iframeSrcdoc(
  site: Site,
  themeId: string,
  pageIndex?: number,
  assetUrlForPath?: RenderOptions["assetUrlForPath"],
  theme?: RenderOptions["theme"],
  preview?: PreviewOptions,
): string {
  return renderPreviewHtml(site, themeId, {
    mode: "preview",
    ...(typeof pageIndex === "number" ? { pageIndex } : {}),
    ...(assetUrlForPath !== undefined ? { assetUrlForPath } : {}),
    // The resolved Theme bundle. Passing it here — rather than letting the
    // preview look the id up separately — is what guarantees the preview and
    // the export are rendered from the same theme data (ADR 0052).
    ...(theme !== undefined ? { theme } : {}),
    ...(preview?.includePublicScript === true ? { includePublicScript: true } : {}),
  });
}
