# 0006 — Electron shell: BrowserWindow, IPC bridge, packaging

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #35

## Context

Issue #35 asks for the Electron desktop shell: a main process that
launches a `BrowserWindow` running the same editor code as the browser
SPA, an IPC bridge for native file dialogs and recent-sites persistence,
and an `electron-builder` configuration that produces unsigned `.exe`
(NSIS), `.dmg`, and `.AppImage` installers per platform.

The PRD pins the broad strokes (Implementation Decisions → Distribution,
Asset pipeline, Persistence):

- Two distribution artifacts share one codebase: an Electron desktop app
  and a hosted browser SPA.
- Electron persistence is the real filesystem — sites are folders on
  disk.
- Auto-update via `electron-updater` and the Sharp-based asset pipeline
  are explicit follow-ups (#36 and #37).
- Mac code signing is deferred to a maintainer-only issue (#44, closed
  as wontfix; see `.out-of-scope/mac-code-signing.md`).

The PRD does **not** pin:

- The IPC channel naming convention or method shape.
- The renderer security posture for the BrowserWindow.
- The recent-sites persistence format or location.
- The dev-vs-packaged URL resolution strategy.
- The electron-builder file glob and per-platform target list.

This ADR records those choices.

## Decision

### Eight focused modules under one package

`@sosb/electron-shell` is laid out as small, single-responsibility
modules so the unit-testable seams are explicit and Electron's runtime
APIs (which are global, side-effecting, and not available in node-mode
vitest) live only in `main.ts` and `preload.ts`. The other six files
take their Electron dependencies via parameters and are unit-tested
without a real Electron process.

| Module                      | Surface                                                                                 | Touches Electron at runtime?   |
| --------------------------- | --------------------------------------------------------------------------------------- | ------------------------------ |
| `ipc-channels.ts`           | constants `IpcChannels`, `IPC_CHANNEL_LIST`                                             | no — strings only              |
| `recent-sites.ts`           | `loadRecentSites` / `addRecentSite` / `clearRecentSites` over a `RecentSitesStore` shim | no                             |
| `dialog-handlers.ts`        | `createOpenSiteHandler` / `createSaveSiteHandler` over an `ElectronDialogLike` shim     | no                             |
| `editor-url.ts`             | pure function `resolveEditorUrl`                                                        | no                             |
| `browser-window-options.ts` | pure function `buildBrowserWindowOptions`                                               | no                             |
| `preload-surface.ts`        | `buildPreloadApi(ipcRendererLike)` → `PreloadApi`                                       | no — `ipcRenderer` is injected |
| `register-ipc-handlers.ts`  | wires every handler via shims                                                           | no                             |
| `main.ts`                   | composes everything; calls real `electron.app/dialog/ipcMain/BrowserWindow`             | yes                            |
| `preload.ts`                | calls `contextBridge.exposeInMainWorld(PRELOAD_API_KEY, buildPreloadApi(...))`          | yes                            |

This deliberately keeps Electron's globals at the boundary and the
business logic in pure modules — the same pattern `@sosb/editor-state`
uses for browser-storage.

Rejected:

- **One file per process** (just `main.ts` + `preload.ts`). Forces
  Electron-runtime tests for trivially-testable logic; we'd be CI-bound
  on a non-headless Electron run for every regression.
- **A single `electron.ts` re-exporting everything Electron-shaped.**
  Couples the unit-testable modules to the Electron import graph; in
  vitest, `import "electron"` blows up unless mocked.

### IPC channel naming: `sosb:<verb>-<noun>` via a constants object

Channels are defined ONCE in `ipc-channels.ts` and imported by both the
preload and the main router. Three properties make the design defensible:

- **Single source of truth.** A typo on either side breaks IPC silently
  (the renderer sees a Promise rejection with "no handler for channel");
  importing from a constants module turns this into a typecheck error.
- **Namespace.** Every channel starts with `sosb:` so messages cannot
  collide with a stray `ipcRenderer.send` from a third-party library.
- **Enumerable.** `IPC_CHANNEL_LIST` is a runtime array of every channel
  the shell uses, which `registerIpcHandlers` walks for cleanup and which
  `register-ipc-handlers.test.ts` walks to assert "every channel has a
  handler" — a regression here is the single most likely silent failure
  mode of an IPC-heavy app.

The five channels for #35:

```ts
"sosb:open-site-dialog"; // → string | null
"sosb:save-site-dialog"; // (opts?) → string | null
"sosb:get-recent-sites"; // → readonly string[]
"sosb:add-recent-site"; // (path) → readonly string[]
"sosb:clear-recent-sites"; // → void
```

The Sharp / asset-pipeline channels (`sosb:resize-image`, etc.) are owned
by #37 and deliberately omitted here.

Rejected:

- **Inline string literals.** A string typo is a runtime no-op; we'd
  rather catch it at import-resolution time.
- **A single `sosb:invoke` channel with an internal method dispatcher.**
  Hides the surface from devtools' IPC tracing and from the
  channel-by-channel rate limits some Electron versions enforce.

### Renderer security: nodeIntegration off, contextIsolation on, sandbox on

`buildBrowserWindowOptions` returns `webPreferences` that match
Electron's documented secure defaults. The renderer cannot reach Node
APIs directly; the only path between renderer code and the operating
system is the `window.sosb` surface the preload exposes.

```ts
{
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  preload: <abs path to preload.js>,
}
```

The preload uses `contextBridge.exposeInMainWorld(PRELOAD_API_KEY, api)`
so the API lives on `window.sosb` in a separate JavaScript context; page
scripts cannot reassign or shadow methods on it. The exposed surface is
locked to `PRELOAD_API_METHODS` — a five-method allowlist, asserted by a
unit test.

Rejected:

- **`nodeIntegration: true`.** The PRD's security posture and Electron's
  own docs both flag this as the single biggest source of supply-chain
  vulnerabilities. The shell never needs Node in the renderer.
- **`contextIsolation: false` "for now."** Once renderer code starts
  poking `window.electron` directly, retrofitting context isolation
  becomes a refactor. Setting it correctly on day one is free.
- **A direct `ipcRenderer` exposure on the renderer.** Defeats the
  allowlist; gives the page arbitrary IPC reach.

### Editor URL resolution: pure function over `app.isPackaged`

`resolveEditorUrl({ isPackaged, rendererRoot, devServerUrl? })` is the
single place that decides which URL the BrowserWindow loads:

- Packaged → `file://<rendererRoot>/index.html`. The renderer root is an
  absolute path supplied by the main process (it resolves it relative to
  the running main bundle, which sits next to the unpacked `renderer/`
  directory).
- Dev → `http://localhost:5173/` (vite's default), overrideable via
  `SOSB_DEV_SERVER_URL` for non-default vite ports or remote dev
  loopback scenarios.

Rejected:

- **Inlining the choice in `main.ts`.** Forces an Electron runtime to
  test it; the URL choice is the most likely place to silently load the
  wrong window.
- **Hardcoding to dev or to file:// only.** Cripples one of the two
  workflows the issue's AC explicitly mentions.

### Recent sites: dedup-on-add, FIFO cap, JSON-on-disk

The recent-sites menu's data layer is a tiny three-method `RecentSitesStore`
interface (`read` / `write`) — all the dedup-and-cap logic lives in
`recent-sites.ts` and is unit-tested in node against an in-memory array.
At runtime, `main.ts` wires a JSON-on-disk store rooted at
`app.getPath("userData")/recent-sites.json` (Electron resolves that to a
per-user, per-platform location).

The list is capped at `RECENT_SITES_LIMIT = 10`. Re-adding an existing
path moves it to the front (no duplicates). A missing or malformed file
yields an empty list — the renderer treats that as "no recent sites".

Rejected:

- **`electron-store`.** Adds a runtime dep for behaviour we can express
  in 25 lines.
- **`localStorage` inside the renderer.** Same problem the editor-state
  ADR (#0005) called out: forces a browser context, can't be node-tested,
  and the PRD's "persists across launches" AC needs OS-level storage,
  not a per-renderer `localStorage` partition.
- **`IndexedDB`.** Wrong layer; the recent-sites list is five kilobytes
  of strings, not a paged datastore.

### electron-builder config: per-target list, NSIS for Windows, DMG for Mac, AppImage for Linux

The config (`electron-builder.config.cjs`) is a CommonJS file because
electron-builder's native config loader uses `require()`; using `.cjs`
lets the rest of the workspace stay ESM. It declares:

- `appId: "ro.cta.sosb"` — fails-loud requirement.
- `productName: "Student Org Site Builder"`.
- `mac.target: [{ target: "dmg", arch: ["x64", "arm64"] }]`.
- `mac.identity: null` — explicitly disables code signing (out of scope).
- `win.target: [{ target: "nsis", arch: ["x64"] }]`.
- `nsis.oneClick: false` (opt-in installer with a wizard).
- `nsis.allowToChangeInstallationDirectory: true`.
- `linux.target: [{ target: "AppImage", arch: ["x64"] }]`.
- `files: ["dist/**/*", "renderer/**/*", "package.json", ...exclusions]`
  — narrow whitelist; tests, sources, and maps are excluded.

The `mac.identity: null` line is load-bearing. Without it,
electron-builder hunts for a Developer ID and crashes on a fresh CI
runner with a confusing error. Setting it to `null` is the documented
way to say "I know I'm building unsigned, please don't try."

Rejected:

- **Code signing for v1.** See `.out-of-scope/mac-code-signing.md` and
  issue #44.
- **A single combined target `["nsis", "dmg", "AppImage"]` under
  `electron-builder.target`.** Loses the per-platform options (NSIS
  installer-style flags, dmg architecture spread, AppImage
  arch). Each platform has different idiomatic options; the per-target
  arrays let us tune them independently.
- **Squirrel.Windows / portable / msi.** NSIS is the most-tested
  electron-builder Windows target and supports per-user installs without
  admin elevation.
- **Snap / deb / rpm for Linux.** AppImage is single-file and
  distribution-agnostic; Snap and deb add per-distro overhead the
  current target audience (student organisations) doesn't ask for.

### Renderer bootstrap: static HTML loaded via `file://`

The packaged build ships a static `renderer/index.html` that the
BrowserWindow loads via `file://`. The HTML declares a strict
`Content-Security-Policy` (`script-src 'self'`, `default-src 'self'`,
etc.) and a `<script type="module" src="./renderer.js">` placeholder for
the bundled editor entry.

The `renderer.js` bundle itself is NOT produced by this issue — bundling
the editor-app for the Electron renderer is staged with the asset
pipeline (#37) so the renderer can pull in the Sharp-backed asset path
in one step. For #35 the renderer directory is the file shape and the
CSP envelope; the bundling wiring lands with the asset issue.

Rejected:

- **Injecting renderer code from the main process at runtime.** Defeats
  the CSP `script-src 'self'` posture and makes the asset-pipeline
  follow-up materially harder.
- **Loading the editor-app's source `.tsx` directly.** Electron's
  renderer doesn't run a TS compiler; we need a pre-bundled JS file
  (which is what #37 will produce).

## Rationale

The most subtle constraint is "the Electron app launches the editor and
runs the same code as the browser version." Two equivalent designs satisfy
it:

1. The Electron renderer imports `@sosb/editor-app` and mounts it just
   like the browser shell does.
2. The Electron renderer loads a pre-built browser SPA bundle — the
   same artifact the hosted browser SPA uses.

We chose (1) for v1: the renderer mounts `@sosb/editor-app` against a
DOM. The advantage is Electron-specific behaviours (Sharp asset
pipeline, native filesystem VFS) can be wired by passing a different
`onImport` / `onExport` to the same `<EditorApp>` component. (2) becomes
attractive once the browser SPA bundle exists as a tagged release
artifact; for now the editor-app is the import surface.

The IPC channel allowlist (just five methods) was kept narrow on
purpose. Each new IPC channel is a security boundary; the temptation to
add a "convenience" channel that the renderer hits with arbitrary
arguments is exactly how Electron CVE histories accumulate. Channels are
added when an AC demands one, not before.

The recent-sites store reuses the editor-state ADR's pattern — caller
chooses the persistence layer; the in-memory implementation is the
test seam. This keeps the unit tests independent of Electron and lets
the same logic be reused if a maintainer ever wants to ship recent
sites in the browser SPA via `localStorage`.

## Consequences

- `pnpm -F @sosb/electron-shell add electron@^41 electron-builder@^26 -D`
  (recorded in the package's `devDependencies`).
- `@sosb/electron-shell` declares `@sosb/editor-app` as a workspace
  dependency so the renderer can mount the editor without dipping into
  the global npm graph.
- The `tsconfig.test.json` mirrors the editor-app pattern (extends the
  base config, adds `types: ["node"]` because the dialog handlers and
  recent-sites store use `node:fs` / `node:path`). Test files run under
  vitest's default node environment — no jsdom needed for the shell.
- The CI build job already runs `pnpm build`, which now includes
  `tsc --build` for `@sosb/electron-shell`. Cross-platform packaging
  (`electron-builder` per-platform) lands as a release-workflow task in
  a follow-up issue.
- The 7 pre-existing prettier warnings carried over from
  `issue/7-editor-shell` remain unresolved by this issue; they're owned
  by the editor-shell merge.
- Future Electron-side work plugs in cleanly:
  - #36 (auto-update) extends `main.ts` with `electron-updater` wiring;
    no module reorganisation needed.
  - #37 (Sharp asset pipeline) adds `sosb:resize-image` and similar
    channels to `IpcChannels`, a new handler factory, and a renderer
    bundle that calls `window.sosb.resizeImage(...)`.
  - #44 (mac code signing, currently wontfix) flips
    `mac.identity: null` to a real identity and adds an `afterSign`
    notarization hook.

## Alternatives considered

- **Pack the editor-app's HTML as a string and inject it via
  `loadURL("data:...")`.** Loses devtools-friendly URLs, breaks `file://`
  asset references inside the editor's renderer code, and doesn't scale
  past the trivial bootstrap.
- **Use Electron Forge instead of electron-builder.** Forge's plugin
  story is more elegant, but the v1 release process is simpler with
  electron-builder's per-platform target tables; `nsis` and `AppImage`
  configurations are a known quantity.
- **Build a custom IPC layer with `MessageChannelMain`.** Strictly
  faster than `ipcRenderer.invoke`, but the v1 IPC volume is five
  methods called on user-action timescales. The added complexity buys
  us nothing measurable.
- **Use a single `ipcMain.on` channel with a method dispatcher.** Loses
  per-channel debug visibility and confuses devtools' IPC inspector.

## Out of scope

- Auto-update integration via `electron-updater` — owned by #36.
- Sharp-based asset pipeline IPC + renderer bundle — owned by #37.
- File-system-backed VFS driver (sites-as-folders persistence) — also
  #37; the IPC dialog handlers in this issue produce paths that #37
  consumes, but the FS driver itself is that issue's deliverable.
- App icons per platform (`build/icon.{png,ico,icns}`) — produced and
  wired by the release-workflow issue when the icon assets land. This
  issue ships the `electron-builder` config that points at
  `directories.buildResources: "build"` so the icons drop in without
  config changes.
- Mac code signing / Apple notarization — see
  `.out-of-scope/mac-code-signing.md` and #44 (closed as wontfix).
- Cross-platform release workflow (per-runner CI matrix) — release
  workflow issue.
- Recent-sites menu UI rendering inside the editor — this issue ships
  the IPC layer; the menu's UI lives in `@sosb/editor-app`.
