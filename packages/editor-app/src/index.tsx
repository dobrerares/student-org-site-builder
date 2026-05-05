/**
 * `@sosb/editor-app` — Preact editor shell.
 *
 * Tracking issue: #7. ADR 0005 records the design.
 *
 * Public surface (v1):
 *
 * - `<EditorApp initial={site} onImport onExport onReset />` — the top-level
 *   component. Two-pane layout at ≥768px, tabs at <768px. Form is generated
 *   from the `SiteSchema` via `fieldsFromSchema`. Preview iframe re-uses
 *   `@sosb/renderer` (no duplicate code path).
 * - `fieldsFromSchema(schema)` — produces the field tree the form renderer
 *   walks. Exported so other surfaces (block forms in #9-#22, validation
 *   summaries) can re-use the same introspection.
 * - `renderPreviewHtml(site, themeId, opts?)` — thin wrapper over
 *   `renderSite` from `@sosb/renderer`. Exists so the iframe-renderer-reuse
 *   contract is one symbol away from a single source.
 */

export { EditorApp, type EditorAppProps } from "./editor-app.js";
export { SpineForm, applyPatch } from "./spine-form.js";
export { fieldsFromSchema, type FieldNode } from "./form-generator.js";
export { renderPreviewHtml } from "./preview-html.js";
export { iframeSrcdoc } from "./iframe-srcdoc.js";
export { WelcomeScreen, type WelcomeScreenProps } from "./welcome-screen.js";
export {
  loadRecentSites,
  recordRecentSite,
  RECENT_SITES_PATH,
  RECENT_SITES_LIMIT,
  type RecentSite,
} from "./recent-sites.js";
export { createBlankSite } from "./blank-site.js";
