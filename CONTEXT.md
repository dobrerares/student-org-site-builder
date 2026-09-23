# Student Org Site Builder

A no-backend, offline-capable site builder targeting Romanian student
organisations. Users edit a structured **Site** in a React-based editor,
preview it live, and export a static folder of HTML/CSS/assets that can be
hosted anywhere. The editor itself ships as a single archival HTML file.

This document defines the canonical vocabulary the codebase uses across
packages. It is the glossary; architectural decisions live in
`docs/adr/`.

## Language

### The data model

**Article**:
Reusable content with its own public URL, which can be presented or linked
from multiple Blocks independently of ordinary Pages. Its main content
is an ordered collection of Blocks.
_Avoid_: post, embedded page.

**Article translation**:
A separate Article linked to its counterpart in another language, with
its own publication state.
_Avoid_: shared-state translation.

**Article tag**:
An internal, Site-wide label shared across languages, used by the author to
select Articles for automatically filtered lists in Blocks. Renaming a tag
preserves its associations; tags are not public navigation or browsing categories.
_Avoid_: public category, tag page.

**Article-list block**:
A Block presenting linked Article cards, selected either automatically
by Article tag filters ("By tag") or explicitly by the author ("Select articles").
_Avoid_: tag section, tag archive.

**Article placement**:
An explicitly chosen linked card for an Article on a Page or another Article. The card
reflects updates to the referenced Article rather than holding a separate copy.
_Avoid_: embedded article, article copy.

**Article publication state**:
An Article's status as Draft, Published, or Unlisted. Changes to this
state take effect on the live Site after redeployment.

**Article publication date**:
An author-editable date describing when an Article was published and
ordering "By tag" lists, newest first by default; it does not schedule
publication. "Select articles" lists keep the author's own order instead.
_Avoid_: release schedule.

**Draft article**:
An Article retained with its files in the editable project archive, but
excluded from the exported public Site along with files used only by Draft articles.
_Avoid_: unlisted article.

**Published article**:
An Article included in the exported public Site and eligible for automatic discovery.
_Avoid_: unlisted article.

**Unlisted article**:
An Article accessible by its public URL but excluded from automatic
discovery; an author may still explicitly place or link it.
_Avoid_: draft, private article.

**Site**:
The top-level user document. Holds organisation identity, theme choice,
declared languages, an ordered list of **Pages**, and — since Articles
landed — `articles[]` plus the site-wide **Article tag** registry `tags[]`.
Both are optional, so a Site authored before Articles existed parses
unchanged. Schema-defined, versioned, the only thing the Renderer takes as
input.
_Avoid_: project, config, document.

**Page**:
A single addressable URL within a Site. Carries its own slug, language,
nav metadata, optional SEO fields, and an ordered list of **Blocks**. A
"language version of a page" is itself a separate Page (same nav meaning,
different `lang` and `slug`), linked via `localizedAs`.
_Avoid_: route, view, screen.

**Block**:
A self-contained, schema-typed unit of page content (a hero, an FAQ, a
team grid). Each block type has one schema in `@sosb/schema`, one renderer
component in `@sosb/renderer`, and one default-data factory in
`@sosb/editor-app`. Those three are the minimum; a block that is visible to
authors also needs theme CSS and `@sosb/i18n` strings. `docs/how-to-add-a-block.md`
has the full checklist.
_Avoid_: section, component, widget.

**Custom Block** (planned):
A developer-authored Block type with its own editable fields, supplied
through an importable builder-specific package. Its content remains
editable across Theme switches.
_Avoid_: component, widget, custom section.

**Rich-text Block**:
A Block of formatted prose. Its planned toolbar-based editing experience
is shared by Pages and Articles; other Block types retain their dedicated controls.
_Avoid_: Article editor (when referring only to this Block).

**Block envelope**:
The outer shape every block shares: `{ id, type, version, data }`. The
envelope is identical for all block types; the inside (`data`) is the
per-type payload.
_Avoid_: block wrapper, block container.

**Block data**:
The per-type payload inside a block envelope. Each block type's data has
its own schema (e.g. `HeroDataSchema`, `FaqDataSchema`). When this
document says "a block's data", it means the envelope's `data` field.
_Avoid_: block content, block fields, block payload.

**Theme**:
A named visual treatment for a Site, covering its appearance and layout.
Themes own presentation, while editable content belongs to the Site and
its Blocks.
_Avoid_: skin, template, layout.

