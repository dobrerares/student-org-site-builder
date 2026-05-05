# @sosb/editor-state

Live document model with debounced auto-save to a `@sosb/vfs` driver.

The package is intentionally framework-agnostic: no Preact dependency. The
Preact-specific binding lives in `@sosb/editor-app`.

## Surface

- `createEditorState({ initial, vfs?, debounceMs? })` — build an in-memory
  state model around a `Site`.
- `EditorState.getSnapshot()` / `update(fn)` / `subscribe(listener)` /
  `flush()`.
- `loadAutosave(vfs)` — restore the most-recent auto-saved snapshot.
- `AUTOSAVE_PATH` — the stable path inside the VFS where snapshots live
  (`editor/autosave.json`).

See ADR-0005 for the design.
