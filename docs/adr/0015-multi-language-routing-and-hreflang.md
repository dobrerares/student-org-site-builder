# 0015 — Multi-language routing, hreflang, and language switcher

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #24

## Context

Issue #24 lights up multi-language support across `@sosb/schema`,
`@sosb/renderer`, `@sosb/editor-app`, and `@sosb/build`. The site spine
schema already carries `defaultLanguage`, `languages: string[]`, a per-page
`lang` field, and a per-page `localizedAs` cross-reference (#3). #23
shipped per-page URL trees for a single language (`/`, `/<slug>/`). The
PRD pins the broad strokes (PRD § 195, § 109-111, § 249, § 90) but does
**not** pin:

- the exact URL convention for secondary languages (`/<lang>/<slug>/` vs
  flat sub-domain vs cookie-driven),
- whether the home page of a secondary language lives at `/<lang>/` or
  `/<lang>/index/`,
- the hreflang annotation set (per-page only? sitemap only? both?),
- the missing-counterpart fallback (404? language home? default-language
  counterpart?),
- the language switcher's DOM shape (separate `<nav>`? slot inside the
  site nav?),
- which language code → native-name table the renderer ships with,
- where editor multi-language affordances live (inside the spine form?
  in the pages list? a new panel?).

## Decision

### URL convention: default language at root, secondaries under `/<lang>/`

Default-language pages keep the #23 path policy unchanged:

- default-language home → `/`
- default-language non-home → `/<slug>/`

Secondary-language pages are prefixed with the language code:

- secondary-language home → `/<lang>/`
- secondary-language non-home → `/<lang>/<slug>/`

`languageHomeIndex(site, lang)` finds the navOrder=0 page in the given
language; `pagePath` and `pageDistPath` consume it so the home-page
convention is identical across languages. Single-language sites are
byte-identical to their #23 output (no `/<lang>/` segment is ever
introduced when the site declares only one language).

Rejected alternatives:

- **Cookie-driven language detection on the same URLs** — breaks
  bookmarking and SEO, and means visitors arriving from a Google result
  in language B would see language A's content cached in their cookie.
- **Sub-domain per language (`en.example.org`)** — requires DNS work the
  user can't do themselves on Cloudflare Pages without writing custom
  workers; out of scope for a no-backend builder.
- **Default language under `/<lang>/` for symmetry** — loses the
  cleaner-URL win for the org's primary audience, contradicts PRD § 195.
- **Flat namespace across languages** (`/about` for EN, `/despre` for RO
  living side by side) — would force the wizard to ASCII-fold every
  language's slugs into a global namespace, and would collide whenever
  two languages happen to share a slug. The `/<lang>/` prefix resolves
  collisions structurally.

### Home-page resolution per language

`languageHomeIndex(site, lang)` picks the page with `navOrder === 0` and
matching `lang`. If no such page exists in that language, falls back to
the first page declared in that language. If the language has no pages
at all, returns `-1` so callers can short-circuit (the language switcher
falls back to `/` in that case).

This contract makes the editor's add-page / clone / move flows safe: as
long as each declared language has at least one page with
`navOrder: 0` (which the editor's add-language-version flow guarantees),
the language home renders at `/<lang>/` cleanly.

### hreflang in `<head>` AND in `sitemap.xml`

Each rendered page emits one `<link rel="alternate" hreflang="<lang>"/>`
in `<head>` per declared language, plus a final `x-default` entry. The
sitemap mirrors this via `<xhtml:link rel="alternate" hreflang="..."/>`
under each `<url>` element. Both surfaces matter for SEO: Google reads
the head tags for in-page navigation, but the sitemap is the canonical
hint when the head is missing (e.g. AMP pages, syndicated previews).

`hreflangEntriesFor(site, page)` is the single source of truth — both
the renderer's head emission and the build pipeline's sitemap walk
consume it, so the two surfaces never disagree.

Single-language sites emit **no** hreflang annotations and **no**
`xmlns:xhtml` declaration on the sitemap urlset. That keeps the
existing #23 byte-identical golden snapshots valid (`with-site-url/` and
`no-site-url/`).

### Missing-counterpart fallback: language home

