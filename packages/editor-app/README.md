# @sosb/editor-app

Preact UI shell for the site builder.

## Surface

- `<EditorApp initial={site} onImport onExport onReset />` — the top-level
  component.
- `<WelcomeScreen recents onWizard onTemplate onImport onBlank
  onImportFile onOpenRecent onRevealRecent />` — the pre-editor entry
  surface (four paths + recent sites + drag-drop zip).
- `fieldsFromSchema(schema)` — introspect a Zod schema into the field tree
  the form renderer walks.
- `<SpineForm fields site onPatch />` — generic form for the field tree.
- `applyPatch(site, path, value)` — pure helper used by the form to write
  a value at a nested path.
- `renderPreviewHtml(site, themeId, opts?)` — thin re-export of
  `renderSite` so the iframe-renderer-reuse contract is one symbol away
  from a single source.
- `loadRecentSites(vfs)` / `recordRecentSite(vfs, entry)` — VFS-backed
  recent-sites store. The host (browser-shell / electron-shell) injects
  the driver. See ADR-0006.
- `createBlankSite()` — pure factory for the welcome screen's "Start
  blank" path; produces a valid site with one page + one hero block.

## Layout

- ≥768px: side-by-side editor pane + preview pane.
- <768px: tabs (`Editor`, `Preview`).

## Data flow

1. `EditorApp` instantiates an `EditorState` from `props.initial`.
2. The form's `onPatch` calls `EditorState.update(...)`.
3. A subscriber re-renders the Preact tree on every update.
4. The same subscriber posts a `siteData` envelope into the iframe via
   `@sosb/preview-bridge`'s `createPreviewHost`.
5. The iframe's `srcdoc` is the renderer's HTML — same module, no duplicate
   code path.

See ADR-0005 for the design.

## Welcome screen

`<WelcomeScreen>` is the pre-editor entry surface (issue #32). The host
mounts it before `<EditorApp>`, then swaps when the user picks a path:

1. Host loads `recents = await loadRecentSites(vfs)`.
2. Host renders `<WelcomeScreen recents={recents} ... />`.
3. On `onWizard` / `onTemplate` / `onImport` / `onBlank` / `onImportFile`
   / `onOpenRecent`, the host produces a `Site` (via wizard, template,
   `importFromZip`, `createBlankSite`, or recents resolver) and swaps to
   `<EditorApp initial={site} />`.

See ADR-0006 for the recent-sites storage choice.
