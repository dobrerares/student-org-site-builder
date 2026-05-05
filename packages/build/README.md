# @sosb/build

Browser-runnable build pipeline. Pure function `build(siteData, options) -> distFolder`.

```ts
import { build } from "@sosb/build";

const dist = build(siteData, { themeId: "stub" });
// dist is a Map<string, string> representing a virtual directory:
//   "index.html"   -> the rendered HTML for the home page
//   "robots.txt"   -> the robots manifest
//   "sitemap.xml"  -> a single-page sitemap
```

## What it does

For each page in `site.pages`, the pipeline calls `@sosb/renderer`'s
`renderSite()` and writes the resulting HTML to a virtual file path. v1 is
single-page, single-language: only the home page renders to `index.html`,
the sitemap lists exactly one URL, and there are no `hreflang` alternates.
Multi-page paths and `hreflang` land in #23 and #24.

## Determinism contract

- Same input produces same output, byte-for-byte. Same Map keys, same byte
  contents at each key.
- The HTML emitted at `dist/index.html` is byte-identical to
  `renderSite(siteData, themeId)` when no `siteUrl` is provided. With a
  `siteUrl`, the build pipeline injects additional SEO meta tags
  (`<link rel="canonical">`, `<meta property="og:url">`, and
  `<meta property="og:image">` when the home hero has a `backgroundImage`)
  inside `<head>` — these are additive and do not change any other byte of
  the renderer's output.

## Browser-runnability

The runtime path takes no dependency on Node-only built-ins (`node:fs`,
`node:path`, `node:url`, `process`, `Buffer`, etc.). The dist folder is
modelled as a `Map<string, string>` so the same pipeline runs in the
in-browser editor (#7) and in the Electron build path. An e2e test bundles
the module for the browser via esbuild and asserts the bundle contains no
Node built-in references.

## SEO meta tags

The renderer (`@sosb/renderer`) already emits `<title>`, `<meta
name="description">`, `<meta property="og:title">`, `<meta
property="og:description">`, and `<meta property="og:type">` from page SEO
data. The build pipeline layers on top:

- `<link rel="canonical" href="<siteUrl>/<page-path>">` — when `siteUrl` is
  provided.
- `<meta property="og:url" content="<siteUrl>/<page-path>">` — when
  `siteUrl` is provided.
- `<meta property="og:image" content="<siteUrl>/<hero.backgroundImage>">` —
  when the page's first hero block has a `backgroundImage` AND `siteUrl` is
  provided.

Schema.org JSON-LD, hreflang alternates, and Twitter Card tags are out of
scope for v1's build pipeline (PRD lists them but they're tracked in
follow-up issues).

## Out of scope

- Asset processing pipeline (#8, #21).
- Multi-page paths (`despre/index.html`, etc.) — single-page only for v1.
- `hreflang` annotations and alternate-language sitemap entries — #23, #24.
- Document downloads — #21.
- Per-page Lighthouse budget verification — separate enhancement.

## Architecture

See [`docs/adr/0004-browser-build-pipeline.md`](../../docs/adr/0004-browser-build-pipeline.md)
for the design decisions behind this package.

Tracking issue: #5.
