# 0007 -- Electron asset pipeline: Sharp + responsive variants + FS-VFS

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #37

## Context

Issue #37 asks for the Electron-side image-processing pipeline. The
browser pipeline (#8, ADR 0004) commits to a narrow `ImageProcessor`
seam with one canonical encoded output per upload. The Electron app
needs to:

- Replace canvas-based encoding with Sharp -- much higher quality, much
  better speed, and AVIF / WebP / JPEG / PNG all available natively.
- Emit responsive variants (`srcset`) at PRD-pinned widths (400 / 800 /
  1600).
- Persist sites as folders on disk (the PRD's "sites are folders"
  promise; landed in the previous PR's deferral list, ADR 0006).
- Run Sharp in the main process so the renderer (sandbox: true,
  nodeIntegration: false) cannot reach the filesystem arbitrarily via
  the IPC bus.
- Keep the browser pipeline (#8) unchanged.

The PRD pins the broad strokes (Asset processing, Implementation
Decisions / Distribution):

- Sharp + responsive variants in Electron.
- 400 / 800 / 1600 widths, WebP encoding (with optional AVIF for
  follow-up).
- Sidecar metadata grows a `variants` field.
- Built sites use `<img srcset>`.

The PRD does **not** pin:

- The shape of the multi-variant seam on `ImageProcessor`.
- Whether to keep one upload entrypoint or split into two.
- Where to enforce IPC validation (renderer / main / both).
- The naming convention for variant files on disk.
- The processor-selection mechanism (compile-time / runtime).
- The exact security boundary for the IPC channel.

This ADR records those choices.

## Decision

### One package, two upload entrypoints

`@sosb/assets` keeps the existing `uploadAsset` (single-output, browser
default) and adds a new `uploadAssetWithVariants` (canonical + variants,
Electron default). Both share `mime`, `hash`, `errors`, and
`AssetUploadInput`, plus the orchestration patterns (alt enforcement,
content-addressed dedup, sidecar writing). They differ only in their
output strategy.

Two entrypoints rather than one because:

- The browser pipeline doesn't need (and shouldn't pay for) multi-output
  branching. `uploadAsset` stays simple.
- The Electron pipeline's variant logic is a meaningful new orchestration
  step, not just a flag. Surfacing it as a distinct entrypoint makes the
  call sites self-documenting.
- The variant pipeline would need a `MultiVariantImageProcessor` even
  if we collapsed the entrypoints; the seam shape grows either way.

### `MultiVariantImageProcessor` extends `ImageProcessor`

The seam from #8 stays:

```ts
interface ImageProcessor {
  decode(bytes, mime): Promise<ImageDecode>;
  resizeAndEncode(decoded, mime, maxLongEdge, q): Promise<ImageEncoded>;
}
```

The new seam is a **superset**:

```ts
interface MultiVariantImageProcessor extends ImageProcessor {
  encodeVariants(decoded, options): Promise<readonly ImageVariant[]>;
}
```

`encodeVariants` takes a single `ImageDecode` and emits one
`ImageVariant` per requested width. The processor MUST NOT up-scale: if
the source is narrower than the requested width, the output's `width`
equals the source `width`. The contract is asserted in tests.

The production Sharp processor (`createSharpImageProcessor` in
`src/sharp-processor.ts`) implements both interfaces. The browser
`CanvasImageProcessor` only implements the single-output one --
generating multiple WebP variants in the browser is a different,
narrower problem than the Electron use case asks for.

### Variant naming: `<hash>.<width>.<ext>`

The canonical asset is at `assets/<hash>.<ext>`. Each variant lives at
`assets/<hash>.<width>.<ext>`. Examples for a JPEG hashed to
`8e3a7f9b1c0d2e4f`:

```
assets/8e3a7f9b1c0d2e4f.jpg            (canonical, 2000px long edge)
assets/8e3a7f9b1c0d2e4f.metadata.json  (sidecar, includes variants[])
assets/8e3a7f9b1c0d2e4f.400.webp       (variant, 400px width)
assets/8e3a7f9b1c0d2e4f.800.webp       (variant, 800px width)
assets/8e3a7f9b1c0d2e4f.1600.webp      (variant, 1600px width)
```

Properties this gets us:

- **Deterministic:** same input bytes -> same canonical hash -> same
  variant paths. Two uploads of the same file produce one set of files
  on disk.
- **Sortable:** lexicographic order in `vfs.list("assets/")` groups all
  variants of a given asset together.
- **Self-describing:** the width is in the filename, so a `pnpm vfs ls`
  output is human-readable without consulting the sidecar.
- **Backwards-compatible:** the browser pipeline's path shape
  (`<hash>.<ext>`) is unchanged. A site authored in the browser can be
  opened in Electron and have variants added without rehashing the
  canonical entry.

### Default variant strategy: WebP at q=82

Variants default to `image/webp` at quality 82. Why these numbers:

- WebP at q=82 reliably matches JPEG q=85 for subjective quality at
  20-30% smaller file sizes. The whole point of using WebP is to ship
  fewer bytes; q=82 hits that without venturing into noticeably-lossy
  territory.
- Universal support: WebP is available in every browser at the v1 floor
  (Chrome 100+, Firefox 100+, Safari 15.4+).
- Sharp encodes WebP cleanly and quickly with the bundled libvips.

PNG variants are generated on demand (callers can pass
`targetVariantMime: "image/png"`) for assets where alpha matters more
than file size. JPEG variants are also supported via the same option.

AVIF is **out of scope for #37**: it's a worthwhile future improvement
(another 15-25% size win over WebP) but the v1 floor's AVIF support is
mixed and the encoding cost is meaningfully higher. Adding AVIF is a
follow-up issue once the WebP path has shipped.

### Processor selection: environment detection at runtime

`getDefaultProcessor()` returns the right processor for the current
runtime:

- Plain Node or Electron main process -> `createSharpImageProcessor()`
  via dynamic `import("./sharp-processor.js")`.
- Browser or Electron renderer (sandbox: true) -> `CanvasImageProcessor`
  (constant export, no async).

Detection uses `process.versions.node` AND the absence of a `window`
global (Electron renderers expose both, so the window check has to come
first). The Sharp module is loaded via dynamic import to keep the
browser bundle clean -- a static `import "sharp"` would force every
browser bundler to either tree-shake the import (none of them do this
reliably for files with side effects) or refuse to bundle (Vite, the
default in v1).

`isNodeEnvironment()` is also exported so call sites that need to
branch on capability without instantiating a processor can do so.

### Security boundary: bytes-only IPC

The renderer cannot run Sharp directly (Sharp needs Node's `fs` to load
its prebuilt binary; the renderer is sandboxed). The IPC channel
`sosb:process-asset-for-variants` is the only path between renderer
code and the main-process Sharp pipeline.

The handler (`createAssetIpcHandler` in `electron-shell/asset-handlers.ts`)
enforces a **strict allowlist**:

1. **Bytes only.** The request type has no `path`, `filePath`, or any
   filesystem-shaped field. The renderer cannot coerce the main process
   into reading arbitrary files via this channel. (A structural test
   asserts the request keys.)
2. **MIME allowlist.** `declaredMime` must be one of `image/jpeg`,
   `image/png`, `image/webp`, `image/svg+xml`. Any other value is
   rejected with `ipc.asset.mime.unsupported` BEFORE the bytes touch
   Sharp.
3. **Hard size cap.** Payloads larger than 50 MB are rejected with
   `ipc.asset.payload.tooLarge`. Sharp can decode arbitrarily large
   inputs; the cap is to prevent a malicious / buggy renderer from
   OOM'ing the main process.
4. **Variant widths.** `variantWidths` must be a non-empty array of
   positive finite numbers; nonsense entries (zero, negative, NaN)
   are rejected with `ipc.asset.variants.invalid`.
5. **Alt non-empty.** Same hard requirement the asset pipeline enforces
   upstream. `ipc.asset.alt.missing`.

The handler validation is unit-tested in node without Electron / Sharp
/ a real `ipcMain` -- it's pure validation logic over a fake processor.

### FS-VFS driver: sites are folders

`FsDriver(rootDir)` is a new VFS driver in `@sosb/vfs` that maps the
abstract POSIX-style VFS path space onto a real directory rooted at
`rootDir`. It passes the shared `runVfsConformance` suite (~30 tests)
plus six FS-specific tests (path traversal, intermediate-directory
creation, list returns POSIX paths regardless of host OS, survives
reopening, etc.).

Lives in the same package as `MemoryDriver` and `ZipDriver`. Node-only
-- the renderer cannot import it because the renderer cannot import
`node:fs/promises`. The Electron main process wires it up to the path
the user picks via the open / save dialogs.

The driver's `#resolveInside` helper performs a defence-in-depth check:
even if the abstract VFS path passes `validatePath`, the resolved host
path must lie inside `rootDir`. This catches symlink attacks and any
future bug in the path validator.

### IPC channel addition: one new entry, both lists updated

The previous PR (#35) declared the IPC channel registry as the single
source of truth. We add exactly one channel:

```ts
processAssetForVariants: "sosb:process-asset-for-variants";
```

It's added to `IpcChannels`, `IPC_CHANNEL_LIST`, `PRELOAD_API_METHODS`,
and `PreloadApi`. The structural tests that walk these lists pick up
the new entry automatically -- a typo on either side breaks IPC
silently, so the lists are the contract.

The renderer never sees a filesystem reach. `window.sosb` exposes:

```ts
processAssetForVariants(request) -> Promise<{ canonical, variants[] }>
```

where `request` is `{ bytes, declaredMime, name, alt, variantWidths,
targetVariantMime?, variantQuality? }` -- all bytes and primitives,
zero file paths.

## Rationale

### Why a separate `MultiVariantImageProcessor` interface?

The single-output `ImageProcessor` is enough for the browser. Forcing
the canvas processor to grow an `encodeVariants` method that throws
"not supported" would couple the browser pipeline to a feature it
doesn't ship. Capability detection (`"encodeVariants" in processor`)
keeps the browser pipeline unchanged.

### Why hash from canonical bytes, not source bytes?

Same logic as #8 (ADR 0004): identical source bytes don't necessarily
produce identical canonical bytes (camera EXIF, slight re-encoding in
processing chain), but the same processor + same parameters + same
input always produce the same canonical output. Hashing the canonical
output makes dedup work at the level the VFS sees.

The variant paths share the canonical hash so the browser pipeline
(which only writes the canonical) and the Electron pipeline (which
writes canonical + variants) cannot create two parallel asset trees.
A site upgraded from browser-only to Electron simply gets variants
added next to its existing canonical entries.

### Why bytes-only IPC?

The single most subtle Electron security failure is letting the
renderer specify a path that the main process trusts. We avoid this
entire class of bug by structurally not having a path field in the
request. The renderer reads its own bytes (it has the File handle from
the user's drag-drop or file-input), serialises them through the IPC
boundary, and gets bytes back. The main process never opens a file
the renderer named.

The byte serialisation cost is modest: Electron's `ipcRenderer.invoke`
uses structured clone, which transfers `Uint8Array` efficiently
(typically zero-copy for ArrayBuffer transfers). The 50 MB cap means
the worst case is a 50 MB serialise + 50 MB return, which is fast
enough for an interactive upload flow.

### Why FS-VFS in `@sosb/vfs`, not in `@sosb/electron-shell`?

The conformance suite. Putting `FsDriver` next to `MemoryDriver` and
`ZipDriver` lets it run the same `runVfsConformance` tests. Drivers
that pass the same suite are interchangeable from a call-site
perspective; that's the whole promise of `@sosb/vfs`. Putting the FS
driver in `@sosb/electron-shell` would mean the conformance suite
either depends on Node-only imports (breaks browser builds) or doesn't
cover the FS driver (breaks the substitution promise).

The FS driver IS Node-only, but `@sosb/vfs/index.ts` is a barrel that
the bundler tree-shakes -- a browser bundle that doesn't reference
`FsDriver` doesn't pull in `node:fs`. (Verified in the no-sharp-leak
test for `@sosb/assets`; the same property holds for `@sosb/vfs`
because the import graph is identical.)

### Why a default `<img sizes>` constant?

The 400 / 800 / 1600 width strategy is opinionated about typical
breakpoints (mobile / tablet / desktop). Themes that use the default
sizes get correct responsive image selection without thinking about it.
Themes that need different breakpoints can ignore the constant and
emit their own `sizes`.

## Consequences

- `@sosb/assets` gains four new files (`sharp-processor.ts`,
  `variant-pipeline.ts`, `environment.ts`, plus the variant-related
  type / constant additions in `processor.ts` and `types.ts`).
- `@sosb/vfs` gains one new file (`fs-driver.ts`) and exports the new
  `FsDriver`.
- `@sosb/electron-shell` gains two new files (`asset-handlers.ts`,
  `asset-processor-main.ts`) and one new IPC channel.
- The renderer-facing `window.sosb` API gains exactly one new method;
  PRELOAD_API_METHODS lists it and the structural tests pick it up.
- Sharp is a runtime dependency of `@sosb/assets` (NOT a devDependency
  any more) for the Electron-side build. The browser-only path never
  loads sharp; verified by `no-sharp-leak.test.ts`.
- The 12 MB JPEG -> <500KB AC from #8 still passes (single-output path
  unchanged, sharp processor honours the same long-edge cap).
- Electron-built sites get `<img srcset>` automatically when the asset
  was uploaded through `uploadAssetWithVariants`. Browser-built sites
  remain single-size; the trade-off is documented in
  `docs/release-notes-37.md`.

## Alternatives considered

- **Add `encodeVariants` to the canonical `ImageProcessor` interface.**
  Forces every implementation (canvas included) to ship a stub.
  Capability-detection at call sites is cleaner.
- **One unified upload entrypoint with a `variants?: number[]`
  option.** Considered. Rejected because the variant code path is
  meaningful enough to deserve its own surface; folding it into
  `uploadAsset` would obscure the orchestration difference from
  call-site readers.
- **Run Sharp in a Node child process spawned by the main process,
  not in main directly.** Adds isolation but also adds startup latency
  on every upload. Sharp's process model doesn't crash the host on
  malformed input; the size cap and mime allowlist already prevent
  resource exhaustion. We can revisit if a real CVE surfaces.
- **Embed a software WebP encoder in the browser instead of using
  WebP only on Electron.** Same tradeoff as ADR 0004's PNG-vs-WebP
  decision: a software WebP encoder in a browser bundle is large and
  Safari's `convertToBlob('image/webp', ...)` floor is 16.4 -- below
  the v1 Safari floor of 15.4. Not worth it for v1.
- **Use a plain `path: string` field in the IPC request instead of
  bytes.** Rejected on security grounds; see Decision / Security
  boundary above.
- **Generate variants lazily on demand instead of at upload time.**
  Adds complexity (dist-time vs runtime; cache invalidation) for no
  user-visible benefit -- variants are tiny next to the canonical and
  storage is the abundant resource.

## Out of scope

- AVIF variant encoding -- follow-up issue when the v1 floor lifts.
- Editor UI for asset management (showing the variant breakdown,
  re-running with different widths, etc.) -- later editor issues.
- Auto-update integration via `electron-updater` -- #36.
- Document handling (PDF / DOCX) -- #21.
- Asset GC / orphan-removal pass -- a later "site cleanup" issue, same
  follow-up as the one called out in ADR 0004.
- Cross-platform release workflow (per-runner CI matrix) -- release
  workflow issue.
