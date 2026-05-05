# 0003 — VFS abstraction and zip import/export

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #6

## Context

Issue #6 asks for two deep modules:

- `@sosb/vfs` — a virtual filesystem abstraction with `read` / `write` /
  `list` / `delete` / `copy` operations and (in v1 of this slice) two
  drivers: `MemoryDriver` (used by tests and the editor's in-memory
  document model) and `ZipDriver` (used to read/write the canonical
  export artifact).
- `@sosb/zip` — `exportToZip(siteData, vfs) → Blob` and
  `importFromZip(blob) → { siteData, vfs }`. Imports run schema migration
  via `migrateSite` from `@sosb/schema`. Round-trip identity (import →
  export → import = byte-identical, modulo timestamps) is the load-bearing
  contract.

The PRD (Implementation Decisions → Data & schema and → Modules) pins:

- The canonical artifact is a zip containing `data.json`, `assets/`,
  `dist/`, and `DEPLOY.md`.
- Assets are content-addressed under `assets/` (e.g. `assets/8e3a7f.jpg`).
- Forward compatibility is preserve-unknown-keys: `@sosb/schema` already
  guarantees that unknown blocks and unknown fields survive a parse
  cycle; the zip layer's job is to not strip them when serialising.
- The editor must run **in the browser and in Node** (Electron
  main/renderer + hosted SPA). Anything in `@sosb/vfs` or `@sosb/zip`
  that doesn't run in both environments is dead code in v1.
- The PRD also lists future drivers (IndexedDB, OPFS, Electron-FS) that
  the same abstract interface must accommodate. Those land in #35/#37
  and are explicitly out of scope here, but the interface shape must
  not paint them into a corner.

The PRD does not pin a zip library. This ADR records that choice and
the VFS interface shape.

## Decision

### Zip library: **fflate**

`fflate` (v0.8.x) is added as a dependency of `@sosb/zip` only — not at
the workspace root, not in `@sosb/vfs`. No other package needs zip
encoding or decoding in v1.

### VFS interface

`@sosb/vfs` exposes a single abstract type — every driver (Memory, Zip,
and the future IndexedDB/OPFS/Electron-FS drivers) implements it:

```ts
interface Vfs {
  read(path: string): Promise<Uint8Array>;
  write(path: string, bytes: Uint8Array): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  delete(path: string): Promise<void>;
  copy(from: string, to: string): Promise<void>;
  has(path: string): Promise<boolean>;
}
```

- Paths are POSIX-style, forward-slash, no leading `/`. Validation
  happens in a shared helper used by every driver.
- `read` / `delete` / `copy` of a missing path throws a typed
  `VfsNotFoundError`. The shared driver-conformance suite asserts this.
- `list(prefix)` returns paths matching the prefix (or all paths when
  no prefix is given), sorted lexicographically. Sorting is part of the
  contract because zip outputs depend on stable ordering for
  deterministic round-trip.
- The interface is `async` even where the Memory driver could be
  synchronous, so the same code path works against the real
  IndexedDB/OPFS/Electron-FS drivers later.

### Zip layout

```
data.json              # canonical site data (UTF-8, pretty 2-space JSON)
assets/<hash>.<ext>    # content-addressed assets, hash names per PRD
assets/<hash>.metadata.json  # sidecar for asset metadata (alt, mime, ...)
dist/                  # built static site (placeholder in v1; #5 fills it)
DEPLOY.md              # deployment guide (placeholder English copy in v1)
```

In v1 `exportToZip` writes a `.gitkeep` inside `dist/` so the directory
survives in archive listings. Real `dist/` content lands with #5/#46.

### Round-trip identity

`exportToZip` is deterministic: given the same `(siteData, vfs)` it
produces a zip whose bytes are identical between calls. fflate's
`zipSync` plus a fixed `mtime: 0` per entry makes this work. The
test suite asserts:

1. Import → re-export → import returns a `siteData` deep-equal to the
   first import.
2. Import → re-export → import yields a zip whose bytes match the
   first export's bytes.
3. Random fuzz fixtures — including unknown block types, unknown fields
   on `org` / `theme.tokens` / page / block — survive the same loop
   without losing data.

### Schema migration on import

`importFromZip` calls `migrateSite` from `@sosb/schema` after parsing
`data.json`. In v1 every migration is a no-op (current
`SITE_SCHEMA_VERSION` is 1, no prior versions). The seam matters: when
real migrations land in #26, this code path automatically picks them
up.

### Corrupted-zip handling

`importFromZip` throws typed errors with stable codes and clear
messages on every malformed-input branch:

- `ZipImportError("zip.invalid")` — fflate refuses to decode the blob.
- `ZipImportError("zip.dataJson.missing")` — `data.json` is absent.
- `ZipImportError("zip.dataJson.invalidJson")` — `data.json` is not
  parseable JSON.
- `ZipImportError("zip.dataJson.invalidShape")` — JSON parses but
  `validate()` reports errors. The validation result is attached.
- `ZipImportError("zip.dataJson.versionTooNew")` — the input
  `schemaVersion` is greater than this editor's
  `SITE_SCHEMA_VERSION` (re-thrown from `migrateSite`).