When a page has no `localizedAs[<lang>]` entry for some other declared
language, the language switcher and the hreflang alternates both fall
back to that language's home page (`/<lang>/`). Visitors clicking
"English" on a page that hasn't been translated yet land on `/en/`
rather than a 404. The PRD makes this explicit (§ 110: "I want to land
on the home page of my chosen language instead of a 404").

The same fallback applies to the `x-default` hreflang when the active
page has no counterpart in the default language: it points at the
default-language home as the safest landing spot.

Rejected alternatives:

- **Fall back to the active page's path under `/<lang>/`** — breaks
  when the slug doesn't exist in the target language (404 again).
- **Render an "untranslated" stub page** — adds a per-language
  ghost-page concept to the schema and the build output for no SEO win
  (Google would still de-dupe a stub against the language home).
- **Drop the alternate entirely when no counterpart exists** — Google's
  i18n SEO docs explicitly recommend a language home fallback when a
  per-page counterpart is missing.

### Build: absolute hreflang in head when `siteUrl` is set

The renderer emits relative-path hreflang alternates so the
preview-iframe and the no-`siteUrl` build path render correctly. When
`siteUrl` _is_ set, the build pipeline strips the relative alternates
from the renderer's HTML and re-emits absolute ones (Google's i18n SEO
docs recommend absolute URLs in production hreflang).

Strategy: regex-strip `<link rel="alternate" hreflang="..."/>` from the
renderer output and append the absolute equivalents next to the
canonical / og:url overlay. This is similar to the canonical / og:url
overlay introduced in #5 and stays in `injectSeoMeta` so the build
pipeline owns the "absolute URLs require a configured origin" boundary.

Rejected alternatives:

- **Always emit absolute URLs from the renderer** — would force the
  renderer to know about `siteUrl`, which is the build pipeline's
  concern. The renderer stays a pure
  `(siteData, themeId, opts) -> HTML` function.
- **Keep relative alternates and absolutise via base href** — breaks
  the per-page canonical contract (canonicals are absolute; alternates
  should match).

### Language switcher: separate `<nav>` landmark, native names only

