# 0006 — Welcome screen and recent-sites storage

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #32

## Context

Issue #32 asks for the **welcome screen**: the pre-editor entry surface
shown on Electron app launch (with no recent sites), on browser-editor
first visit, and via "New Site" menu action. Per the PRD:

- Four primary paths: **wizard** guided creation (#33), **template** start
  from a curated demo (#34), **import** an existing zip, **blank** start.
- A **recent sites** list (~5 most recent) with click-to-open and
  right-click "Show in Finder/Explorer" (Electron only).
- **Drag-drop zip import** supported anywhere on the screen.

The PRD pins the user-facing shape but does **not** pin:

- Where the welcome screen lives (own package vs. inside `@sosb/editor-app`).
- How the recent-sites list is persisted across reload.
- The shape of the recent-sites file format.
- How the wizard / template / import / blank paths are dispatched
  (single component with callbacks vs. four separate routes).

This ADR records those choices.

## Decision

### The welcome screen lives in `@sosb/editor-app` as a sibling to `<EditorApp>`

A new component `<WelcomeScreen>` ships from the `@sosb/editor-app`
package's `src/welcome-screen.tsx`, exported alongside `<EditorApp>`
from the package's `index.tsx`. The boot flow becomes:

1. Host (`browser-shell` / `electron-shell`) loads recents via
   `loadRecentSites(vfs)`.
2. Host renders `<WelcomeScreen recents={...} onWizard onTemplate
   onImport onBlank onImportFile onOpenRecent onRevealRecent />`.
3. On any callback, the host swaps the rendered component for
   `<EditorApp initial={...} />` with the chosen site.

A new sibling package was rejected: the welcome screen is small (one
component, ~150 LoC), shares the same Preact + zod + VFS dependency
graph as the editor shell, and the only consumers are the same shells
that already consume `@sosb/editor-app`. A sibling package would add a
cross-package import for no isolation gain.

### Four paths surfaced as a static array, dispatched via callback props

`<WelcomeScreen>` declares the four paths (`wizard`, `template`,
`import`, `blank`) in a module-level `PATHS` array that the renderer
walks. Each path is a `<button>` with a `data-welcome-path="<id>"`
attribute, and an `onClick` that fires the matching callback prop.

Rejected:

- **A `<Route>`-based screen.** Brings a router dependency for what is
  effectively a switch on which callback the host wires.
- **Discriminated union prop `{ kind: 'wizard' | 'template' | ... }`.**
  Forces the host to model state the screen does not own; the host
  cares about *what was chosen*, not *what the screen is showing*.
- **A reducer pattern internal to the screen.** Same problem: the
  screen has no internal state worth managing beyond a drag-active
  hover boolean.

The callbacks are all optional — the screen renders before #33 / #34
land. Buttons whose callback is missing render but no-op on click.

### Drag-drop zip import as the screen's primary affordance

The whole screen is a single drop zone. Dropping a `File` fires
`onImportFile(file)`. The host calls `importFromZip(file)` (the `File`
is a `Blob`) and renders the editor with the imported site.

Drag-active state is local to the screen — `useState<boolean>(false)`,
toggled on `dragover` / `dragleave`. The state surfaces as a
`data-drag-active="true"|"false"` attribute the host's CSS can react
to (the screen ships no styles itself; styling is owned by the shell).

### Recent-sites storage: caller-injected VFS, file at `welcome/recent-sites.json`

The recent-sites list is persisted through a `Vfs` driver the caller
chooses, mirroring the auto-save persistence pattern from ADR 0005.
`loadRecentSites(vfs)` reads the list; `recordRecentSite(vfs, entry)`
appends-and-dedupes-and-trims.

- File path: `RECENT_SITES_PATH = "welcome/recent-sites.json"`. Stable
  across editor versions.
- Limit: `RECENT_SITES_LIMIT = 5`. Mirrors the PRD's "last ~5 sites".
- Format: a JSON array of `{ key, label, lastModified }` entries.
  - `key` is host-opaque (an absolute filesystem path on Electron, a
    VFS path / URL on the browser host).
  - `label` is the display name (typically the org name).
  - `lastModified` is Unix epoch ms.
- Forward-compat: extra fields per entry are tolerated on read but
  not echoed back on write.
- Malformed file: read returns `[]` (does not throw), so a corrupted
  recents file does not crash the welcome screen.

The browser shell will inject a localStorage-backed VFS driver (or
the IndexedDB driver from #37 once it lands); the Electron shell will
inject a real-FS VFS driver (or the Electron-FS driver from a future
issue). Neither shell is owned by this issue.

Rejected:

- **`localStorage` directly inside the recents module.** Forces a
  browser context on the package, breaks node-runnable tests, and
  duplicates storage abstractions — the project already has a VFS
  abstraction (#6) and ADR 0005 already chose VFS for editor
  auto-save. Two parallel storage layers would be the wrong default.
- **`@sosb/vfs/MemoryDriver` only.** Would not survive a reload by
  itself; the v1 host shells (browser-shell, electron-shell) wire a
  persistent driver behind the same interface.
- **A bespoke DB schema (Dexie, sql.js).** A 5-row list with a single
  list/append operation does not need a database.

### Recent-sites are dedupe-by-key, most-recent-first

`recordRecentSite` prepends the new entry, removes any prior entry
with the same `key` (so re-opening a site does not double-list it),
and trims to `RECENT_SITES_LIMIT`. Entries carry their own
`lastModified` so a future "sort by recency vs. label" UI is a
client-side rendering concern, not a persistence concern.

### Blank-site factory in `@sosb/editor-app`

`createBlankSite()` returns a fresh `Site` with one page containing
one hero block — the minimal valid site per the PRD. The factory:

- Lives in `packages/editor-app/src/blank-site.ts`.
- Imports `SITE_SCHEMA_VERSION` and `HERO_BLOCK_VERSION` from
  `@sosb/schema` so a future schema bump fails compile here rather
  than producing an invalid blank site at runtime.
- Returns a fresh object literal each call (no shared template); the
  output validates clean against `validate()`.

Rejected: putting the factory in `@sosb/schema`. The schema package is
deep-module — schemas + validation + migration. A "make a blank site"
builder is a UI concern (the welcome screen's blank path), so it
sits at the same layer as the welcome screen.

### Right-click "reveal in OS" via `onRevealRecent` callback

The welcome screen surfaces right-click as `onContextMenu` →
`onRevealRecent(key)`. The host decides whether the gesture is
supported on the current platform. On Electron the host calls
`shell.showItemInFolder`; on the browser host the callback is
typically not wired (right-click no-ops or shows the browser menu).

This keeps the screen platform-agnostic: it surfaces the gesture, and
the host implements the platform-specific reveal.

## Rationale

The most subtle requirement is "Recent sites list populated and
clickable; right-click reveals OS file location (Electron)." Two
designs satisfy it:

1. The screen owns the recents persistence directly (reads/writes
   localStorage from inside the component).
2. The screen takes recents as a prop and surfaces callbacks; the
   host picks the storage driver.

We chose (2) because:

- It mirrors the auto-save persistence pattern from ADR 0005, keeping
  one storage abstraction across the editor.
- It keeps the welcome screen node-testable without a DOM-storage
  polyfill.
- Browser and Electron need different storage backends anyway
  (browser → localStorage / IndexedDB / OPFS; Electron →
  filesystem). The caller-chooses-driver pattern lets both hosts
  share the same recents module.

The four-paths static array (vs. a router or a reducer) was chosen
because the welcome screen has effectively zero internal state — it
surfaces affordances and fires callbacks. Adding state machinery for
"which path is selected" would give the screen ownership of state
that belongs to the host.

## Consequences

- A new file lives in the `@sosb/editor-app` package:
  `welcome-screen.tsx`, `recent-sites.ts`, `blank-site.ts`. They
  re-export from `index.tsx`.
- The browser-shell and electron-shell will, when they land, inject a
  persistent VFS driver into `loadRecentSites` / `recordRecentSite`.
  Neither shell is touched here.
- Right-click reveal is a host concern; the screen surfaces the
  gesture but does not depend on Electron APIs.
- The recents file format is stable across the v1 series. Future
  fields per entry (favicon URL, last-language, etc.) can be added
  additively — the loader tolerates extra fields and the writer drops
  them, so old editors reading new files do not crash.
- The Playwright `e2e/welcome-screen.spec.ts` covers the screen in a
  real browser; the unit tests under
  `packages/editor-app/test/welcome-screen.test.tsx`,
  `recent-sites.test.ts`, `blank-site.test.ts`, and
  `welcome-flow.test.tsx` cover the same logic against jsdom and node.

## Alternatives considered

- **Dedicated `@sosb/welcome` package.** Would isolate the screen but
  bring a cross-package import for no test-isolation benefit (the
  same jsdom + Preact toolchain is already in `@sosb/editor-app`).
  Revisit if the welcome surface ever grows a wizard machine of its
  own (#33 keeps that machine in `@sosb/wizard`).
- **A `WelcomeApp` that owns its own state and dispatches into the
  editor.** This shifts state ownership from the host into the
  screen. Same outcome, but the host loses control over persistence
  and routing. Rejected because the host (browser-shell /
  electron-shell) is the natural owner of "what does the user see
  next?"
- **Storing recents in `localStorage` directly.** See "Rejected"
  above. Keeps storage in one place (the VFS) and avoids forcing a
  browser context on the recents module.
- **Storing recents inline in `editor/autosave.json`.** Coupling the
  current-edit autosave to the cross-session recents list. Rejected:
  two different lifetimes (one rewrites every keystroke, one rewrites
  only on user action) and two different consumers (editor vs.
  welcome screen). Separate files, separate paths.

## Out of scope

- Wizard step machine — owned by #33 (`@sosb/wizard`).
- Demo template content / curated site — owned by #34.
- Recent-sites file format design beyond the v1 shape (sort-by
  field, pinning, grouping by org) — defer until a use case exists.
- Cloud sync of recents across machines — explicitly out of scope per
  triage of #32.
- IndexedDB-backed VFS driver (#37), OPFS-backed VFS driver (#35),
  and the per-shell wiring (browser-shell, electron-shell). The
  recents module talks to whatever VFS the caller injects.
- i18n of the welcome screen labels — owned by #34. v1 ships
  English-only labels.
