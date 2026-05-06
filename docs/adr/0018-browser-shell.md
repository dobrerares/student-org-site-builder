# 0008 — Browser shell: service worker, archival single-file build, persistent VFS

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #38

## Context

Issue #38 asks for the browser-only shell that wraps the editor SPA with
three things the PRD pins as v1 requirements:

1. **Service worker.** Cache the SPA assets so the editor loads offline,
   and surface a "Versiune nouă disponibilă" toast when a new version has
   been deployed (PRD: Updates & versioning, browser editor; story #76).
2. **Archival single-file build.** Produce a `builder.html` that runs from
   `file://` with no server, so users can keep editing offline indefinitely
   (PRD: Privacy & ownership, story #82).
3. **Persistent VFS.** The editor's auto-save (#7, ADR 0005) is wired
   through the `@sosb/vfs.Vfs` interface; the browser shell's
   responsibility is to compose the editor with a persistent driver (the
   PRD's "OPFS-backed VFS with IndexedDB fallback").

The PRD does **not** pin:

- The exact caching strategy inside the service worker.
- The bundler that produces the archival single-file HTML.
- Whether v1 ships an OPFS driver, an IndexedDB driver, or both.
- The protocol between the page and the SW for the "new version" toast.

This ADR records those choices.

## Decision

### Three sub-modules under one package, narrow seams between them

`@sosb/browser-shell` exposes:

- `IndexedDbDriver` / `openIndexedDbDriver(opts)` — a `Vfs` implementation
  backed by IndexedDB. Same surface as `MemoryDriver`, drop-in substitute.
- `buildServiceWorkerScript(opts)` — pure function that emits the
  worker source as a string. The host writes that string to `/sw.js` (or
  embeds it via the build pipeline).
- `registerServiceWorker(opts)` — page-side helper that calls
  `navigator.serviceWorker.register()` and converts the lifecycle events
  into a single `onUpdateAvailable` callback.
- `buildArchival({ html, assets })` — pure function that inlines `<script
  src>` / `<link rel="stylesheet" href>` / `<img src>` references against
  an asset map.

The split keeps each sub-module independently testable in vitest's node
runner (with `fake-indexeddb/auto` for the persistent VFS, and
DOM-free shape tests for the SW script). The full e2e — SW caching the SPA
in real Chromium and serving it offline — is a Playwright spec.

Rejected:

- **One opaque `BrowserShell` class.** Fine in v0 but couples the SW
  lifecycle to the persistent-VFS lifetime to the archival build; the
  three concerns evolve at different rates and the tests would have to
  drag in unrelated dependencies to assert any one of them.
- **Per-package split** (`@sosb/sw`, `@sosb/archival-build`,
  `@sosb/persistent-vfs`). Three workspace packages with overlapping
  consumers (the editor, the host shell) increase the dependency-graph
  surface for marginal payoff. Single package with sub-modules is the
  smallest commitment that keeps the seams clean.

### Service worker caching strategy: cache-first, version-bump invalidation

The generated worker uses **cache-first with revalidation in background**:

- On `install`: open `${prefix}-${version}` (e.g. `sosb-v1`) and
  `cache.addAll(precacheUrls)`. Then `self.skipWaiting()`.
- On `activate`: enumerate `caches.keys()`, delete any prefix-matching
  cache whose name differs from the current version, then
  `self.clients.claim()`.
- On `fetch`: serve from cache if present, otherwise fall back to network
  (and cache the response). The cached copy is revalidated in the
  background — the user gets the cached bytes immediately, the cache
  refreshes in `event.waitUntil` so the next reload sees the latest.

The strategy fits the editor profile: the SPA shell is large, deterministic
between deploys, and the user's data is stored separately (IndexedDB +
zip export). Stale-while-revalidate keeps the editor instantly available
offline while still propagating fixes once the user comes back online.

The "new version available" toast (PRD's "Versiune nouă disponibilă")
is driven by the lifecycle event that fires when a *new* SW reaches the
`installed` state behind an existing controller. The page-side helper
`registerServiceWorker(opts).onUpdateAvailable` exposes that exact moment
as a single callback, so the host UI does not have to reason about
`updatefound` / `statechange` directly.

The user-triggered reload sends `{ type: "SKIP_WAITING" }` to the waiting
worker via `applyUpdate()`, which the worker handles by calling
`self.skipWaiting()`. The page reload is left to the host UI — that gives
the host control over save-state-protection (auto-save flush before
reload, etc.).

Rejected:

- **Network-first.** A flaky connection makes the editor unusable —
  the user waits for the network timeout on every navigation. The PRD's
  "Privacy & ownership" stance also prefers minimal network calls.
- **Cache-only with an explicit refresh button.** Users would never
  receive bug fixes without manually invalidating; the SW lifecycle gives
  us update detection for free.
- **Stale-only with no cache update.** The cache would eventually be
  cleared by the browser and the user would face a hard offline failure.

### Archival single-file build: hand-rolled string-splice inliner

`buildArchival({ html, assets })` runs three pure passes:

1. `<script src="<local-url>">` → `<script>` + the asset's text, with
   any literal `</script>` payload split (`<\/script`) so the inlined
   text cannot break out of the wrapping tag.
2. `<link rel="stylesheet" href="<local-url>">` → `<style>` + the asset's
   text, preserving a `media` attribute if present.
3. `<img src="<local-url>">` → `<img src="data:<mime>;base64,<...>">` with
   an extension-sniffed mime type.

Cross-origin refs (`https://`, `//`) are passed through untouched — the
archival build cannot fetch them at build time and inlining a placeholder
would silently break the page.

The CLI `pnpm build:archival` (`scripts/build-archival.mjs` →
`scripts/run-archival-build.ts`) bundles the editor's archival entry via
esbuild, runs the inliner, and writes `dist/archival/builder.html`. The
current build is **352 KiB** — well under the 3 MB AC budget.

Rejected:

- **`vite-plugin-singlefile`.** Adds a plugin + a vite build path that
  doesn't otherwise exist in this repo. The monorepo already uses esbuild
  for the browser-runnability checks and the archival build needs the same
  bundler — adding vite is two surfaces for one need.
- **Rollup with `rollup-plugin-inline-source`.** Same issue, plus rollup
  is not in the workspace.
- **Bundle into one file via esbuild's own inlining
  (`format: "iife"` + `loader: { ".png": "dataurl" }`).** Promising, but
  doesn't compose with the editor app's existing `format: "esm"` bundle
  config and would fork the bundling path. Hand-rolled inlining is a
  ~200-line module the test suite covers exhaustively.

### Persistent VFS: IndexedDB driver via the existing `Vfs` interface

The driver implements `@sosb/vfs.Vfs` and passes the shared
`runVfsConformance` suite — every conformance test (32 tests covering
read/write/list/delete/copy/has + path validation + binary content)
delegates to the same suite the `MemoryDriver` and `ZipDriver` use.

Tests use `fake-indexeddb/auto`; the production driver runs through
`globalThis.indexedDB`, which is byte-equal to the fake's behaviour for
the operations we use.

The driver is **opt-in** at the editor's boot path: the host wires
`createEditorState({ vfs: await openIndexedDbDriver({ databaseName }) })`.
This matches ADR 0005's "caller-chosen driver" stance — the editor
package stays storage-API-agnostic.

OPFS is **not** in this driver. Three reasons:

- The PRD pins OPFS as the *primary* with IndexedDB as the *fallback*.
  Shipping a single driver in #38 lets us validate the caller-chosen-driver
  pattern end-to-end without two parallel implementations to maintain.
- OPFS requires a different fakery for tests (no equivalent of
  `fake-indexeddb`), so the test surface would be uneven.
- IndexedDB has the broadest browser support and is the conservative v1
  pick; OPFS can land as a sibling driver later without touching this
  module.

We document OPFS as a deliberate follow-up rather than a gap.

Rejected:

- **`localStorage`.** ~5MB cap, synchronous, string-only — at odds with
  the VFS contract (which is binary `Uint8Array` and async).
- **A `Cache Storage`-backed driver.** The Cache API targets HTTP
  Request/Response, not arbitrary key-value blobs; conformance would need
  awkward URL synthesis.
- **OPFS in this issue.** Out of scope per the explicit hint in the issue
  body; landing it as a separate driver keeps the surface narrow.

### Page→worker protocol: `{ type: "SKIP_WAITING" }`

A single message keyword the worker recognises in its `message` listener.
We do **not** invent a richer protocol because the only page→worker action
v1 needs is "take over now". A version-handshake / cache-purge protocol
would be premature.

Rejected:

- **Custom `MessageChannel` with bidirectional acks.** Useful for an
  interactive update flow ("show me what changed"), but the PRD pins a
  toast + reload — no second channel needed.

## Rationale

The most subtle decision is the SW's cache invalidation: getting it wrong
strands users on stale code. The version-stamped cache name + on-activate
purge is the straightforward pattern most production SWs converge on, and
it keeps the worker entirely deterministic — same `version` in, same
script out, same cache name in/out.

The archival build's hand-rolled inliner is small (~200 lines) but it
catches every hazard the test suite enumerates: cross-origin pass-through,
literal `</script>` neutralisation, `type="module"` preservation, binary
asset base64-encoding without `Buffer`. The trade-off vs. a third-party
plugin is +200 lines of code in exchange for –1 dependency surface. We
already accept that trade-off in `@sosb/build` and `@sosb/zip`; the
archival build slots into the same pattern.

The persistent VFS choice (IndexedDB-only in v1) is the conservative
conservative pick. The PRD lists OPFS as the *primary* and IndexedDB as
the *fallback*; shipping the fallback first means every browser sees the
editor persist its state, even on platforms where OPFS isn't available
yet (Safari at the time of writing). When OPFS lands as a sibling driver,
existing users transparently benefit (the host shell prefers OPFS, falls
back to IndexedDB on `await openOpfsDriver()` reject).

## Consequences

- `@sosb/browser-shell` declares workspace deps on `@sosb/build`,
  `@sosb/editor-app`, `@sosb/editor-state`, `@sosb/renderer`, `@sosb/schema`,
  `@sosb/vfs`, plus `preact` (peer-style for the archival entry).
  Dev deps: `esbuild` (archival bundling), `fake-indexeddb` (tests),
  `jsdom` (tests).
- The package's `tsconfig.json` adds `"WebWorker"` to `lib` so the
  service-worker types compile against `ServiceWorkerGlobalScope`.
- New e2e specs under `e2e/`:
  - `archival-file-url.spec.ts` — load `dist/archival/builder.html` from
    `file://` and assert the editor renders.
  - `service-worker-offline.spec.ts` — a real `http.createServer` instance
    serves the SPA + the SW; the page registers, caches, then reloads
    offline and the SPA must still render.
- The CLI `pnpm build:archival` writes
  `packages/browser-shell/dist/archival/builder.html`.
- The `dist/archival/` output is **not** committed; it's a build artifact.
  Consumers run the script as part of the release flow.

## Alternatives considered

- **Push the SW into the build pipeline (`@sosb/build`).** Tempting because
  the build pipeline already emits files, but the SW is not a per-site
  artifact — every deployed SPA gets the same SW. Owning it in
  `@sosb/browser-shell` keeps the build pipeline focused on the user's
  site output.
- **Generate the SW source from a TypeScript file (compile a real
  `sw.ts`).** Would catch type errors in the worker source. The runtime
  surface is small and the hand-rolled string template is auditable; the
  cost of a separate compile step + a second tsconfig isn't worth it for
  v1. Revisit if the worker grows beyond the cache-first lifecycle.
- **Auto-bump the SW version from a build hash.** Useful, but couples the
  worker to the build system. The current contract — caller picks the
  version — is a smaller commitment, and the upcoming release-tooling
  issue can wire the bump there.

## Out of scope

- **OPFS persistent-VFS driver.** Documented as a follow-up.
- **Background sync.** The PRD explicitly excludes it; auto-save is
  cache-only and runs while the page has focus.
- **Push notifications.** Excluded by the PRD's no-telemetry stance.
- **Cache pre-warming via `<link rel="prefetch">`.** Premature optimisation;
  the SW's `addAll` already fetches eagerly on first install.
- **A "what's new in v2" diff UI.** PRD lists release notes as Electron-
  specific (story #77); browser editor's toast is "reload to update".
- **Multi-site browser persistence.** PRD pins single-site for v1.