The switcher renders as a separate `<nav data-language-switcher
aria-label="Language">` after the site nav. Native names (`Română`,
`English`) are the link text, never flags (PRD § 109 + #24 AC: "no
flags"). Each link carries `lang` and `hrefLang` attributes for
assistive-tech disambiguation; the active language has
`aria-current="true"`.

Native-name resolution uses a small built-in table
(`NATIVE_LANGUAGE_NAMES`) covering the languages an org-site builder
realistically targets in v1 (RO, EN, DE, ES, FR, IT, HU, PL, PT, RU,
UK). Unknown codes fall back to the code itself; the wizard / import
flow keeps language codes ASCII so the fallback is human-readable.

The switcher is omitted entirely on single-language sites — same
"hidden when only one entry" contract as the site nav from #23.

Rejected alternatives:

- **Inline switcher inside the site nav** — would mix two distinct
  navigation landmarks (page-within-language vs language-of-page), bad
  for screen-reader users.
- **Theme-owned switcher rendered per theme** — five themes × five
  switcher implementations duplicates work and risks per-theme parity
  drift. The page shell owns it; themes can re-style via CSS by
  hanging selectors off `[data-language-switcher]`.
- **Auto-redirect on language detection** — explicitly out of scope per
  the PRD (§ 340: "No language auto-detection / auto-redirect on built
  sites").

### Schema: `localizedAs` validation rules

`validate(site)` now layers four `localizedAs` rules on top of the
existing schema-parse pass:

1. `site.page.localizedAs.unknownLanguage` (error) — referenced language
   not declared in `site.languages`.
2. `site.page.localizedAs.unknownCounterpart` (error) — referenced slug
   does not exist for that language in `pages[]`.
3. `site.page.localizedAs.selfReference` (error) — page lists its own
   language in `localizedAs`.
4. `site.page.localizedAs.missingCounterpart` (warning) — bilingual
   site has a page lacking a counterpart in some other declared
   language. Aligns with PRD § 204
   ("untranslated counterparts in declared bilingual pages" → warning).

The renderer + build pipeline trust the validator's shape, so they only
have to handle the _graceful_ missing-counterpart case (warning, not
error): render the switcher with a language-home fallback, emit the
hreflang for that language pointing at the language home.

### Editor: missing-translation indicator + "Add language version"

The pages-list panel (#23) gains:

- **Language groups** — when the site declares 2+ languages, the list
  renders one `<section data-testid="pages-list-language-group">` per
  language with the native name as a heading. Single-language sites
  render the flat list unchanged from #23.
- **Per-row missing-translation indicator** — a small `<span
data-testid="missing-translation-indicator">` listing the languages
  the page has no counterpart for. AC: "Editor 'missing translation'
  indicator visible per page".
- **Per-row "Add <Native Name> version" buttons** — one per missing
  language. Fires `onAddLanguageVersion(index, targetLang)`, which
  delegates to `addLanguageVersion(site, sourceIndex, targetLang)` in
  `pages-ops.ts`.

`addLanguageVersion` creates a new page in the target language with:

- the source's slug (preferred), falling back to a unique
  `<slug>-<lang>[-N]` suffix when the source slug is already used in
  the target language (cross-language slug reuse is explicitly OK
  because the `/<lang>/` prefix resolves the collision structurally,
  but within a single language the schema validator still requires
  uniqueness),
- the source's `navLabel` as a placeholder ("to be translated" copy
  is the user's job),
- a fresh hero block so the new page has something to render,
- `localizedAs` wired both ways so the switcher resolves the
  cross-reference immediately.

This stays small enough to fit in the existing pages-list panel. No
new top-level UI surface ships in this issue; a richer translation
workflow (side-by-side editing, translation memory) is explicit
out-of-scope.

## Rationale

The most subtle requirement is that single-language sites must stay
byte-identical to the #23 output. Three safeguards:

1. The renderer's `pagePath` / `pageDistPath` introduce no
   `/<lang>/` segment when the page's `lang === site.defaultLanguage`,
   matching #23's contract verbatim.
2. The renderer emits hreflang alternates **only** when
   `site.languages.length >= 2`, matching the language-switcher rule.
3. The build pipeline's `emitSitemapXml` only declares the `xmlns:xhtml`
   namespace and only emits `<xhtml:link rel="alternate"/>` entries
   when the site declares 2+ languages.

Together these keep the build's golden snapshots
(`__golden__/with-site-url/` and `__golden__/no-site-url/`)
byte-identical without any test fixture surgery.

## Consequences

- `@sosb/schema`'s `validate()` reports four new `localizedAs` codes
  (three errors, one warning).
- `@sosb/renderer` exports new helpers: `homePagePathForLanguage`,
  `hreflangEntriesFor`, `languageHomeIndex`,
  `languageSwitcherEntriesFor`, `nativeLanguageName`. Existing helpers
  (`pagePath`, `pageDistPath`, `homePageIndex`, `navPagesFor`) are
  unchanged for single-language sites.
- The page shell emits `<link rel="alternate" hreflang="..."/>` in the
  head and `<nav data-language-switcher>` in the body when the site
  declares 2+ languages.
- `@sosb/build` emits per-language directory trees (`<lang>/...`) and
  augments the sitemap with `<xhtml:link rel="alternate"/>` entries.
  The `siteUrl` overlay also rewrites the renderer's relative-path
  hreflang to absolute URLs.
- `@sosb/editor-app`'s `pages-list.tsx` groups by language, surfaces a
  missing-translation indicator, and offers "Add <Lang> version"
  buttons. `pages-ops.ts` ships `addLanguageVersion` and
  `missingTranslationLanguages` helpers.

## Alternatives considered

- **Per-language `pages: Record<lang, Page[]>`** — a different schema
  shape that would make per-language listings trivial, but breaks the
  existing flat `pages: Page[]` model #23 ships against and forces
  every other consumer (editor preview, build pipeline, routing
  helpers) to walk a record-of-arrays.
- **Cross-language slug aliasing inside `pages-ops`** — would let
  "Add EN version" auto-create a slug from the source's slug via a
  translation table. Too magical for v1; the user-controlled
  `<source-slug>-<lang>` fallback is predictable and surfaces in the
  editor for the user to rename.
- **Sitemap as a per-language file (`sitemap-en.xml`, `sitemap.xml`,
  `sitemap-index.xml`)** — overkill for v1 (org sites typically have
  10-20 pages total, not 10,000). The single-file sitemap with
  `xhtml:link` annotations is the documented Google-recommended path
  for sites under the 50k-URL limit.

## Out of scope

- **RTL layout support** — explicitly out per #24.
- **Editor UI string translation (RO / EN editor surface)** — owned by
  #42 (editor i18n). #24 only ships the multi-language _site output_.
- **Per-language schema variation** — schemas are language-agnostic.
- **Automatic translation (machine translation of content)** —
  explicitly out per #24.
- **Per-language theme overrides** — out of scope; themes are
  language-agnostic.
- **Inline translation memory / suggested translations** — a richer
  translation workflow is a v2 concern.
- **Per-language `<lastmod>` in sitemap entries** — schema has no
  source signal yet (deferred per ADR 0004).
