# 0007 — Multi-page routing, slug rules, and per-page emit

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #23

## Context

Issue #23 lights up multi-page support across `@sosb/schema`,
`@sosb/renderer`, `@sosb/editor-app`, and `@sosb/build`. The site spine
schema already carries a `pages: Page[]` array (#3); v1 shipped
single-page (`build()` always emitted `dist/index.html`). This ADR records
the cross-cutting decisions multi-page introduces:

- the slug shape (what's a legal `Page.slug`),
- the URL/path mapping (how slugs become `/<path>` and `dist/<path>`),
- the home-page convention (which page lives at `/` rather than `/<slug>/`),
- the navigation emission rule (when the renderer adds `<nav>` and how it
  marks the active page),
- and where i18n / `hreflang` lives (or doesn't).

The PRD pins broad strokes (PRD § 64-67, 193-195, 339): flat slugs only,
no nested page hierarchy, multi-language via separate page trees with
`localizedAs` cross-references, default-language pages live at the URL
root and secondary languages live under `/<lang>/...`. The PRD does **not**
pin:

- the exact slug pattern (lowercase? hyphens? digits?),
- which page is "home" when a site has both languages with `navOrder: 0`,
- the renderer's nav DOM shape,
- whether the build emits a per-language sub-tree or flat slugs (#24's job),
- how the editor switches the active page surfaced in the form / preview.

## Decision

### Slug shape: lowercase ASCII, digits, single hyphens between segments

`@sosb/schema`'s new `checkSlug(value)` (and the `SLUG_PATTERN` regex)
accept `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Concretely:

- empty → `slug.empty`
- contains `/` → `slug.containsSlash` (separate code so the editor can
  surface the "no nested hierarchy in v1" message specifically)
- non-`[a-z0-9-]` characters → `slug.invalidCharacters`
- otherwise fails the pattern → `slug.malformed` (catches leading/trailing
  hyphens, `--`, single hyphen, etc.)

`validate()` reports each malformed slug as a `severity: "error"` issue at
path `["pages", idx, "slug"]` with a `site.page.slug.<code>` machine code.
This is layered on top of the existing duplicate-within-language check.

Rejected alternatives:

- **Allowing Unicode (`despre`, `acasă`)** — round-trips through URL paths
  only via percent-encoding. Generated dist paths would no longer be
  human-readable, and search engines index decoded paths inconsistently.
  The wizard / import flow ASCII-folds Romanian content before persisting.
- **Allowing underscores or dots** — convention in the wider web is
  hyphens for word separation. Underscores / dots make multi-word slugs
  read worse in search results.
- **Allowing `/` for nested hierarchy** — explicitly out of scope per the
  PRD (§ 195, § 339).

### URL / path mapping

The renderer's `routing.ts` (also re-exported from `@sosb/renderer`)
implements three pure helpers consumed by both the renderer and the build
pipeline so the "where does this page live?" decision exists in one place:

- `homePageIndex(site): number` — index of the `defaultLanguage` page with
  `navOrder: 0`. Falls back to `0` if no such page exists. The fallback
  keeps single-language and default-fixture sites working without a
  special-case.
- `pagePath(site, page): string` — the URL path. Always starts with `/`
  and ends with `/`. Home → `/`. Every other page → `/<slug>/`.
- `pageDistPath(site, page): string` — the dist-folder relative path.
  Home → `index.html`. Every other page → `<slug>/index.html`.

Trailing slash on every URL keeps the `<a href>` resolution unambiguous
(`/despre/` resolves relative-asset URLs against `/despre/`, never
against `/`). It also matches the directory-style file emit one-to-one
with the URL.

Within a language, the schema validator already enforces slug uniqueness.
Across languages, two pages can share a slug (`acasa` in `ro` and
`acasa` in some other language). That would collide at the dist-path
level — but for v1 the demo and starter content uses
language-distinct slugs (`acasa` / `home`, `despre` / `about`). #24
introduces the `/<lang>/...` prefix that resolves the collision
structurally.

Rejected alternatives:

- **No trailing slash** (`/despre`) — would force `<a href>` on
  per-block links to stay absolute (`/despre/contact` would break),
  shifts the burden onto every block author.
- **Default language under `/<lang>/`** — visitor-facing URLs become
  uglier; PRD § 195 explicitly puts the default language at the root.
- **Hashing slugs** (`/p/abc123/`) — discoverability and SEO loss for no
  benefit on a v1 single-org-site builder.

### Home-page convention: `defaultLanguage` + `navOrder: 0`

The page that maps to `/` is the `Page` with `lang === site.defaultLanguage`
and `navOrder === 0`. If no such page exists, the renderer/build fall
back to `pages[0]`. Two consequences:

- The editor's add/clone/delete/reorder operations re-number `navOrder`
  per language so the home page contract stays intact across edits.
- Mid-edit invariants are forgiving — the editor surfaces an active page
  index and clamps it to the available range so a delete doesn't strand
  the form on a non-existent page.

Rejected alternatives:

- **Use `pages[0]` as home regardless of language** — breaks bilingual
  sites where the user has reordered `pages[]` for editorial reasons but
  still wants the Romanian home at `/`.
- **Add an `isHome` boolean to `Page`** — a fourth way to express
  "primary page" alongside `navOrder: 0` and `defaultLanguage`. We avoid
  the redundancy: `defaultLanguage` is a site-level fact, `navOrder` is a
  page-level fact, both already in the schema.

### Renderer nav: `<nav data-site-nav>` with `aria-current="page"`

When `navPagesFor(site, page).length > 1`, the page shell emits:

```html
<nav data-site-nav aria-label="Site navigation">
  <ul>
    <li><a href="/" data-active="true" aria-current="page">Acasă</a></li>
    <li><a href="/despre/" data-active="false">Despre</a></li>
  </ul>
</nav>
```

`navPagesFor` filters `site.pages` by:

- same `lang` as the active page (cross-language nav is the language
  switcher's job, owned by #24),
- `showInNav: true` (utility pages opt out per PRD § 65),
- sorted by `navOrder` ascending; ties broken by `pages[]` order.

When the filter returns 0 or 1 page, the `<nav>` element is omitted
entirely so single-page sites render exactly as before. This satisfies
the AC: "Sites with one page have nav hidden (single-page UX
preserved)".

Rejected alternatives:

- **Always emit the nav, hide via CSS** — adds noise to the document and
  to screen-reader output for single-page sites. The PRD's AA target
  prefers a tighter DOM.
- **Highlight via CSS class only (no `aria-current`)** — `aria-current="page"`
  is the assistive-tech-correct way to express the active link;
  themes can still hang styling off `[aria-current]` or `[data-active]`.
- **Render the nav inside `<main>`** — `<nav>` is a top-level landmark
  per the HTML spec; nesting it under `<main>` would make screen-reader
  navigation worse.

### Per-page build emission

`build(site)` walks `site.pages` in order. For each page:

1. `renderSite(site, themeId, { pageIndex: idx })` — the existing
   per-page render path.
2. With `siteUrl` set, the head-overlay (canonical, og:url, og:image)
   uses the page's own `pagePath` so each page's canonical points at
   itself.
3. The output is keyed at `pageDistPath(site, page)` in the dist `Map`.

The sitemap walks the same loop and emits one `<url>` entry per page,
using each page's `pagePath`. Order follows `pages[]` declaration order
so repeated builds stay deterministic. `xhtml:link rel="alternate"`
annotations and per-language sub-trees are still owned by #24.

`robots.txt` is unchanged: a single `User-agent: *` / `Allow: /` rule,
plus a `Sitemap:` directive when `siteUrl` is set.

Rejected alternatives:

- **Re-render once and string-replace per page** — half the rendering
  cost on small sites, but breaks `aria-current` highlighting and
  per-page SEO. Not worth the complexity.
- **Walk only `showInNav: true` pages** — utility pages still need to be
  reachable at `/<slug>/` (e.g. a "Thank you" page after a CTA). They
  just don't go in the visible nav.

### Editor: pages list panel + active-page index

`EditorApp` renders a new `<PagesList>` above `<SpineForm>`. Pages list
responsibilities:

- one entry per page, showing `navLabel`, `slug`, `lang`, and an
  `data-active` flag matching the editor's `activePageIndex` state,
- per-row buttons: `select`, `move-up`, `move-down`, `clone`, `delete`,
- a slug-entry form for adding new pages, validating against
  `checkSlug` and the per-language uniqueness rule before firing
  `onAdd`,
- a two-step delete (first click arms confirmation; second click
  confirms) so a stray click can't destroy a page,
- delete disabled when there's only one page (a site needs ≥1).

The pure mutation helpers (`addPage`, `clonePage`, `deletePage`,
`movePage`) live in `pages-ops.ts` so unit tests can drive them without
rendering Preact, and so a future keyboard-shortcut surface can reuse
them.

The active page index is editor-app state (not editor-state state).
Reasons:

- it's a UI concern, not part of the canonical `Site`,
- it survives `EditorState.update` because it's stored alongside, not
  inside, the snapshot,
- it's clamped on every render so a delete doesn't strand the form.

Rejected alternatives:

- **Drag-and-drop reorder in v1** — PRD § 92 lists drag-and-drop for
  block reordering; page reordering uses up/down buttons in v1 to keep
  the surface small. Drag-and-drop can layer on later.
- **Inline slug editing** — risk: a stale URL path published before the
  editor surfaces the rename. Add as a separate "rename page" affordance
  in a follow-up.
- **Pages list inside `<SpineForm>`** — violates the form-generator
  carve-out (`pages[].blocks` is intentionally elided from
  `fieldsFromSchema`); the dedicated panel keeps responsibilities clean.

## Rationale

The most subtle requirement is that single-page output must stay
byte-identical to v1. Two safeguards:

1. The single-page golden snapshots (`__golden__/with-site-url/`,
   `__golden__/no-site-url/`) still hold because the home-page
   `pagePath` is `/` (matches the v1 hard-coded `/`), and the sitemap
   for a one-page site still emits exactly one `<url>` entry.
2. The renderer hides the nav when only one in-nav page exists, so the
   v1 hero-only golden file (`renderer/test/__golden__/stub-theme-hero.html`)
   is also unchanged.

The pure-helper split (`routing.ts`) keeps the path policy in one
place. If #24 changes the policy (per-language sub-trees), it changes
`pagePath` / `pageDistPath` once and the renderer + build follow.

The editor's pages-list panel is intentionally separate from the
spine-form. The form-generator's carve-out for `pages[].blocks` was
already in place (so block forms can land in #9-#22); the pages list
sits _above_ the spine form and operates on the `pages[]` array
shape directly via the schema-aware `pages-ops.ts` helpers.

## Consequences

- `@sosb/schema` exports `checkSlug`, `isValidSlug`, `SLUG_PATTERN`.
  `validate()` now flags malformed slugs.
- `@sosb/renderer` gains `routing.ts` (`homePageIndex`, `pagePath`,
  `pageDistPath`, `navPagesFor`) and emits a `<nav>` landmark with
  `aria-current="page"` on the active link.
- `@sosb/build` walks `site.pages` and emits per-page entries. Sitemap
  enumerates every page. v1's single-page golden snapshots stay valid.
- `@sosb/editor-app` adds `pages-list.tsx` (UI) and `pages-ops.ts` (pure
  helpers); `EditorApp` tracks an `activePageIndex` and forwards it
  through `iframeSrcdoc` and `host.postSiteData` to the preview iframe.
- `no-node-imports.test.ts` — bumped per-test timeout to 30 s for cold
  esbuild on Windows now that the dependency graph is slightly larger.
  No production-runtime change.

## Alternatives considered

- **Add a `path` field to `Page`** — would make the path explicit per
  page but introduces a new redundancy with `slug`. The current model
  derives the path purely from `slug` + the home-page convention; the
  schema stays minimal.
- **Build emits per-language directories now** — tempting for
  forward-compatibility, but #24 owns the language-tree decision (which
  also has to consider `localizedAs` cross-links and the language
  switcher).
- **Sitemap entries sorted by `navOrder`** — declaration order is more
  predictable for diff-driven snapshot tests; navOrder ordering would
  re-order entries every time the user reorders pages even when the
  set of pages is unchanged.

## Out of scope

- **i18n URL trees / `hreflang` annotations** — owned by #24.
- **Per-page theme overrides** — explicitly out per the issue body.
- **Nested page hierarchy** — explicitly out per the PRD (§ 195, § 339).
- **Drag-and-drop page reordering** — up/down buttons in v1; DnD is a
  follow-up enhancement.
- **Inline slug rename** — needs an "old slug → 301 redirect"
  conversation we're not having yet.
- **Sitemap `<lastmod>` / `<changefreq>` / `<priority>`** — schema has
  no source signal yet (deferred per ADR 0004).
