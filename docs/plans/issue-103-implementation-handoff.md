# Issue #103 — implementation handoff

Running record of what has shipped against the Articles / builder-workflow
design contracts, and what the next agent inherits.

## Articles: delivered

Implements [issue #97](../plans/issue-97-article-publishing.md),
[issue #98](../plans/issue-98-article-tag-filtering.md), and the Articles half
of [issue #102](../plans/issue-102-builder-workflows.md), under
[ADR 0047](../adr/0047-article-publication-and-url-identity.md).

### Schema (`@sosb/schema`)

- `site.articles[]` and `site.tags[]`, both **optional**. A Site authored
  before Articles existed parses unchanged — no migration, no
  `SITE_SCHEMA_VERSION` bump, and readers must not write an empty array in on
  load (that would break ADR 0002's round-trip identity).
- `ArticleSchema`: permanent `id`, `lang`, `slug`, `slugHistory[]`, `title`,
  `summary`, `cover` (`AssetRef`) + sibling `coverAlt`, `publishedAt`
  (`YYYY-MM-DD`), `state`, `tags[]`, `translationGroup`, `seo`,
  `relatedArticles`, `blocks[]`.
- `articleList` block: `mode` (`byTag` | `selected`), `tags[]`, `articleIds[]`,
  `limit`, `sort`, plus `title` / `intro`.
- `article-select.ts` — `resolveArticleSelection`, `inspectArticleSelection`,
  `publishedTranslationsOf`. **The** implementation of selection semantics; the
  renderer, the validator, and the editor Inspector all call it.
- Validation: slug conflicts per language (including against reserved history),
  the reserved `articles` route prefix, duplicate ids, translation-group
  language collisions, unknown tag references, missing cover alt (warning),
  empty published articles (warning), and article Blocks validated with paths
  rebased onto `["articles", i, "blocks", j, …]`.
- `ValidationIssue.blocking` — the ADR 0048 carve-out. An active explicit
  selection pointing at a Draft or deleted Article in _public_ content cannot
  be overridden at the export gate. The same breakage inside a Draft, or inside
  a disabled Related Articles setting, is a warning.

### Renderer (`@sosb/renderer`)

- Pages and Articles share one `DocumentShell`, so the `<head>`, navigation,
  language switcher, and per-page script gating have a single implementation.
  Page _markup_ is byte-identical after the refactor: the only change to the
  existing golden files is the `[data-block="articleList"]` rules inserted into
  the inlined stylesheet, which every theme now carries.
- Articles render through the same Theme bundle a Page does (ADR 0052), so a
  Block inside an Article gets the same `data-variant` treatment, and
  `applyThemeSwitch` / `setBlockVariant` walk `site.articles` as well as
  `site.pages`.
- Article page: automatic title, date, summary and cover above the Block list,
  tag labels (plain text — there are no tag pages), Related Articles after.
- `articleList` block with cards (cover, title, date, summary, link). An empty
  list keeps its heading and shows "No articles yet."
- `noindex` for Unlisted; article routing, redirects, and publication-aware
  hreflang / language switcher in `routing.ts`.
- Theme CSS for `[data-block="articleList"]` and article pages in the stub
  baseline, `production-base`, and all five production themes. 12 new golden
  files; axe-clean on every theme.

### Build and zip

- `articles/<slug>/index.html` and `/<lang>/articles/<slug>/index.html`;
  Drafts omitted, Unlisted emitted.
- Slug-history redirects as static stubs (meta refresh + canonical + noindex).
- Published articles in the sitemap with their published alternates; Unlisted
  excluded.
- `Article` JSON-LD with `datePublished`, `inLanguage`, and a `publisher`
  reusing the Organization blob.
- Zip: `assets/` keeps everything; `dist/` drops files only Draft articles
  reference. The rule is narrow — anything also used by public content stays,
  and unreferenced orphans stay.

### Interaction with #116 (preview fidelity)

Articles are the deepest URLs the builder emits — `articles/<slug>/` and
`<lang>/articles/<slug>/` — so they are the sharpest test of #116's
depth-aware asset prefix. `renderSite` computes the prefix from the
Article's own dist path; reusing a Page's would emit `../assets/…` from a
directory needing `../../`. Regression tests pin both depths, the font URLs,
the preview resolver's precedence over the prefix, and the fact that an
article card on a Page uses the _Page's_ depth rather than the linked
Article's.

Zip export keeps #116's single `dist/assets/…` copy; the Draft-only filter
simply skips entries before that copy is written, rather than reinstating the
per-directory mirroring #116 removed.

Preview navigation merges with #116's relative-href normalisation, so an
author-written relative link resolves into an Article exactly as an absolute
one does. The base a relative href resolves against can itself be an Article,
so `resolvePreviewTarget` takes a `PreviewTarget` rather than a page index.
The preview reload key includes which Article is shown, because morphing
between two Articles would carry a scroll offset into a document the reader
has left.

### Editor (`@sosb/editor-app`)

`ArticlesPanel`, `ArticleSettingsForm`, `ArticleListInspector`, `TagManager`,
`TagPicker`, `ArticleWorkspace`, `InfoHint`, and the pure `articles-ops.ts`.
All exported standalone so the navigation redesign re-parents rather than
rewrites them. Wired in behind a Pages/Articles switch in the existing left
pane. Preview renders Articles through the real renderer; preview clicks
resolve Article URLs, including retired slugs. All strings via `@sosb/i18n`
(84 keys, ro + en).

## Decisions worth knowing

- **Tags render as plain text on the public site, never as links.** The brief
  asks for tags on the article page; CONTEXT.md says tags are internal and
  there are no tag pages. Non-linked labels satisfy both. Revisit only if
  public browsing by tag is ever actually wanted.
- **One resolver, public semantics everywhere.** Draft and dangling targets are
  dropped from list output in the editor preview too, rather than rendered as
  "ghost" cards. The Inspector labels each selection's state instead, so the
  author sees the problem without the preview lying about the exported page.
- **Article ids are never reused while referenced.** `nextArticleId` counts
  referenced ids as well as existing ones, so replacement content cannot
  inherit a deleted Article's placements.
- **Language is fixed at creation.** Translations are separate linked Articles,
  so there is no language selector on an existing Article; use "add
  translation" instead.
- **Renderer copy is per-page-language, not per-editor-locale.** `@sosb/i18n`
  carries builder strings chosen by the author's browser, which has nothing to
  do with the language a given exported page is written in.

## Deferred

- **Structured rich text (ADR 0048 / issue #100).** An Article body is a Block
  list whose initial Block is the existing `richtext` Block, so the migration
  is transparent: Articles inherit structured content when the Block gains it,
  with no change to the Article schema or the Article renderer.
- **Navigation redesign (issue #102).** The accepted content-overview
  navigation, phone drawer, and full-width Inspector are not built. The
  Pages/Articles switch here is deliberately minimal.
- **Arrow-group card navigation.** Issue #97 specifies responsive arrow
  navigation between groups of cards. The list currently renders all matches in
  a responsive grid; `limit` caps the count. No public content is unreachable,
  but the paging affordance is outstanding.
- **Empty-list author toast.** Issue #97 wants a toast when a list _becomes_
  empty. Validation reports the empty list as `info` and the Inspector shows it
  live; the transition-triggered toast is not implemented.
- **"More options" SEO overrides on Articles.** `seo.title` / `seo.description`
  are in the schema and honoured by the renderer, but not yet surfaced in the
  Article settings form.
- **Prototype validation.** Issue #102's interactive prototype has not been
  built or accepted; these surfaces implement the written contract only.