Every error preserves the underlying `cause` (per `Error.cause`). The
caller can handle errors by `code` rather than message-matching.

## Rationale

### Why fflate, not JSZip / pako / native CompressionStream?

- **Browser + Node, single import**: fflate publishes both an ESM and a
  CJS build that work unmodified in browsers and Node. JSZip works too
  but it's larger (~95kb min) and its async API is awkward to drive
  deterministically. pako only does deflate, not the zip container.
- **Deterministic output**: `zipSync` accepts an explicit `mtime` per
  entry and uses stored compression on demand. Setting `mtime: 0` and
  using a stable entry order produces byte-identical output across
  calls — a hard prerequisite for the round-trip identity test.
- **No native dependency**: fflate is pure JS with zero deps. That
  matters for the browser SPA (no WASM bundle) and for Electron
  packaging (no native rebuild step). `CompressionStream` would be
  Chrome-only on the browser side and require a polyfill in Node 18,
  which is below our supported range — it's a sharper edge than fflate
  for an unclear win.
- **Bundle size**: the parts of fflate we use (`zipSync`, `unzipSync`)
  tree-shake down to ~12kb min+gzip. The whole library is ~25kb.
  Acceptable for the editor; the published static sites ship with
  zero zip code.
- **License**: MIT, matching the project license.

### Why the abstract VFS instead of leaning on the zip layer directly?

The PRD lists five drivers (Memory, IndexedDB, OPFS, Electron-FS, Zip).
Two land in this issue, three land later. Picking the abstract
interface now means later issues add a driver without touching call
sites in `@sosb/zip`, the editor, or the build pipeline. The shared
conformance suite is the contract — every driver passes the same
tests.

The interface is intentionally narrow (`read` / `write` / `list` /
`delete` / `copy` / `has`) — six methods, all on a single type. This
follows the PRD's "deep modules: encapsulated behaviour, narrow
interface" guidance.

### Why content addressing through the path, not through a separate index?

The PRD pins content-addressed assets (`assets/<hash>.<ext>`) at the
filesystem layer, so the VFS treats those paths as opaque strings.
The asset module (#8) owns the hashing pipeline; the VFS only stores
and retrieves bytes. Keeping the path = the address means the zip
layout matches the editor's in-memory layout one-to-one — no
translation step on export, no index file to drift out of sync.

### Why explicitly preserve unknown keys at the zip layer too?

`@sosb/schema` already preserves unknown keys at parse time. The zip
layer guarantees:

1. On export: serialise the `siteData` exactly as the caller passed
   it. We do not re-parse through the schema first; that would risk
   stripping any keys the caller's runtime had already preserved.
2. On import: parse with `JSON.parse`, run `migrateSite`, then
   `validate()`. The `parseSite()` helper would also work, but using
   `JSON.parse + validate` keeps the unmigrated/unvalidated input
   available for the error path's `cause`.

## Consequences

- `pnpm -F @sosb/zip add fflate` is run inside the worktree; the
  lockfile carries the dependency only inside `@sosb/zip`.
- `@sosb/vfs` carries zero runtime dependencies in v1. Future drivers
  may add their own (e.g. `idb-keyval` for IndexedDB). The Memory and
  Zip drivers shipped here are dependency-free.
- `@sosb/zip` depends on `@sosb/vfs` and `@sosb/schema` as workspace
  peers. The zip module's surface is `exportToZip` /
  `importFromZip` / `ZipImportError` plus type re-exports; everything
  else stays internal.
- Future zip schema-migration entries (#26 onward) plug into
  `@sosb/schema`'s migration tables; `@sosb/zip` does not need
  changes when those land.
- The shared driver-conformance suite is exported from
  `@sosb/vfs/test-conformance` so future driver packages (#35, #37)
  re-use it without copying.

## Alternatives considered

- **JSZip** — battle-tested but ~3× the bundle of fflate, async-only
  API harder to drive deterministically, and no first-class control
  over entry ordering for byte-identical output.
- **adm-zip / yauzl / yazl** — Node-only. Forces a separate browser
  implementation and breaks the "same code in editor and Electron"
  promise the PRD makes for the renderer; we want the same property
  for the persistence layer.
- **Native `CompressionStream`** — modern browsers and Node ≥21
  support it, but our supported floor is Node 20 LTS where it landed
  behind a flag. Adding a polyfill for the lower bound is harder than
  just using fflate everywhere.
- **A WASM zip library (e.g. zip.js, libzip-wasm)** — bigger than
  fflate, opaque on debug, and the Electron packaging story is
  harder. No win for our use.

## Out of scope

- Real `dist/` content in the exported zip (issues #5, #46).
- Asset transforms — resizing, hashing, re-encoding (#8). The VFS
  treats asset paths as opaque strings.
- IndexedDB / OPFS / Electron-FS drivers (#35 / #37). The conformance
  suite they will need is already exported from `@sosb/vfs/test-conformance`.
- Editor UI / form wiring against the VFS (#7).
- `DEPLOY.md` content beyond the placeholder English text. The full
  bilingual deployment guide is a documentation deliverable in its own
  issue.
