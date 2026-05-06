# 0008 — Block library picker, DnD reorder, and undo/redo history

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #27

## Context

Issue #27 asks for three coupled editor features:

- A categorised, searchable **"Add block" picker** dialog backed by the
  `@sosb/schema` block registry (PRD user stories 37, "categorized block
  library — mandatory / optional / advanced").
- **Drag-and-drop block reordering** with an explicit drag handle (PRD:
  "drag-and-drop block reordering via explicit drag handle, not body drag")
  plus a keyboard-accessible alternative (PRD AC for accessibility: "full
  keyboard navigation").
- **Mandatory undo/redo** with cross-platform shortcuts and a bounded,
  FIFO-evicted snapshot stack that survives auto-save (PRD: "Mandatory
  undo/redo via debounced data snapshots", and the issue body's bullet
  "Stack capacity bounded with FIFO eviction").

ADR 0005 (#7) shipped the editor shell and the debounced auto-save half
of the spec, deferring the history stack and DnD to this issue. The PRD
and ADR 0005 do not pin:

- Whether DnD goes through a third-party library or HTML5 native drag-
  and-drop.
- The history model: patches/operations vs snapshots.
- How block-library entries are categorised.
- How the undo stack persists across reloads (the autosave is a Site,
  not a stack).

This ADR records those choices.

## Decision

### History model: **whole-Site snapshot stack** (not patches)

`@sosb/editor-state` exports `createHistoryStore<T>({ initial, capacity })`
returning `{ push, undo, redo, canUndo, canRedo }`. It stores a flat array
of T-typed snapshots plus a cursor. `push` truncates the redo branch.
Capacity bounds the stack — once exceeded, the oldest entry is dropped
FIFO. Default capacity is **50** per the issue body.

The editor app pushes a fresh `Site` snapshot after each discrete user
action (block add / remove / reorder, form patch). Snapshots are stored
by reference; the editor's `update()` already deep-clones via
`structuredClone`, so the references handed to the history store are
already detached from the live state.

Rejected:

- **Patches / commands (Redux-style action log).** Would force every
  block manipulation to round-trip through a reducer with named action
  types. Today's site is small (~hundreds of bytes per block), so the
  memory cost of full snapshots at capacity 50 is at most a few hundred
  KB — well below any reasonable budget. Patches add API surface that
  pays back only at much larger scales.
- **Immer-style structurally shared snapshots.** Would require a runtime
  dep at the `editor-state` layer. `structuredClone` is in every
  evergreen browser since 2022 (and Node 17+). Sharing structure is a
  memory optimisation we do not need.
- **Per-page history.** The snapshot is the whole site, so a cross-page
  edit (e.g. a future "rename a page" action) has the right scope by
  default. Per-page would make multi-page actions un-undoable as a unit.

### Drag-and-drop: **HTML5 native drag-and-drop via an explicit handle**

`<BlockListEditor>` makes only the per-row drag handle `draggable={true}`;
the row itself is not draggable. The handle's `onDragStart` writes the
row's source index into the dataTransfer under a custom MIME type
(`application/x-sosb-block-index`). The row's `onDragOver` accepts the
drop only when the dataTransfer carries that MIME, and `onDrop` reads the
source index and calls `onMove(from, index)`.

The keyboard-accessible alternative is two `<button>`s per row — "Move up"
and "Move down" — wired to the same `onMove` handler. The first row's
"Move up" and the last row's "Move down" are disabled. This satisfies
"keyboard reorder also works" without depending on native DnD's keyboard
support, which historically varies by browser.

Rejected:

- **`@dnd-kit/core` / `react-beautiful-dnd` / `sortablejs`.** All three
  are React-tied or ship a layout/runtime engine for animations the
  editor does not need. Adding a 30+ KB runtime dep for a list of
  blocks is overkill, and `react-beautiful-dnd` is unmaintained as of 2026.
- **Body-drag (whole row draggable).** Per the PRD: "drag-and-drop
  block reordering via explicit drag handle, not body drag" — the
  ergonomic motivation is that the row itself contains form-like
  controls (move buttons, remove) and dragging from those produces
  ambiguous user intent.

The drag-handle's MIME-typed payload also keeps the editor's drag drop
target from accepting unrelated drags (e.g. a file dragged in from
the OS, or a drag from another part of the page that we may add
later).

### Block library catalog: **derived dynamically from `KnownBlockSchemas`**

`buildBlockCatalog()` iterates `Object.keys(KnownBlockSchemas)` and emits
one entry per registered block type. Per-type category + label +
description live in a small static `BLOCK_METADATA` table inside
`@sosb/editor-app`. Types in the registry without a metadata entry fall
back to `optional` + a humanised label (e.g. `partnerLogos` ->
`Partner logos`). This guarantees:

- Adding a new block schema (#9-#22) makes it appear in the picker
  without an editor code change. Adding metadata is a separate, additive
  PR.
- A schema-only PR cannot regress the editor — the fallback path keeps
  the dialog functional.
- The categorisation lives in the editor (a UI concern), not in
  `@sosb/schema` (a data-format concern). This matches the layering in
  ADR 0002.

Rejected:

- **Hard-coding the type list inside the editor.** Defeats the PRD's
  "adding a new block type is just defining a schema" goal.
- **Storing category metadata on the schema itself.** Mixes the
  data-format layer with editor presentation concerns. The same schema
  ships in environments without an editor (the renderer, the build
  pipeline) and shouldn't carry editor-only metadata.

### Keyboard shortcuts: Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z at the window level

`<EditorApp>` registers a single `keydown` listener on `window`. When the
key is `z` (case-insensitive) and `event.ctrlKey || event.metaKey` is
true, the editor calls `event.preventDefault()` and dispatches to
`doRedo()` if `event.shiftKey` is true, otherwise `doUndo()`. The shift
combination is the redo gesture used by VS Code, Figma, and most modern
editors; we deliberately do not bind `Ctrl+Y` for redo so the same chord
works on Mac and Windows.

The listener is `window`-level rather than per-input because the user
expects undo/redo to work regardless of focus context (clicking somewhere
on the page should not orphan the shortcut). Form inputs that consume
their own undo stack (`<input type="text">`'s native one) don't lose
their stack — we simply prevent the default for the editor's own undo,
which the user almost always intends.

### Persistence across sessions: history stored in the same VFS as auto-save

`@sosb/editor-state` exports `serializeHistory(store)`,
`deserializeHistory(snapshot)`, plus `saveHistory(vfs, store)` and
`loadHistory(vfs)`. The serialised form is `{ entries, cursor, capacity }`
JSON. The default path is `editor/history.json` (`HISTORY_PATH`),
sibling to `editor/autosave.json`. Hosts that already wire a persistent
VFS driver for auto-save get history persistence by writing the history
through the same driver — they choose whether to persist on every push
or to debounce. v1 ships memory-only; the host shells (#36 / #38) wire
their persistent drivers in.

Rejected:

- **`localStorage` write inside the editor.** Same node-runnable test
  argument as ADR 0005 — the package would couple to a browser-only
  API.
- **Encoding the stack inside the autosave.json.** Bloats the export
  artifact (the user-facing zip would carry editor history, which they
  never want). Keeping history in a sibling file means it never ends
  up in `@sosb/zip`'s export.

## Rationale

The most subtle choice is snapshots vs patches. Two factors decided it:

1. The site is small. A 50-snapshot stack at the v1 fixture's size is
   under 100 KB. Patches would save memory at a scale we do not have.
2. Patches require an action vocabulary. Defining one now (and growing
   it for every new operation in #9-#22, #25, #26) is more design
   surface than the AC requires.

The DnD library decision is similarly biased by scope: the v1 list is a
page's blocks (low double-digits in practice). HTML5 native DnD with a
handle is 30 lines of code; a library is a 30+ KB dep. The keyboard
fallback is required regardless, so DnD is purely an ergonomic
convenience layer.

The catalog's dynamic derivation from the registry is the single most
important constraint: it keeps the editor honest as new block types land,
turning a "did anyone update the picker?" question into an "of course,
the registry drives it" guarantee. The metadata fallback path ensures a
half-shipped block (schema before editor copy) is still surfaced rather
than silently dropped.

## Consequences

- `@sosb/editor-app` gains `axe-core` as a dev dep so the new dialog and
  block list are covered by an a11y regression test in the same style as
  the renderer's `accessibility.test.ts`.
- `@sosb/editor-state` exports four new helpers: `createHistoryStore`,
  `serializeHistory`, `deserializeHistory`, `saveHistory`, `loadHistory`,
  plus the three block-list mutators `addBlockToPage`,
  `removeBlockFromPage`, `moveBlockInPage`. None require new dependencies.
- The block-library catalog adds a single per-type metadata table inside
  `@sosb/editor-app/src/block-catalog.ts`. Future blocks (#9-#22) extend
  this table alongside their schema landing.
- The Playwright e2e suite adds `e2e/block-library.spec.ts` covering the
  picker open / pick / append flow, the move-down + Ctrl+Z round-trip,
  and a real-browser HTML5 drag-and-drop.
- Top bar gains Undo / Redo buttons (`data-testid="undo-button"` and
  `data-testid="redo-button"`) with disabled state mirroring the
  history's `canUndo` / `canRedo`.

## Alternatives considered

- **Patches with a small action vocabulary** — see Rationale.
- **`@dnd-kit/core` for the DnD layer** — see Decision.
- **Co-locating history with autosave inside one file** — see
  "Persistence across sessions".
- **Storing the picker's metadata table inside `@sosb/schema`** — see
  Decision.
- **Coalescing a stream of form keystrokes into a single history entry**
  — Worth doing later. v1 pushes one history entry per keystroke; the
  bounded capacity keeps memory under control. Coalescing would require
  a "session token" or a debounce on the history side; the current code
  is a clean platform for it without committing to a specific policy
  yet.

## Out of scope

- **Inter-page block move.** Per the issue's explicit "out of scope".
- **Block templates / presets.** Per the issue's explicit "out of scope".
- **Multi-select for batch operations.** Per the issue's explicit "out
  of scope".
- **Collaborative undo / multi-user history.** Per the issue's explicit
  "out of scope".
- **Coalescing keystroke bursts into a single history entry.** Documented
  above; intentionally deferred.
- **A persistent VFS driver wired up by default.** That is the host
  shells' (#36 / #38) responsibility per ADR 0005.
- **Visual styling / theming of the picker and block list.** v1 ships
  structural markup with `data-testid` hooks; theme work lands with
  #28-#31 / #47.
