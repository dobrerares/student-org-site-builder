/**
 * Editor preview HTML adapter.
 *
 * The AC ("iframe and main share the renderer — no duplicate code path") is
 * implemented by this single re-export of `renderSite`. The editor's iframe
 * bootstrapper (`./preview-iframe.ts`) and the editor's offline preview path
 * both go through this module, so any future drift is impossible: there is
 * exactly one symbol here, and it is the renderer's `renderSite`.
 *
 * The function exists as a separate name (`renderPreviewHtml`) only so the
 * iframe-renderer-reuse test can assert byte-equality between the editor's
 * preview-render and a direct `renderSite` call without naming the same
 * function twice in the test file's imports.
 */
import { renderSite, type RenderOptions } from "@sosb/renderer";
import type { Site } from "@sosb/schema";

export function renderPreviewHtml(site: Site, themeId: string, opts?: RenderOptions): string {
  return renderSite(site, themeId, opts);
}
