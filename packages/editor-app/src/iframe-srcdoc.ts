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
import { renderPreviewHtml } from "./preview-html.js";

export function iframeSrcdoc(site: Site, themeId: string, pageIndex?: number): string {
  return renderPreviewHtml(site, themeId, {
    mode: "preview",
    ...(typeof pageIndex === "number" ? { pageIndex } : {}),
  });
}