**Custom Theme**:
A developer-authored Theme that controls Site styling and page layout.
It can be imported, exported, and shared independently of Site content.
Distributed as a **Theme package**.
_Avoid_: template, skin, custom Site.

**Theme package**:
The shareable form of a Custom Theme: a `.sosb-theme.zip` archive (or an
equivalent directory) holding a `theme.json` manifest, a stylesheet,
packaged fonts and decorative assets. It has a namespaced permanent id
(`org.example.practice`) and its own semver version, separate from any
Site. Imported packages are stored **per Site** under `themes/<id>/`, so
they travel inside the editable archive and a recipient can open it
offline. A package never contains Site content. See
[ADR 0050](docs/adr/0050-theme-package-format.md).
_Avoid_: plugin, extension pack, theme file.

**Block design variant**:
A named presentation of a Block type offered by a Theme and selected by
the author, such as a spotlight hero or a split hero. Presentation only:
choosing one never changes the Block's type or its data. Emitted as
`data-variant` on the Block's root element. A Theme that does not offer
the selected variant falls back to its own default, and the selection is
remembered for switching back ([ADR 0051](docs/adr/0051-theme-package-lifecycle.md)).
_Avoid_: Block type, Template, layout mode.

**Shell variant**:
The page-shell counterpart of a Block design variant: a named treatment
of the header, navigation and footer offered by a Theme and chosen in
Theme settings ("Header style"). Emitted as `data-shell-variant` on
`<body>`. Like Block variants, it is remembered per Theme.
_Avoid_: header layout, chrome preset.

**Theme bundle**:
The resolved, ready-to-render form of a Theme inside the codebase — id,
CSS, baseline tokens, supported appearance controls, variants, fonts and
assets. Built-in Themes and imported Theme packages both reduce to one,
so the renderer has a single code path
([ADR 0052](docs/adr/0052-renderer-theme-seam.md)). An implementation
term, not something an author ever sees.
_Avoid_: theme object, compiled theme.

**Token**:
A CSS custom property exposed on `:root` (`--color-primary`,
`--font-headline`, `--space-md`, etc.). Tokens come from three layers:
the renderer's universal baseline, the active theme's defaults, and
user-set overrides in `site.theme.tokens`. Later layers win.
_Avoid_: variable, custom property (use these only when speaking about
the CSS mechanism, not the content).

**Template**:
A complete pre-built, editable Site with a chosen Theme, Pages, and sample
content; the canonical curated example is the HISTORIPOL Academic demo.
Developer-shared Templates (planned) also include their Theme and required
Custom Blocks, while the Theme remains independently reusable.
_Avoid_: starter, preset, sample.

### The editor

**Article identity**:
An Article's permanent `id`, generated once and never changed. Every
reference to an Article — explicit Article-list selections, translation
links — resolves through it, so renames and slug edits never break a
reference. Deliberately distinct from the Article's URL, which is mutable.
A new Article never reuses an id that anything still references.
_Avoid_: article key, slug (the slug is the URL, not the identity).

**Slug history**:
The retired slugs an Article has previously used, held on the Article and
reserved against other Articles in the same language for as long as it
exists. Exported as static redirect stubs once the Article is Published or
Unlisted. Permanent deletion releases them for reuse.
_Avoid_: aliases, old URLs.

**Translation group**:
The shared id linking an Article to its counterparts in other languages.
A group id rather than pairwise links, so the relationship cannot end up
half-written. Each member keeps its own publication state, and automatic
translation links offer only Published counterparts — deliberately unlike
the language-home fallback Pages use (ADR 0015 vs ADR 0047).
_Avoid_: localizedAs (that is the Page mechanism, and it is slug-based).

**Article selection**:
The configuration shared by an **Article-list block** and an Article's
Related Articles setting: mode (`byTag` / `selected`), tag ids, explicit
Article ids in author order, an optional limit, and sort. Resolved by
`resolveArticleSelection` in `@sosb/schema` — the one implementation the
Renderer, the validator, and the editor Inspector all call, so a preview
can never disagree with what exports.
_Avoid_: list config, filter.

