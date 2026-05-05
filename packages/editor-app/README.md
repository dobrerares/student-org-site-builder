# @sosb/editor-app

Preact UI shell for the site builder.

## Surface

- `<EditorApp initial={site} onImport onExport onReset />` — the top-level
  component.
- `fieldsFromSchema(schema)` — introspect a Zod schema into the field tree
  the form renderer walks.
- `<SpineForm fields site onPatch />` — generic form for the field tree.
- `applyPatch(site, path, value)` — pure helper used by the form to write
  a value at a nested path.
- `renderPreviewHtml(site, themeId, opts?)` — thin re-export of
  `renderSite` so the iframe-renderer-reuse contract is one symbol away
  from a single source.

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
