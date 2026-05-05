# @sosb/assets

Browser-side image processing pipeline for the editor.

The package exposes:

- `uploadAsset(input, vfs, { processor })` — programmatic upload entrypoint.
  Validates alt, detects MIME from magic bytes, resizes raster images to a
  max long edge of 2000px, re-encodes JPEG at q=85 (or PNG for
  alpha-bearing sources), passes SVG through verbatim, hashes the stored
  bytes with SHA-256, writes the asset plus a `<hash>.metadata.json`
  sidecar to the VFS, and returns an `AssetRef`.
- `deleteAsset(vfs, ref)` — removes both the asset and its sidecar.
- `readAssetMetadata(vfs, ref)` — round-trips the sidecar.
- `CanvasImageProcessor` — default browser-side `ImageProcessor` using
  `OffscreenCanvas` + `createImageBitmap` + `convertToBlob`.
- `AssetRef`, `AssetMetadata`, `AssetUploadInput` — shared types.
- `AssetError` / `AssetErrorCode` — typed error surface.

The Electron-side `sharp`-based pipeline (issue #37) plugs into the same
`ImageProcessor` interface. See `docs/adr/0004-asset-pipeline-browser.md`
for the design and the rationale behind the SHA-256 prefix length, the
output-format choices, and the test strategy.

Tracking issue: #8.
