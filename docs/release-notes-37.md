# Release notes -- responsive images on Electron (#37)

The Electron desktop app now produces **responsive image variants**
(400 / 800 / 1600 px wide) for every photo you upload. The browser
editor continues to produce a single-size image per upload.

This is intentional. Here is the trade-off, and why it is the right
choice for student organisations.

## What changes

### Electron app

When you upload a photo:

- The image is resized to a canonical 2000 px long edge for the editor
  preview.
- Three additional WebP variants are written: 400 px, 800 px, and
  1600 px wide.
- Built sites use `<img srcset>` so a phone visitor downloads the
  400 px variant, a tablet downloads 800 px, and a desktop downloads
  1600 px.
- Total page weight drops by 50-80% on mobile, with no visible quality
  change because the variant matches the device's actual viewport.

This uses Sharp, a high-quality image library. Sharp is faster than the
browser's canvas resize and produces smaller files at the same
subjective quality.

### Browser editor

Nothing changes. The browser editor continues to produce one canonical
image per upload (max 2000 px long edge, JPEG q=85 or PNG for alpha).
Built sites from the browser editor use `<img src=...>` without
`srcset`.

## Why the difference

The browser cannot run Sharp -- Sharp uses native code that needs Node
APIs the browser does not expose. The browser editor falls back to
the canvas-based encoder (slower, slightly larger output, no
multi-variant support).

We considered three alternatives and rejected each:

1. **Ship a software image encoder in the browser bundle.** A WebP/AVIF
   encoder compiled to WebAssembly adds 1-2 MB to the editor download
   for every user. That is a real cost we don't want students to pay.
2. **Generate variants on a server.** The product is privacy-first --
   "your work never leaves your machine unless you publish it." Sending
   uploads to a server breaks that contract.
3. **Generate variants only at export time.** Doable, but it means the
   built site you export from the browser still has only single-size
   images; users would have to download Electron to get responsive
   sites. We chose to be explicit about this gap rather than hide it.

## What this means for you

- **If you're using the Electron app:** you get responsive images
  automatically. Faster page loads on mobile, fewer bytes shipped per
  visit, better Lighthouse scores.
- **If you're using the browser editor:** your sites still work
  correctly on every device. Phones still see usable images. They will
  be larger files than Electron-built sites at the same image, but the
  difference is bytes-on-the-wire, not visible quality.
- **If image quality on small devices matters to you:** download the
  Electron app from the [releases page](https://github.com/dobrerares/student-org-site-builder/releases).
  It works offline, runs the same editor, and produces responsive
  images.

## What does not change

- Image filenames (content-addressed by SHA-256 prefix).
- The `<hash>.metadata.json` sidecar shape (it just gains an optional
  `variants` array).
- Round-trip identity for sites: a site exported from one tool can be
  imported by the other.
- Alt text is still mandatory.
- All other accessibility / quality guarantees from prior releases.

## For developers

The seam is documented in
[`docs/adr/0007-asset-pipeline-electron.md`](./adr/0007-asset-pipeline-electron.md).

Public API:

```ts
import {
  uploadAsset,                  // browser: single output
  uploadAssetWithVariants,      // Electron: canonical + variants
  CanvasImageProcessor,         // browser default
  createSharpImageProcessor,    // Electron default
  getDefaultProcessor,          // picks the right one for the runtime
  buildSrcset,                  // formats <img srcset> from variants
  DEFAULT_RESPONSIVE_SIZES,     // sensible default <img sizes>
} from "@sosb/assets";
```
