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

## Builder redesign (issue #102): delivered

Implements the navigation and workflow half of
[issue #102](../plans/issue-102-builder-workflows.md) under
[ADR 0053](../adr/0053-builder-navigation-state-model.md), keeping ADR 0042's
Inspector and PR #116's preview fidelity.

### Shell (`@sosb/editor-app`)

- `builder-navigation.ts` — the pure `Destination` / `WorkspaceDrill` model
  with `reconcileDestination` and `reconcileDrill`, unit-tested for the
  awkward cases (deleted page under an open workspace, vanished Block under
  an open Inspector, imported-away project).
- `MainNav` — five destinations, Create Page / Create Article, the
  content-language picker; a rail at ≥768px, a drawer below with scrim,
  Escape and focus return.
- `OverviewScreen` — Pages and Articles summaries, per-state counts, create
  actions, Site Health with `FindingList` (problem and repair action visible,
  explanation behind an (i), "blocks exporting" keyed on
  `ValidationIssue.blocking`).
- `PagesScreen` — heading with (i), one-click Create Page, search, the
  existing `PagesList` (slug validation, reorder, clone, delete, language
  versions) with its own header hidden.
- `ArticlesScreen` — search, language / state / tag filters, Manage tags,
  one-click Create Article, rows with state and language badges, delete with
  confirmation.
- `Workspace` + `SplitView` — one workspace for Pages and Articles: back to
  the list, title (an Article's address follows it while it is a Draft with
  no history), the settings row, the Block outline with Move up / Move down
  and drag, and for Articles the publication-state selector with its (i),
  "Add {lang} version", and Related Articles after the Blocks. Inspectors
  for a Block (`BlockInspector`, the one chain for `articleList`,
  `customHTML` and the generated form), the content's settings, and Related
  Articles, each with a back button naming the content. Editing beside the
  preview at ≥768px, Edit / Preview switch below, hidden pane kept mounted.
- `PreviewPane` — PR #116's morphing receiver, device presets and scaling
  intact; a pane bar naming what is previewed, "Back to this page/article"
  when the preview has wandered, and "Edit this Page / Article".
- Theme and Site settings — site-wide forms on the same split view with an
  adjacent preview of the last content looked at.
- Top bar — brand, local save status with the "Downloaded copy" line and its
  (i), undo/redo, Open, Start over, **Save project**, **Export website**
  (with the blocking count on the button).
- `ExportReadinessPanel` — replaces the pre-export confirmation: blockers
  with Fix, warnings with Fix, the (i), the typed-phrase override for
  ordinary errors, disabled outright for blocking issues.
- Help behind (i) icons everywhere the design asked: Overview cards, Pages,
  Articles, Theme, Site settings, publication state, language versions,
  Related Articles, the Blocks outline, the preview, save status, export.
- Strings: every shell string through `@sosb/i18n` in ro and en (`builder.*`,
  `overview.*`, `pages.*`, `workspace.*`, `preview.*`, `export.*`,
  `articles.info`, `theme.info`, `settings.info`).
- Styles: `editor-app-css.ts` gains the shell section (nav rail and drawer,
  screens, cards, summary rows, findings, split view with sticky pane bars,
  workspace outline, readiness groups, phone media query). The generic
  button chrome applies to plain buttons only, so `@sosb/ui` controls style
  themselves; `Button` gains `data-tone="accent"` for the back buttons.

### Tests

- Unit: `builder-navigation.test.ts`; the drill-in, history, validation,
  preview, i18n, layout, multi-page and save-status suites rewritten against
  the Overview, the readiness panel and the split view via
  `test/helpers/nav.ts`; `ArticlesScreen` and `Workspace` suites.
- E2E: `e2e/builder-helpers.ts` (`openSection`, `openFirstPage`,
  `exportWebsite`); every spec that assumed a Block list at boot now opens
  the home page; `editor-app.spec.ts` checks the split view, the phone
  switch, preview-follows-link and Edit this Page; `articles.spec.ts` checks
  one-click create and the address following the title.

### Not in this delivery

- **Tiptap `RichTextField`** (feat/rich-text) had not merged when this
  landed; the Rich-text Block still edits Markdown in a textarea. Wiring is a
  swap inside `BlockInspector` once it does.
- The Add-block dialog's chrome and the block catalog's labels and
  descriptions (`block-catalog.ts`) predate the i18n pass and are still
  English-only. The `PagesList` and `BlockListEditor` row copy was translated
  in the #118 review.
- The Overview's article date is shown raw (`YYYY-MM-DD`).

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
- **Create Page and Create Article use the content language.** The
  navigation's picker applies to both; it falls back to the Site's default
  when the chosen language is no longer declared.
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
- **Navigation redesign (issue #102).** Delivered — see "Builder redesign
  (issue #102): delivered" above and ADR 0053.
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
- **Prototype validation.** Issue #102's interactive prototype was built and
  accepted (#113). The production surfaces follow its visual system; a
  round of use by an actual student member is still the real validation.

## Rich text: delivered

Implements [issue #100](issue-100-rich-text-contract.md) and the Tiptap half of
[issue #101](issue-101-builder-ui-stack.md), under
[ADR 0048](../adr/0048-structured-rich-text-block-content.md) and
[ADR 0049](../adr/0049-react-builder-ui-and-preact-renderer.md).

### Schema (`@sosb/schema`)

- `RichTextDocument` v1 (`src/rich-text-doc.ts`): `{ version, content }` over
  paragraphs, h2–h4 headings, bullet and ordered lists, blockquotes and images,
  with `bold` / `italic` / `underline` / `strike` / `code` / `link` marks on
  text. The document version is **independent of** the Block version, so the
  vocabulary can grow without a Block migration.
- **Marks are stored outermost-first.** `[{bold},{link}]` serialises to
  `<strong><a>…</a></strong>`; the reverse array gives the reverse nesting.
  This is what makes byte-exact Markdown parity achievable — a canonical mark
  order could not reproduce both `**[a](u)**` and `[**a**](u)`.
- **Link targets are identities, not URLs**: `{kind:"page", pageId}`,
  `{kind:"article", articleId}`, `{kind:"external", href}`. The Renderer
  resolves them with `pagePath` / `articlePath`, so an Article link carries
  its language segment and a slug rename moves every link that pointed at it.
- `Page.id` — new, **optional**, permanent, and assigned lazily by the link
  picker. Optional because ADR 0002 forbids inventing fields when a project is
  merely opened; assigned at the first moment it means something.
- Images use `RichTextImageAssetSchema`, structurally the canonical
  `AssetRefSchema` with `alt` relaxed to allow empty. The canonical `min(1)`
  would turn a missing description into a parse error, and issue #100 requires
  it to be a warning that never makes a project unopenable.
- Unknown nodes and marks parse as loose objects and round-trip verbatim.
- `richText` Block **v1 → v2**, registered in `BLOCK_MIGRATIONS` and run at
  load time — `migrateSite` now walks every Block container on the Site
  (`pages`, and `articles` when present), which it did not do before.
  `SiteMigrationResult` gained `blockMigrations[]`.
- `ValidationIssue.blocking` and `hasBlockingIssues` (see the conflict note
  below), plus the rules: `doc.empty` (warning),
  `content.unsupported` (error, blocking in public content),
  `image.bytes.missing` (error, blocking in public content),
  `image.alt.missing` (warning), `link.missing` / `link.draft` (warnings).
  The two blocking rules honour the Draft carve-out: the same content inside a
  Draft Article produces an ordinary error, and inside an Unlisted one a
  blocking error, because Unlisted pages are emitted.
- `validate(data, options?)` gained `assetPathExists`. Byte presence cannot be
  derived from Site data, so the host injects it; without it the check simply
  does not run rather than guessing. The editor backs it with the display-URL
  cache, which is already the synchronous view of what the project VFS holds
  and is keyed by the same content hash every asset path carries — so the
  check costs a `Map` lookup and validation stays synchronous.

### Markdown migration (`@sosb/markdown`)

- `markdownToRichTextDoc` mirrors the existing block and inline grammar rule
  for rule, reusing `inline.ts`'s delimiter-scanning helpers so the two paths
  cannot drift on matching.
- **The parity claim is proved, not asserted.** Every Markdown string ever
  committed as `richText` content, the whole ADR 0034 whitelist, and the full
  XSS corpus — 179 cases — produce **byte-identical HTML** through the document
  path and the legacy renderer
  (`packages/renderer/test/markdown-migration-golden.test.ts`). Including the
  XSS corpus is deliberate: it certifies the new serialiser is exactly as
  conservative as the one whose safety the corpus already covers.
- One known, documented deviation: two adjacent non-empty constructs carrying
  the same mark (`**a****b**`) merge into one element. The flat document format
  cannot distinguish them and the rendered result is identical. Empty spans do
  _not_ merge — that case is load-bearing and tested.

### Renderer (`@sosb/renderer`)

- `renderRichTextDocToHtml` — a plain string function, not a component. The
  legacy renderer it must reproduce is a string function, mark nesting is a
  stack problem that reads badly as JSX, and the Block has always handed inner
  HTML to `dangerouslySetInnerHTML`.
- Safety by construction, as in `@sosb/markdown`: output built tag by tag,
  every text through `escapeText`, every attribute through `escapeAttr`, every
  href re-checked by `sanitizeUrl`. Structured storage does not make imported
  content trusted.
- `makeRichTextLinkResolver` resolves targets against the Site. Unresolvable
  targets — deleted Page, missing Article, Draft Article — render as unlinked
  text, keeping the author's words. Unlisted Articles are valid targets.
- Images route through the same depth-aware asset resolver every other
  image-bearing Block uses: `blob:` in preview, `../assets/…` in a build.
- Theme CSS for figures and captions, `<u>` / `<s>`, list-item paragraphs, the
  unsupported placeholder, and per-node `data-align`. The alignment selectors
  name their element on purpose: without it they score (0,3,0) against the
  Block-level defaults' (0,3,1) and silently lose.

### Editor (`@sosb/editor-app`)

- Tiptap 3.31.3 + a vendored editorcn toolbar
  (`src/vendor/editorcn/`, upstream `99232190`, MIT — the README records every
  local change). editorcn is not published to npm, so copying is the only
  option regardless of ADR 0049's instruction.
- `doc-prosemirror.ts` translates both ways, so ProseMirror's internals never
  become the file format. Round-trip fidelity is tested, including over every
  migrated-Markdown document.
- Dispatched by **schema identity** (`RichTextDocumentSchema` → `"rich-text"`),
  the same mechanism the asset pickers use. `MEDIA_PICKER_RENDERERS` is now
  `SCHEMA_FIELD_RENDERERS`, with the old name kept as an alias.
- Link dialog: an Internal tab searching Pages and Articles (case- and
  diacritic-insensitive), and an External tab validated against the schema's
  own `isAcceptableLinkUrl`. Selecting a Draft warns but is allowed.
- Image insertion reuses `<AssetPicker>` — one upload path in the codebase, so
  the archive round trip and "no re-uploads on reopen" come for free. The
  description is captured in the dialog because a document node has no sibling
  field to put it in.
- ro + en strings for all 52 new keys.

### Undo — the decision the contract asked for

Issue #100 requires two histories that do not fight. The implementation:

- **Local history is Tiptap's own.** The surface carries
  `data-rich-text-surface`; the editor's global Ctrl+Z handler returns early
  for events originating inside it, and ProseMirror's history plugin handles
  the keystroke. No custom keymap, no race.
- **Every keystroke is saved immediately, with no history entry.** A new
  `onPatchQuiet` writes straight into Site data, so preview, validation and
  export are never stale. That is the literal reading of "history grouping does
  not buffer saved content": the saving and the grouping are decoupled.
- **One Site-history entry per editing visit**, pushed on blur or on unmount —
  and switching Block, Page or Article _is_ an unmount from the field's point
  of view, which is exactly the boundary the contract names.

Rejected: debouncing snapshots on a timer. It would have made the number of
undo entries depend on typing speed, which is not a contract anyone can reason
about.

### Unsupported content — the strongest simplification of the lot

If a document contains a node or mark this version does not understand, **Tiptap
is never mounted**. The Block renders read-only with an explanation naming the
unreadable types, and the document passes through untouched; a test asserts
`onChange` is never called.

The alternative — round-tripping unknown content through a ProseMirror schema
that has no node for it — is precisely how the automatic simplification ADR
0048 forbids would happen by accident. This is coarser than "only the affected
part is read-only", and it is the version that cannot lose data.

## How rich text and Articles met

`feat/rich-text` was written on `main` before PR #117 landed and was rebased
onto it. Both branches independently added some of the same things; none of it
was a real disagreement. Recorded because the resolutions are design decisions,
not mechanical merges.

1. **`ValidationIssue.blocking` + `hasBlockingIssues`.** Both branches added
   them, deliberately identical. Kept one copy, with a doc comment that now
   enumerates all three non-overridable cases: a broken explicit Article-list
   selection (#97), unsupported rich-text content, and missing rich-text image
   bytes (#100).
2. **The Draft carve-out.** #117 extracted the per-container Block loop into
   `runBlocksDeep`; it now takes a `BlockRuleContext` and Articles pass
   `publicContent: article.state !== "draft"`. That single expression is the
   whole carve-out: a Draft is never emitted, so nothing inside it can make
   public output wrong, while an Unlisted Article _is_ emitted and therefore
   counts as public.
3. **One link resolver, one article-path rule.** `rich-text-links.ts` had
   duplicated `articlePath`'s rule while it could not import a symbol that did
   not exist yet. It now calls the shared `articlePath` and indexes Articles
   with `articlesById`.
4. **`BlockRenderContext`.** #117 introduced a context record for
   `articleList`, which turned out to be the right home for the rich-text
   asset/link context too — so both the Page shell and the Article shell build
   it once per document, and Articles got prose links for free.
5. **The dialog z-index fix, twice.** Both branches independently hit the
   backdrop-swallows-clicks bug and fixed it. #117's version keys on the
   popup's existing `aria-modal` contract rather than a new attribute, which is
   the better hook; this branch's `data-editor-dialog` was dropped.
6. **Fixtures.** The Articles fixtures' bodies were migrated by running the
   real `migrateSite` over them — which is also the proof that the migration
   walks `articles[].blocks[]` and not just `pages[].blocks[]`.

## Still open

- **Paste handling is Tiptap's default**, not issue #100's specified
  behaviour. Supported formatting survives; the contract additionally requires
  flattening tables to readable text, routing clipboard image _files_ through
  the asset pipeline, and omitting remotely hosted images with a notice. The
  custom `sosbLink` and `sosbImage` nodes both decline to parse pasted HTML, so
  nothing unsafe or unowned enters a document — pasted links and images arrive
  as plain text rather than as the wrong thing. Finishing this needs a
  `handlePaste` on the editor.
- **Input-method composition is untested.** The contract calls for it
  explicitly; jsdom cannot exercise it and it was not tried in a real browser.
- **Electron and the offline archive were not launched.** Both build, and the
  archive's size budget still passes, but neither was driven by hand with the
  rich-text editor in it.
- **No `figure` support in `@sosb/markdown`'s legacy path**, by design — images
  were never in the ADR 0034 subset, so nothing migrates into one.
