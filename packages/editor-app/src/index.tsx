/**
 * `@sosb/editor-app` — Preact editor shell.
 *
 * Tracking issue: #7. ADR 0005 records the design.
 * Validation surfaces: #25. ADR 0008 records the design.
 *
 * Public surface (v1):
 *
 * - `<EditorApp initial={site} onImport onExport onReset />` — the top-level
 *   component. Two-pane layout at ≥768px, tabs at <768px. Form is generated
 *   from the `SiteSchema` via `fieldsFromSchema`. Preview iframe re-uses
 *   `@sosb/renderer` (no duplicate code path). Site Health panel + health
 *   footer + pre-export confirmation are wired in by default.
 * - `fieldsFromSchema(schema)` — produces the field tree the form renderer
 *   walks. Exported so other surfaces (block forms in #9-#22, validation
 *   summaries) can re-use the same introspection.
 * - `renderPreviewHtml(site, themeId, opts?)` — thin wrapper over
 *   `renderSite` from `@sosb/renderer`. Exists so the iframe-renderer-reuse
 *   contract is one symbol away from a single source.
 * - `<SiteHealthPanel>`, `<HealthFooter>`, `<ExportConfirmDialog>` — the
 *   validation surfaces, exported standalone so callers (Electron shell,
 *   browser shell, embedded editors) can compose their own chrome.
 * - `navigateToIssue(root, issue)` — pure helper that scrolls + focuses
 *   the spine-form input matching the issue path; exported so consumers
 *   that build alternative panels can reuse the navigation behaviour.
 */

export { EditorApp, type EditorAppProps } from "./editor-app.js";
export { SpineForm, applyPatch } from "./spine-form.js";
export { fieldsFromSchema, type FieldNode } from "./form-generator.js";
export { renderPreviewHtml } from "./preview-html.js";
export { iframeSrcdoc } from "./iframe-srcdoc.js";
export { PagesList, type PagesListProps } from "./pages-list.js";
export { addPage, clonePage, deletePage, movePage } from "./pages-ops.js";
export { CustomHtmlBlockForm, type CustomHtmlBlockFormProps } from "./custom-html-form.js";
export { SiteHealthPanel, type SiteHealthPanelProps } from "./site-health.js";
export { HealthFooter, type HealthFooterProps } from "./health-footer.js";
export {
  ExportConfirmDialog,
  type ExportConfirmDialogProps,
} from "./export-confirm.js";
export { navigateToIssue, findIssueTarget, pathToDotted } from "./issue-navigate.js";
