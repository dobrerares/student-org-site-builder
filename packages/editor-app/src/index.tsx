/**
 * `@sosb/editor-app` — Preact editor shell.
 *
 * Tracking issues: #7, #36. ADR 0005 records the editor-shell design.
 * Validation surfaces: #25. ADR 0008 records the design.
 * i18n integration: #42. ADR 0028 records the design.
 *
 * Public surface (v1):
 *
 * - `<EditorApp initial={site} translator? onImport onExport onReset />` — the
 *   top-level component. Two-pane layout at ≥768px, tabs at <768px. Form is
 *   generated from the `SiteSchema` via `fieldsFromSchema`. Preview iframe
 *   re-uses `@sosb/renderer` (no duplicate code path). Site Health panel +
 *   health footer + pre-export confirmation are wired in by default. Localised
 *   via the `translator` prop (or a default English translator when omitted).
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
 * - `<LocaleToggle />` — the editor-settings locale switcher. Reads / writes
 *   the active locale on the surrounding translator context.
 * - `useTranslator()` — Preact hook the editor and downstream block forms
 *   use to translate user-visible strings.
 * - `<I18nProvider value={translator}>` — the context provider; useful when
 *   composing the editor inside a larger host (browser shell, Electron
 *   shell) that wants a single translator across multiple panes.
 * - `<UpdateBanner bridge={...} />` (#36) — surfaces auto-update lifecycle
 *   events as a top-bar banner. Decoupled from Electron via the
 *   `UpdateBridge` interface; the desktop wiring uses
 *   `createSosbUpdateBridge(window.sosb)`. The browser SPA never mounts
 *   the banner (auto-update is desktop-only).
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
export { ExportConfirmDialog, type ExportConfirmDialogProps } from "./export-confirm.js";
export { navigateToIssue, findIssueTarget, pathToDotted } from "./issue-navigate.js";
export { AddBlockDialog, type AddBlockDialogProps } from "./add-block-dialog.js";
export { BlockListEditor, type BlockListEditorProps } from "./block-list-editor.js";
export {
  buildBlockCatalog,
  type BlockCatalog,
  type BlockCatalogEntry,
  type BlockCatalogGroup,
  type BlockCategory,
} from "./block-catalog.js";
export { defaultBlockFor } from "./block-defaults.js";
export { LocaleToggle } from "./locale-toggle.js";
export { I18nProvider, useTranslator } from "./i18n-context.js";
export {
  UpdateBanner,
  type UpdateBannerProps,
  type UpdateBridge,
  type UpdateInfo,
  type UpdateError,
} from "./update-banner.js";
export {
  createSosbUpdateBridge,
  isElectronShellAvailable,
  type SosbUpdateSurface,
} from "./sosb-update-bridge.js";
export { EDITOR_APP_CSS } from "./editor-app-css.js";