**Blocking issue**:
A validation `error` carrying `blocking: true`, which the export
readiness panel will not let the author override — its export button is
disabled outright (ADR 0053). ADR 0016's "never hard-block"
rule still governs every other error; this is the narrow ADR 0048 carve-out
for public content that cannot be produced correctly at all — today, an
active explicit Article-list selection pointing at a Draft or deleted
Article. Saving the editable archive is never gated by it.
_Avoid_: fatal error, hard error.

**Site spine**:
Everything in the Site schema _except_ `pages[].blocks` **and `theme`**.
Org name, declared languages, page metadata, social URLs. The spine is
edited through the **SpineForm**; blocks are edited through the
**BlockForm**; the theme is edited through the **ThemeForm**. Each
carve-out is deliberate and load-bearing — block forms need an array
editor (per ADR 0005), and theme editing surfaces token pickers
(color/font/etc.) the auto-generator doesn't know how to render.
_Avoid_: site config, site settings (use "Site settings" only for the
user-facing affordance label, not as a synonym for spine).

**Shared builder UI** (`@sosb/ui`):
The one package holding the builder's shadcn-style React controls (built on
Base UI primitives) and the Tailwind-compiled **builder stylesheet**. Used
by the editor, the Wizard and the welcome interface. Builder styling is a
separate artifact from public-site **Theme** CSS and never appears in
exported output (ADR 0049).
_Avoid_: "design system" (too grand), "components package" (ambiguous with
the renderer's Theme component sets).

**SpineForm**:
The auto-generated form that walks `SiteSchema` minus the blocks
carve-out. One React component, recursive, emits `<input>` / `<select>`
per leaf field. Lives in `@sosb/editor-app`.

**BlockForm**:
The generic auto-generated form for a single block's `data`. Takes any
block-data schema and renders it the same way SpineForm renders the
spine, plus an array editor for item-collection blocks.

**ThemeForm** (planned):
The form behind the theme drill-in. Walks just the carved-out `theme`
sub-schema (theme id + tokens) and renders custom widgets for each
field. The full widget table is:

- `theme.id` → theme picker (reads theme catalog)
- `theme.tokens.colorPrimary` / `colorAccent` → native `<input type="color">`
  (hex-only by design — `hsl()` and named CSS colors are not editor-side
  pick-able, only round-trip-able if hand-edited)
- `theme.tokens.fontHeadline` / `fontBody` → curated `<select>` drawn
  from the active theme catalog entry's `fonts.headline` / `fonts.body`
  list (per-theme, not global, so each theme designer nominates the
  aesthetic-fit options)
- `theme.tokens.density` → named-value `<select>`: `compact` / `normal`
  / `comfortable`
- `theme.tokens.radius` → named-value `<select>`: `sharp` / `soft` /
  `round`

No leaf field in the ThemeForm renders as the form-generator's default
`<input type="text">` — that's the whole reason the carve-out exists.
Token overrides written by ThemeForm persist across theme switches per
the existing three-layer-win rule (renderer baseline < theme defaults
< user overrides).

**Block envelope vs block data — when each surfaces in code**:
The editor manipulates blocks through three operations on the envelope
(add, remove, reorder — all operate on `pages[].blocks`) and N operations
on the data (one patch per leaf field — operates on `pages[i].blocks[j].data.*`).
Patch paths reflect the distinction: `["pages", 0, "blocks", 2]` is an
envelope path, `["pages", 0, "blocks", 2, "data", "title"]` is a data
path.

**Destination**:
Where the builder is: one of the five main-navigation entries — Overview,
Pages, Articles, Theme, Site settings — or a **Workspace** opened from the
Pages or Articles list. A closed union in `builder-navigation.ts`, held as
shell state (no URL router) and reconciled on every render so a deleted or
imported-away target falls back to its list (ADR 0053).
_Avoid_: route, screen (a screen is what a destination renders), mode.

**Overview**:
The destination a Site opens into: a Pages summary, an Articles summary
with per-state counts, Create Page / Create Article, and **Site Health**
with actionable findings. Theme and Site settings stay in the navigation.
_Avoid_: dashboard, home (that is a Page).

**Workspace**:
The focused editing surface for one Page or one Article, reached from its
list: a back button to that list, the title, the settings row, the Block
outline and — for an Article — the publication state, language versions and
Related Articles. Editing beside the preview on larger screens, one at a
time behind an Edit / Preview switch on phones (**split view**). Pages and
Articles share one component.
_Avoid_: editor pane (that is the left half of a workspace), article editor.

**Inspector** (the workspace's drill-in panel):
The focused view opened from a workspace outline: a Block's **BlockForm**,
the content's own settings, or an Article's Related Articles. Replaces the
outline in the editing pane and carries a back button naming the content
("Back to “Acasă”"); Escape drills out one level and never leaves the
workspace. Pattern recorded in ADR 0042, carried into workspaces by
ADR 0053.
_Avoid_: detail pane, block editor pane.

**Active block**:
The single block currently selected in the **Inspector**. Distinct from
the content open in the **Workspace** and from the **preview target**.

**Preview target**:
What the preview pane is showing — a Page or an Article by index — held
separately from what is being edited. Opening a workspace points it at the
content being edited; clicks inside the preview move it the way the public
website would; **Edit this Page / Edit this Article** makes the previewed
thing the edited thing (ADR 0053).
_Avoid_: active page index (the old name for one half of this).

**Save project / Export website**:
Two distinct top-bar actions. Save project writes the editable archive,
Drafts included, and is never gated by validation. Export website opens the
**export readiness panel** — the problems that stop an export with a repair
action each, the warnings that do not, an (i) explaining that exporting does
not update the live website, and the export button. The gate is the
schema's: **blocking** issues disable export, ordinary errors keep the
typed-phrase override (ADR 0016), warnings gate nothing.
_Avoid_: download (ambiguous between the two), publish (nothing here
publishes).

**Block catalog**:
Editor-side side table (`@sosb/editor-app/src/block-catalog.ts`) mapping
schema-registered block types to user-facing metadata: category
(`mandatory` / `optional` / `advanced`), label, one-line description.
Drives the "Add block" picker. Per ADR 0019, categorisation is a UI
concern and lives in the editor, never in `@sosb/schema`. Unknown
registry entries fall back to a humanised label so a schema-only PR
cannot regress the picker.
_Avoid_: block registry (that's `KnownBlockSchemas` in `@sosb/schema`).

**Theme catalog**:
Editor-side side table (`@sosb/editor-app/src/theme-catalog.ts`, planned)
mapping renderer-registered theme ids to user-facing metadata: label,
one-line description, and the per-theme **curated font lists**
(`fonts: { headline: string[]; body: string[] }`) that the ThemeForm's
font pickers draw from. Mirrors the block catalog pattern. Drives the
**theme picker**. The `stub` theme id is deliberately omitted from the
catalog (it's a dev/test fixture, not a user-facing pick); a snapshot
carrying `theme.id: "stub"` still round-trips, but the picker does not
offer it. Catalog entries are label + description + font lists only —
deliberately no hand-written preview metadata. The pickers show a live
**theme miniature** instead: a scaled-down render of the sample site's
home page under that theme, produced by the Renderer itself, so it
cannot drift from the Theme the way hand-maintained swatches did.
An imported **Theme package** appears in the same picker, after the
built-ins, with a miniature rendered from its bundle — so a Theme the
renderer was never compiled with previews exactly like one that was.
Its manifest carries no preview metadata either, for the same reason.

**Field-override metadata** (planned):
Side table(s) in `@sosb/editor-app` augmenting the auto-generated
SpineForm and BlockForm with per-field presentation knowledge the schema
deliberately does not carry: label rewrites, help text, visibility tier
(`default` / `advanced` / `hidden`), and custom-renderer dispatch.
Path-keyed within a block type or within the spine. Same drift-resistant
fallback pattern as the block catalog — unknown paths render with the
form-generator's default. The corollary precedent (ADR 0002 §
Rationale) is established: UI-adjacent concerns layer on top of the
schema, never inside it.

**Asset picker**:
The UI affordance that replaces the auto-generated nested fieldset for
an `AssetRef` field with a single image widget: upload (hidden file
input), thumbnail when loaded, **Replace image** when a value exists,
and **Remove image** on optional slots. It does **not** embed the alt
editor — alt stays on a separate sibling field (see **Sibling alt**).
Form-generator dispatches on schema identity — when it sees
`AssetRefSchema` (or a reference-distinct AssetRef-shaped schema), it
renders the picker instead of recursing into the sub-tree. Mounted in
**BlockForm** for block data and in **SpineForm** for `org.logo`.
Writes a complete `AssetRef` via `@sosb/assets`'s `uploadAsset`. **v1
is upload-only**: no asset-library reuse panel; hash-based dedup keeps
the zip from doubling when the same file is uploaded twice. **Round-trip
invariant**: export → import shows thumbnails with zero re-uploads; a
missing byte shows the "missing asset" affordance — never hash/path text
inputs (ADR 0044). The onboarding **wizard** does not mount pickers;
image upload is editor-only.
_Avoid_: file picker, image picker, asset chooser, file input — these
all collapse onto the same widget.

**Document picker**:
The document counterpart to the asset picker — same upload-only
posture, **Replace document** when set, no asset-library panel. Used
for `DocumentAssetRef` fields (e.g. document-downloads). Not for raster
images.
_Avoid_: file picker (use **Asset picker** or **Document picker**).

**Sibling alt**:
A block- or spine-level string field that carries the user-facing
"Image description (for screen readers)" for an image slot whose bytes
live in a neighbouring `AssetRef`. Examples: `backgroundAlt` beside
hero `backgroundImage`, `authorImageAlt` beside quote `authorImage`,
`imageAlt` beside event-list `image`, `logoAlt` beside `org.logo`.
The editor shows the sibling, not `AssetRef.alt` as its own input.
**Dual-write rule**: any edit to the sibling and any upload/replace
also writes the same string to `AssetRef.alt`; clearing an optional
image clears both. Gallery/team/CTA blocks that keep alt on the ref or
on a parallel path follow the same rule for their documented paths.
_Avoid_: alt field, accessibility text (too vague).

**Theme picker** (planned):
The UI affordance that replaces the auto-generated `<input>` for the
spine `theme.id` field. Reads from the theme catalog. Dispatched via the
field-override metadata table (`{ path: "theme.id", renderer: "theme-picker" }`),
not by schema-identity — `theme.id` is a plain `z.string().min(1)` (a
deliberate looseness for forward-compat round-trip) and has no
distinctive Zod object to dispatch on.

**"More options" section** (formerly the "Show advanced" toggle):
The per-form disclosure affordance for fields whose field-override
metadata declares `tier: "advanced"`. `partitionByTier`
(`field-tiers.ts`) lifts those fields out of schema order and
`MoreOptions` (`more-options.tsx`) renders them together in a collapsible
section at the _end_ of each `SpineForm` / `BlockForm`, so opening it
reveals the fields directly beneath the button; the collapsed header
lists what is inside ("Page link name and Search engines"). An object
whose children are all advanced (e.g. `pages.[].seo`) moves into the
section wholesale rather than leaving an empty card behind. A form with
no advanced fields renders no section. **Scope is per-form** (opening
the gallery block's section does not affect the contact-card form).
**Default state is collapsed, session-scoped, never persisted** —
reopening a form starts collapsed every time. The wizard does not render
the section and hard-suppresses all advanced fields. Rationale: the
editor's audience is yearly-rotating student-org leadership (per
README), not a returning power user; persistence here would serve an
audience that isn't the project's audience.

### The pipeline

**Renderer**:
The package `@sosb/renderer`. Pure function: `(siteData, themeId) -> HTML`.
Same module runs in Node (build pipeline) and in the browser (editor
preview), produces byte-identical output in both.
_Avoid_: builder, generator (those names are taken by the **Build** and
**Editor** packages respectively).

**Preview iframe** vs **built site**:
The **preview iframe** is the editor's live-rendering target. The **built
site** is the static folder produced by `@sosb/build` for deployment.
ADR 0005 made them byte-identical via shared use of the **Renderer**;
they are otherwise distinct concerns. UX decisions about the preview
iframe (e.g. how it updates) do not change the built site.

**Preview bridge**:
The postMessage envelope protocol between the editor host and the
preview iframe. Channel-namespaced and version-gated. Both halves are
built. The host renders each snapshot with the Renderer and posts the
HTML as a `previewHtml` envelope; the iframe-side **preview morph
script** (emitted by the Renderer in preview mode only) applies it to
the live document with an idempotent DOM diff, so the preview's scroll
position, open FAQ answers and open lightbox survive an edit. The host
also still posts `siteData` envelopes — that remains the documented
extension point for iframe-side consumers that want the data rather
than the markup, though nothing renders from it (rendering stays
host-side, so there is exactly one Renderer code path).
A full `srcdoc` reload is used, deliberately, when the previewed page,
theme or language changes: those are different documents, and carrying
state across them would be wrong.
An interactive preview mode (ADR 0046) is still future work. Links
inside the preview navigate it the way the public website would (ADR
0053), but Blocks are not selected or edited by clicking them — editing
goes through the forms.

**Spine patch** vs **block patch**:
A field edit in the SpineForm produces a "spine patch" with a path
rooted at the Site (`["org", "name"]`). A field edit in the BlockForm
produces a "block patch" with a path rooted at a specific block's data
(`["title"]`). The editor app composes block patches into the Site by
prefixing them with `["pages", i, "blocks", j, "data"]`.

**Snapshot**:
A Site object held in `@sosb/editor-state`. Every `state.update(fn)`
deep-clones the previous snapshot, mutates the clone, and notifies
subscribers. Snapshot identity changes on every update — the live
preview update SLA (200ms) is a property of the subscriber path, not of
the state model.

**Validation**:
Schema-level checks plus quality nudges (missing alt text, low contrast,
broken internal links). Returns a tiered list of `errors`, `warnings`,
`info`. Surfaced through the Overview's **Site Health** card and the
**export readiness panel** (ADR 0053). The earlier health footer, side
panel and pre-export dialog remain exported components for hosts that
compose their own chrome; the shell no longer mounts them.

## Relationships

- A **Site** has one **Theme**, one or more **Pages**, and zero or more
  **Articles** plus a shared **Article tag** registry
- A **Page** has zero or more **Blocks** in an explicit order
- An **Article** has zero or more **Blocks** in an explicit order, the same
  envelope Pages use, plus its own title, date, summary, cover, tags, and
  publication state as automatic fields rather than Blocks
- A **Block** has exactly one **Block envelope** wrapping one **Block data**
  payload typed by `KnownBlockSchemas[type]`
- A **Theme** contributes **Tokens** to `:root`; user overrides in
  `site.theme.tokens` win against theme defaults
- A **Template** is a complete **Site** seed; choosing a template means
  loading its Site as the editor's initial snapshot

## Example dialogue

> **Maintainer:** "When the user adds an FAQ block from the dialog, what
> goes into `data`?"
>
> **Contributor:** "Whatever `defaultBlockFor("faq")` returns. Per ADR 0008
> that's `BLOCK_METADATA`'s sibling table — `DEFAULT_BUILDERS`. Each entry
> is one block's starter data."
>
> **Maintainer:** "And then how does the user edit it? They can't reach the
> data through the SpineForm — that's the spine carve-out."
>
> **Contributor:** "Through the Inspector. Clicking the block row in the
> BlockListEditor drills in, mounts a BlockForm with the block-data
> schema, and patches the snapshot at the block-data path. The spine
> form stays out of it entirely — different patch shape, different
> concern."

## Flagged ambiguities

- **"Block"** is sometimes used loosely for the envelope and sometimes
  for the data inside. Resolved: prefer the explicit terms **block envelope**
  and **block data** when the distinction matters; reserve "block" for
  general talk where the layer is unambiguous.
- **"Site settings"** has been used as a synonym for the **site spine**.
  Resolved: "Site settings" is only the user-facing label for the
  affordance that drills the user into editing spine fields; in code and
  prose, use **site spine**.
- **"Page"** can mean a page within a Site or a _language version_ of a
  page. Resolved: a "language version" is itself a separate Page; the
  link is the `localizedAs` field. There is no nested per-language
  structure inside a single Page.
- **"Default"** is overloaded between "the active theme's default tokens"
  and "the seed Site loaded on first launch". Resolved: prefer **theme
  defaults** for the former and **seed** or **template** for the latter.
- **"Alt text"** has two homes in the schema (`AssetRef.alt` and
  block-level alt fields). Resolved: the **Sibling alt** is the
  canonical user-facing surface; `AssetRef.alt` is kept in sync via the
  **dual-write rule** and is what export/JSON-LD/readers use on the ref.
  Blocks that expose only nested alt (e.g. gallery `images[].alt`,
  CTA `backgroundImage.alt`) use the same dual-write pattern for that
  path. UI label: "Image description (for screen readers)", not "alt".
- **String image paths** (`hero.backgroundImage` as `z.string()`, etc.)
  were a pre-AssetRef shortcut. Resolved: every image slot in scope —
  blocks and `org.logo` — is an `AssetRef`; in-repo fixtures are updated
  in the same change. No `migrateSite` / `migrateBlock` steps; block
  envelope `version` stays at 1.
