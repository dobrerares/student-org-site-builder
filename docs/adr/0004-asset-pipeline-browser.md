# 0004 — Browser asset pipeline

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #8

## Context

Issue #8 asks for `@sosb/assets`, the editor-side image pipeline that
turns user uploads into content-addressed entries in the VFS. The PRD
pins:

- Canvas-based, single-size resize at max 2000px long edge.
- JPEG q=85 for non-alpha sources; PNG (or WebP) preserving alpha for
  alpha-bearing sources; SVG passthrough.
- SHA-256 prefix as the asset's content address.
- Mandatory `alt` text enforced at upload.
- Asset metadata sidecar `<hash>.metadata.json` carrying
  `originalName`, `mimeType`, `dimensions`, and `alt`.
- Identical files dedup transparently.
- Compression budget: a 12MB source photo lands under 500KB after
  resize+re-encode.

The PRD also makes `@sosb/assets` an explicitly _deep_ module: an
encapsulated pipeline behind a narrow programmatic interface, with
environment-specific implementations interchangeable behind a single
seam. The Electron-side `sharp` pipeline (#37) is out of scope for #8
but must plug into the same seam this issue commits to.

The PRD does not pin the prefix length, the alpha output format
(PNG vs WebP), the seam shape, or the test strategy. This ADR records
those choices.

## Decision

### Public surface

`@sosb/assets` exports:

```ts
function uploadAsset(input, vfs, { processor }): Promise<AssetRef>;
function deleteAsset(vfs, ref): Promise<void>;
function readAssetMetadata(vfs, ref): Promise<AssetMetadata>;

interface AssetRef {
  hash: string;
  path: string; // assets/<hash>.<ext>
  metadataPath: string; // assets/<hash>.metadata.json
  mime: SupportedMime;
  width: number;
  height: number;
  alt: string;
}

interface ImageProcessor {
  decode(bytes, mime): Promise<ImageDecode>;
  resizeAndEncode(decoded, targetMime, maxLongEdge, jpegQuality): Promise<ImageEncoded>;
}

const CanvasImageProcessor: ImageProcessor; // browser default
```

`uploadAsset` is the only programmatic upload entrypoint. Callers pass
either a `File` (for editor file-input flows) or `{ bytes, name,
declaredMime, alt }` (for tests, drag-drop bridges, programmatic
imports).

### The `ImageProcessor` seam

The pipeline orchestration (mime detection, hashing, dedup, sidecar
writing, alt enforcement, deletion) is environment-agnostic and lives
in `pipeline.ts`. The single environment-specific concern — image
decoding and resize+re-encode — is delegated to an injected
`ImageProcessor`.

The browser default is `CanvasImageProcessor`, using
`OffscreenCanvas` + `createImageBitmap` + `convertToBlob`. This is the
only file in the package that depends on browser-only globals; any
caller that imports `@sosb/assets/index.js` is free to _not_ use
`CanvasImageProcessor` (the Electron pipeline #37 will plug in a
sharp-backed processor through the same seam).

The seam is intentionally narrow: two methods, three plain types. It
covers v1's needs (single-size resize+re-encode) without pre-committing
to multi-output (responsive variants), which is #37's concern.

### MIME detection: magic bytes, with declared MIME as fallback

`detectMime(bytes, declared?)` returns one of `image/jpeg`, `image/png`,
`image/webp`, `image/svg+xml`, or `null`. For raster types we always
trust the magic bytes — `File.type` and file extensions routinely lie.
SVG is the one type where the magic-bytes path is permissive: we accept
either an XML prolog, a leading `<svg`, or a declared `image/svg+xml`
MIME.

Anything else (PDF, video, audio, Office documents) is rejected with
`AssetError("asset.mime.unsupported")`. The PDF / DOCX path is #21 and
plugs into a different module (the `@sosb/assets` v1 surface is
images-only).

### Output format choice

| Input MIME      | Output MIME     | Encoding parameters        |
| --------------- | --------------- | -------------------------- |
| `image/jpeg`    | `image/jpeg`    | q=85, chroma 4:2:0 default |
| `image/png`     | `image/png`     | lossless, alpha preserved  |
| `image/webp`    | `image/png`     | re-encoded to PNG in v1    |
| `image/svg+xml` | `image/svg+xml` | passthrough (no rasterise) |

WebP-with-alpha is re-encoded to PNG rather than re-encoded to WebP for
two reasons:

1. The published-site renderer assumes the same single-size asset across
   themes. PNG is the most universal alpha-bearing format — every
   browser supports it and every download tool round-trips it without
   format-detection ambiguity.
2. `OffscreenCanvas.convertToBlob('image/webp', ...)` is _not_ supported
   in Safari at the v1 floor (Safari 15.4); supporting WebP output
   would mean shipping a software encoder. The Electron pipeline (#37)
   covers WebP/AVIF responsibly with sharp; the browser pipeline trades
   a few KB of extra PNG size for portability.

### SHA-256 prefix length: **16 lowercase hex characters (64 bits)**

Content-addressing collisions are the obvious risk. The trade-off is
prefix-length vs collision probability vs path readability.

By the birthday bound, `n` random 64-bit values have a 1-in-a-million
collision probability for `n` ≈ 2 × 10⁶. v1's expected scale (a
student-org site with at most a few hundred assets) is six orders of
magnitude below that. Even a generous 10× growth headroom puts us
nowhere near collision territory.

A 16-character hex prefix is also short enough to read at a glance in
a `pnpm vfs ls assets/` output, which we expect to use for editor and
import/export debugging.

If a future site genuinely outgrows 64 bits we can extend the prefix
without breaking backward compatibility — the file extension already
disambiguates within a hash bucket, and the metadata sidecar lets us
detect collisions explicitly.

### Asset metadata sidecar

Each asset writes an `assets/<hash>.metadata.json` sidecar:

```json
{
  "originalName": "team-photo.jpg",
  "mimeType": "image/jpeg",
  "dimensions": { "w": 2000, "h": 1333 },
  "alt": "The 2026 board"
}
```

`originalName` is stored to keep editor surfaces useful (file lists
should show the user's name, not the hash) and for export hygiene.
`dimensions` mirrors the post-resize raster dimensions; for SVGs we
record the intrinsic `width`/`height` attributes if present, else
`{ w: 0, h: 0 }`.

`alt` is mandatory and enforced at the _upload_ entrypoint — empty or
whitespace-only `alt` throws `AssetError("asset.alt.missing")`. This is
the upload-time enforcement the AC asks for; the schema-level "missing
alt → warning" rule (#3, `runBlockRules` for hero blocks) handles the
_rendering_-time nudge for blocks where alt got lost or was never set.
Both checks coexist by design: the upload path can't rely on the
schema check (uploads happen before block edits) and the schema check
can't rely on the upload path (loaded sites may have stale data).

### Dedup is a property of content-addressing

Identical input bytes flow through identical orchestration: same MIME
detection, same processor, same hash, therefore same VFS path. A second
upload of the same file overwrites the same VFS entry — net effect is
a single asset on disk. The `AssetRef`s returned from two such uploads
have equal `hash`, `path`, and `metadataPath`, so blocks can compare
references by `hash` and treat them as interchangeable.

The unit tests assert this directly: `vfs.list("assets/")` after two
uploads of the same SVG returns exactly two paths (the asset + its
sidecar), not four.

### Test strategy: vitest + sharp for orchestration; Playwright for the canvas seam

The canvas-only path is _not_ easily exercised under JSDOM —
`OffscreenCanvas`, `createImageBitmap`, and `convertToBlob` all need a
real layout engine. We split coverage along the seam:

- **vitest** (Node, fast, runs in CI) tests the full pipeline against
  a real `MemoryDriver` VFS and a real `SharpImageProcessor`. The
  observable contracts — alpha preservation, output MIME, output size
  budget, dedup, sidecar fidelity, alt enforcement, deletion — are
  properties of any honest implementation, not artefacts of canvas vs
  sharp. The 12MB→<500KB AC is verified with a synthesised noise+blur
  fixture whose JPEG entropy approximates a real photograph (pure
  noise is incompressible by any DCT codec; the blur step gives the
  spectrum a 1/f falloff).
- **Playwright** (real Chromium, opt-in via `pnpm test:e2e`) tests
  the `CanvasImageProcessor` path directly. It synthesises a multi-MB
  noisy gradient JPEG inside the page, runs the same resize+encode
  pipeline using `OffscreenCanvas` + `createImageBitmap`, and asserts
  the output is under 500KB. Alpha preservation through canvas
  re-encode is also covered.

`SharpImageProcessor` is **not a mock**. It's a real, full-fidelity
image encoder used to substitute the canvas-based one in tests. The
orchestration logic the unit tests cover doesn't depend on sharp's
specific output bytes — only on its honest behaviour (output mime,
dimensions, alpha-preservation when asked, size after resize+encode).

## Rationale

### Why a `processor` injection seam at all?

The PRD lists `@sosb/assets` as a deep module with "environment-specific
implementations behind a unified interface". The browser pipeline is
this issue (#8); the Electron sharp pipeline is #37. Both ship in v1.
Picking the seam now means #37 plugs in without touching call sites in
the editor app, the wizard, or the import flow. The shared pipeline
orchestration is exercised by both processors — there's no risk of the
two pipelines diverging on alt enforcement, dedup, or sidecar shape.

### Why hash the _stored_ bytes, not the source bytes?

Content-addressing the source bytes would mean two uploads of the same
camera photo (12MB JPEG) and the same photo run through a different
camera's editor (12.0001MB) hit different entries even though the
_stored_ (post-resize, post-re-encode) bytes are identical. We want the
deduplication to work at the level the VFS sees, which is the stored
bytes. The cost is that re-encoding is deterministic — the same
processor + same parameters + same input must produce the same output
bytes. Both `CanvasImageProcessor` and `SharpImageProcessor` honour
this; if a future processor introduces randomness (dithering with
non-deterministic seed, etc.) it must be made deterministic before
shipping.

### Why no `node:crypto` in the runtime path?

`globalThis.crypto.subtle.digest('SHA-256', ...)` is available
unmodified in modern browsers and in Node ≥20 (Node's WebCrypto is
exposed on `globalThis.crypto`). Using it from `@sosb/assets` keeps
the browser bundle clean — no `node:` import means Vite/Rollup never
has to resolve a Node-only module — and makes the unit tests
exercise the same hash code path the browser will run.

## Consequences

- `@sosb/assets` carries `@sosb/vfs` as a workspace peer and `sharp` as
  a devDependency only (test fixtures + the test-only
  `SharpImageProcessor`). The published package never ships sharp.
- Image-bearing blocks (#14, #17, #21, #46) can import `AssetRef` from
  `@sosb/assets` without paying a runtime cost — the type-only
  imports tree-shake to nothing.
- The Electron pipeline (#37) implements `ImageProcessor` and reuses
  the same upload/delete/dedup orchestration. Its multi-output
  responsive variants will need an interface extension; the v1
  surface deliberately stops at single-output.
- The schema-level "missing alt → warning" rule and the upload-time
  "missing alt → error" both stay in place. The PRD's severity model
  (`error` is "blocking-on-confirmation", `warning` is "quality
  nudge") differentiates the two: upload alt is a hard requirement
  because we have direct user input; schema alt is a quality nudge
  because the data may have been imported from a stale zip with no
  user present to fix it.
- E2E tests exist but are not in the four-job CI matrix. Running them
  requires `pnpm exec playwright install chromium` and `pnpm test:e2e`.
  Adding an e2e CI job is its own follow-up issue.

## Alternatives considered

- **Inline canvas calls in the pipeline** (no seam) — simpler today,
  but forces the Electron pipeline to either duplicate the
  orchestration or polyfill canvas in main-process Node. Both are
  worse trade-offs than committing to the seam now.
- **Shorter hash prefix (8 chars / 32 bits)** — Birthday-bound
  collisions hit at ~50K assets, which is uncomfortably close to a
  large nonprofit's archive. Not worth saving 8 characters of path.
- **Longer hash prefix (32 chars / 128 bits)** — overkill, and the
  full SHA-256 hex is not significantly easier to read at 64 chars
  than at 16. We can extend later if we need to.
- **Re-encode WebP-with-alpha to WebP** — Safari 15.4 (v1 floor) does
  not support `convertToBlob('image/webp', ...)`; we'd need a software
  WebP encoder in the browser bundle. Re-encoding to PNG is simpler
  and portable.
- **Hash the _source_ bytes (pre-resize)** — see Rationale above; we
  hash the stored bytes for VFS-level dedup.
- **JSDOM-based unit tests for the canvas path** — JSDOM doesn't
  implement `OffscreenCanvas` or `createImageBitmap`. Polyfilling
  with `node-canvas` works for some flows but the encoder behaviour
  diverges from real browsers in ways that would invalidate the size-
  budget AC. Playwright is the honest answer.

## Out of scope

- The Electron-side `sharp`-based responsive-variants pipeline (#37).
- Document handling — PDF, DOCX, XLSX, etc. (#21).
- Editor / wizard UI for asset management. The programmatic upload
  entrypoint is the only surface this issue commits to.
- Multi-size / `srcset` output. Browser-built sites use single-size
  (PRD-pinned trade-off); responsive variants ship from Electron
  builds in #37.
- Asset GC / orphan-removal pass — when blocks delete their last
  reference to an asset, the asset stays in the VFS. v1 leaves this
  to a later "site cleanup" issue.
