# 0004 — Browser-runnable build pipeline

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #5

## Context

Issue #5 asks for the build pipeline that turns a validated `Site` into a
deployable `dist/` folder: HTML for each page (driven by `@sosb/renderer`),
SEO meta overlay (canonical, Open Graph), `robots.txt`, and a starter
`sitemap.xml`. v1 is single-page, single-language. Multi-page output and
`hreflang` annotations land in #23 + #24.

A binding constraint is that the same code path must run in the in-browser
editor (#7) and in the Electron build path. The PRD pins this (Renderer &
themes section): "the same code runs at build time (in Node for Electron,
in the browser-side build pipeline for the browser editor)". The renderer
already meets this contract (see ADR 0003); the build pipeline must too.

The PRD does **not** pin:

- the dist-folder representation (real filesystem? Map? object?)
- the SEO injection mechanism (re-render with extra meta? string-edit the
  rendered HTML?)
- the `siteUrl` flow (caller-provided? read from the site schema?)
- the sitemap fallback when no `siteUrl` is known

This ADR records those choices.

## Decision

### Dist representation: **`Map<string, string>`**

The `build()` function returns a `Map<string, string>` keyed by POSIX-style
relative paths (`index.html`, `robots.txt`, `sitemap.xml`). Values are UTF-8
text. The caller is responsible for materialising the dist — the editor
inflates it into a downloadable zip, the Electron build path writes it to
real files, the upcoming asset pipeline (#8) extends the Map with
`Uint8Array` values for binary assets.

Rejected:

- **Plain object (`{ [path]: contents }`).** Fine in v1, but
  `Map<string, ...>` keeps insertion order deterministic across all engines
  and supports `Uint8Array` values without a discriminated-union shim once
  #8 lands.
- **Streaming / async-iterable interface.** The dist is small (single page
  HTML + two text files in v1, plus a handful of assets in #8); the
  determinism contract is easier to test against an eagerly-built Map than
  against a stream. Revisit only if dist sizes grow past memory pressure.
- **Real filesystem (`writeFile()`).** Forces a Node-only runtime path
  (`fs`, `path`), violating the binding browser-runnability AC. The
  filesystem materialisation is the caller's job; the builder hands them
  pure data.

### SEO injection: **head-overlay via string splice**

The renderer's `<head>` already emits `<title>`, `<meta name="description">`,
`<meta property="og:title">`, `<meta property="og:description">`, and
`<meta property="og:type">` (see `packages/renderer/src/page-shell.tsx`).
The build pipeline layers on top:

1. `<link rel="canonical" href="<siteUrl>/<page-path>">` — when `siteUrl`
   is provided.
2. `<meta property="og:url" content="<siteUrl>/<page-path>">` — when
   `siteUrl` is provided.
3. `<meta property="og:image" content="<siteUrl>/<hero.backgroundImage>">` —
   when the page's first hero block has a `backgroundImage` AND `siteUrl`
   is provided. Absolute hero URLs (`https://cdn.example.com/...`) are
   preserved verbatim, not double-prefixed.

Mechanism: locate the closing `</head>` tag in the renderer's output and
splice the additional tags immediately before it. Three reasons we do
**not** push these tags down into the renderer:

- The renderer is a pure `(data, themeId) → string` function with no
  notion of a deployment URL. Adding a `siteUrl` parameter there couples
  build-time concerns into the editor preview iframe, which legitimately
  doesn't know its eventual hosting URL.
- The renderer must emit byte-identical output in Node and browser (ADR
  0003). Plumbing a build-options object through it widens the determinism
  surface.
- The overlay is **additive**: the test suite asserts that for any
  `siteUrl`, the body of the rendered HTML (everything outside `<head>`)
  is byte-identical to the renderer's no-siteUrl output. This keeps the
  build pipeline a thin layer the editor can trust.

Rejected:

- **Re-render with extra meta tags.** Would require the renderer to know
  about `siteUrl` and SEO overlays (see above).
- **Parse-and-rewrite via a DOM library.** Heavier than the splice, ships
  a parser (`linkedom`, `cheerio`) for one operation. The splice is a
  bounded transformation on a known-shape document.
- **Append the tags to `</body>`.** Search engines and social-media
  scrapers expect `<link rel="canonical">` and `og:*` tags in `<head>`.

### Order of injected tags: **canonical → og:url → og:image**

A fixed deterministic order so repeated calls produce byte-identical
output. Consumers (search engines, social scrapers) do not care about
order beyond "in `<head>`".

### `siteUrl` flow: **caller-provided option, not on the schema**

`build(site, { siteUrl: "https://...", themeId: "..." })` accepts the URL
as a build-time concern. We do **not** add a field to `site.org`. Three
reasons:

- The same `data.json` ships across deploys (preview, staging,
  production). Hardcoding a URL in the canonical document of truth makes
  multi-environment publishing painful.
- The PRD's data-and-schema section is silent on a deploy-URL field; the
  build option is a strictly smaller commitment than amending the schema
  and going through migration scaffolding.
- The browser editor (#7) can default the `siteUrl` from a configured
  preview origin (`window.location.origin`) without polluting the user's
  saved data.

When `siteUrl` is **omitted**, the pipeline falls back to:

- **HTML:** the renderer's output verbatim (no canonical/og:url/og:image).
- **`robots.txt`:** no `Sitemap:` directive (search engines reject
  relative `Sitemap:` values).
- **`sitemap.xml`:** a relative `<loc>/</loc>` fallback. Technically a
  partial sitemap (search engines want absolute URLs), but a
  structurally-valid file the user can preview before deciding where to
  host. The user re-runs the build with `siteUrl` set when they're ready.

### `themeId` resolution: **`options.themeId` overrides `site.theme.id`**

Defaults to `site.theme.id` so the common case (`build(site)`) reads the
theme from the data. `options.themeId` is an escape hatch for the editor
preview when the user is mid-theme-swap.

### Browser-runnability verification: **bundle for browser, assert clean import**

A vitest test bundles `packages/build/src/index.ts` for the browser via
esbuild (`platform: "browser"`, all Node built-ins implicitly external)
and asserts:

1. The bundle build succeeds. Any code path on the runtime path that
   imports `node:fs`, `node:path`, etc. surfaces as an unresolvable-import
   error from esbuild.
2. The bundle text contains no `from "node:..."` / `from "fs"` /
   `from "path"` / etc. specifiers, no `process.env`/`process.platform`/
   `process.cwd` references.

A Playwright e2e (`e2e/build-browser.spec.ts`) bundles the build for
both Node and browser, runs both in their respective environments
(headless Chromium for browser, dynamic-import for Node), and asserts the
emitted dist Maps are byte-equal. This catches code paths the static
analysis misses (e.g. a runtime `globalThis.fs` lookup).

### Snapshot test framework: **per-file `toMatchFileSnapshot`**

End-to-end, the dist is captured to `__golden__/dist/` with one file per
emitted artefact. Two snapshot directories:

- `__golden__/dist/with-site-url/` — full overlay (canonical, og:url,
  og:image, robots `Sitemap:`, absolute sitemap `loc`).
- `__golden__/dist/no-site-url/` — renderer-only HTML, no robots
  Sitemap, relative sitemap `loc`.

We snapshot per-file rather than a serialised Map because (a) PR diffs
read naturally per artefact (HTML diff vs. XML diff), (b) a regression in
`index.html` doesn't whole-cloth invalidate the `robots.txt` snapshot.

The snapshot directory is covered by the existing
`packages/*/test/__golden__/**` glob in `.prettierignore` — no new entry
is needed.

### `<lastmod>` in sitemap: **not emitted in v1**

The site schema has no `updatedAt` field, and the build is required to be
deterministic across rebuilds. Synthesising a date (e.g. `Date.now()`)
breaks determinism; pinning to a fake date (e.g. `1970-01-01`) ships
misleading data to search engines. We omit `<lastmod>` until the schema
gains a real updated-at signal — that's a follow-up beyond the v1 series.

## Rationale

The most subtle requirement is "no Node-only deps on the runtime path"
combined with "byte-identical Node and browser output". The renderer
already cleared that bar (ADR 0003). The build pipeline's only additional
concerns are string transformations (head splice, robots/sitemap
templates), all of which are pure JS — no Node primitives needed. By
keeping the dist representation a `Map<string, string>` and pushing
filesystem materialisation to the caller, we preserve the property without
any adapter shim.

The head-overlay-via-splice mechanism is a small bet that the renderer's
`<head>...</head>` shape stays well-formed. The renderer's tests already
guarantee that — it always emits exactly one head, never reorders the
prologue. If that ever changes, the build's snapshot tests detect the drift
in the same CI run.

The `siteUrl` choice (option, not schema field) reflects the project's
"data.json is the canonical artifact" stance: the data should travel
unchanged across environments. The same `data.json` should produce a
preview-deploy build and a production build that differ only in the
caller-supplied options, never in the data.

## Consequences

- `packages/build` declares peer-style workspace deps on `@sosb/renderer`
  and `@sosb/schema`. No new runtime deps; `esbuild` is dev-only and used
  exclusively by the browser-runnability test.
- The build's `tsconfig.json` and `tsconfig.test.json` set
  `"jsx": "react-jsx"` + `"jsxImportSource": "preact"` so they can
  type-check imports from `@sosb/renderer/src/index.tsx` (the renderer's
  `main` is `.tsx`).
- `packages/build/test/__golden__/` is an additive directory; the existing
  `.prettierignore` glob covers it.
- Two new e2e files (`e2e/build-browser.entry.ts`,
  `e2e/build-browser.spec.ts`) gate browser-runnability under the
  existing Playwright config — no new project entry needed.

## Alternatives considered

- **Re-render the whole page when `siteUrl` is provided.** Doubles the
  rendering cost in the editor preview every time a token changes (since
  the editor calls `build()` to assemble preview content). The splice
  approach is O(n) on the HTML length and incurs no extra render.
- **Walk `site.pages` even though v1 is single-page.** Looks more
  forward-compatible but commits to the per-page output paths now. #23 is
  the place for that decision; it'll touch slug-to-path mapping, nav
  ordering, and `hreflang` together.
- **Generate a sitemap via an XML builder library.** Premature for one
  `<url>` entry. The string template is auditable and the snapshot test
  protects it. Revisit at #23 when entries scale.
- **Throw if `siteUrl` is missing instead of falling back to relative
  values.** Would block users from previewing the dist before they
  decide on hosting. The PRD positions the editor as fully usable before
  any deployment decision.

## Out of scope

- **Per-page paths** (`despre/index.html`, etc.) — single-page only for
  v1, multi-page is #23.
- **`hreflang` annotations and per-language sitemap entries** — #24.
- **Schema.org JSON-LD** — PRD lists it; covered by a future issue
  (`Organization`, `Person`, `Event`, `FAQPage`, `BreadcrumbList`).
- **Twitter Card tags** — orthogonal to AC #3 (Open Graph); a future
  issue can layer them onto the same head-overlay path.
- **Asset pipeline integration** (`assets/...` in dist) — #8 / #21.
- **Per-page Lighthouse budget verification** — separate enhancement.
- **`<lastmod>` / `<changefreq>` / `<priority>` in sitemap** — defer
  until the schema carries the source data.
