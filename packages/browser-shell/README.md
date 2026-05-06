# @sosb/browser-shell

Service worker, archival single-file build, and persistent VFS driver — the
host shell that wraps the editor SPA for browser-only deployments.

Tracking issue: #38. ADR 0008 records the design.

## What's inside

| Sub-module | Responsibility |
|------------|----------------|
| `IndexedDbDriver` / `openIndexedDbDriver(opts)` | Persistent `Vfs` driver. Composes with `createEditorState({ vfs })` so the editor's auto-save survives reloads. |
| `buildServiceWorkerScript(opts)` | Pure function that emits the worker source as a string. Hosts write the result to `/sw.js`. |
| `registerServiceWorker(opts)` | Page-side helper. Fires `onUpdateAvailable()` when a new SW is installed behind an active controller — that's the cue to show the "Versiune nouă disponibilă" toast. Returns `applyUpdate()` for the user-triggered reload. |
| `buildArchival({ html, assets })` | Pure transformation: inline a virtual asset map into a single self-contained HTML. |

## Service worker caching

The generated worker uses **cache-first with background revalidation**:

- On `install`: precache `precacheUrls` into a per-version cache.
- On `activate`: delete prefix-matching caches whose name differs from the
  current version (so a version bump frees space).
- On `fetch`: serve from cache; fall back to network. The cached entry is
  refreshed in the background so the next reload sees the latest bytes.

Bump the `version` option on every deploy. The activate handler's purge
removes the previous deploy's cache automatically.

## Archival single-file build

`pnpm build:archival` produces `dist/archival/builder.html`. The build
inlines every `<script src>`, `<link rel="stylesheet" href>`, and
`<img src>` reference into a single document.

### Documented limitations of the archival HTML

The archival edition runs from `file://` and from any static host, but the
sandboxed `file://` origin imposes a few constraints:

- **OPFS is unavailable.** Browsers refuse to provide OPFS to `file://`
  origins. The archival edition therefore runs with the in-memory VFS
  only — auto-save does not persist across page reloads. Use the export
  flow (zip) to save your work.
- **IndexedDB is best-effort.** Most modern browsers expose IndexedDB to
  `file://` (Chromium, Firefox), but Safari restricts it. Treat
  persistent storage as optional in the archival mode.
- **No service worker.** Service workers require an HTTP(S) origin; the
  archival edition does not register one. (The hosted edition does.)
- **Cross-origin assets are not inlined.** Any `https://...` ref in the
  shell HTML is left untouched — the archival HTML cannot fetch it at
  build time. Keep the shell self-contained.

The archival build is the canonical disaster-recovery artifact: a copy of
the editor that runs forever from a USB stick, even if the project's
maintainers go away. Pair it with an exported zip of your site data.

## Persistent VFS in the hosted browser shell

The hosted edition (HTTP origin) wires `openIndexedDbDriver({ databaseName })`
into `createEditorState({ vfs })`. Every `update()` debounce-saves the
snapshot at `editor/autosave.json`; on next launch the shell calls
`loadAutosave(vfs)` to seed the editor with the previous snapshot.

OPFS is a deliberate follow-up. The PRD pins OPFS as the primary with
IndexedDB as the fallback; v1 ships only the fallback so every supported
browser persists. A sibling OPFS driver lands later without touching this
package's API.

## Build target

`pnpm typecheck`, `pnpm test`, `pnpm build` all exercise this package.
`pnpm build:archival` runs the archival CLI.
