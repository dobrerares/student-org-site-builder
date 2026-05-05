/**
 * Build the `srcdoc` HTML for the editor's preview iframe.
 *
 * In v1, the editor renders the preview HTML directly on the host side via
 * `renderPreviewHtml(...)` (which is `renderSite(...)`) and writes the
 * complete document into the iframe via `srcdoc`. The iframe contains no
 * runtime JavaScript — it's the same static HTML that the build pipeline
 * would produce. This keeps the AC "iframe preview reuses the renderer
 * code" trivially true: there is no separate iframe bundler.
 *
 * Subsequent edits update the iframe by re-writing its `srcdoc` (and a
 * `postMessage` envelope is also dispatched, so future iframe-side
 * receivers — e.g. interactive blocks added by #9-#22 — get a uniform
 * surface to listen on).
 */

import type { Site } from "@sosb/schema";
import { renderPreviewHtml } from "./preview-html.js";

export function iframeSrcdoc(site: Site, themeId: string, pageIndex?: number): string {
  return renderPreviewHtml(
    site,
    themeId,
    typeof pageIndex === "number" ? { pageIndex } : undefined,
  );
}
