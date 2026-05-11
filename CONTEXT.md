# Student Org Site Builder

A no-backend, offline-capable site builder targeting Romanian student
organisations. Users edit a structured **Site** in a Preact-based editor,
preview it live, and export a static folder of HTML/CSS/assets that can be
hosted anywhere. The editor itself ships as a single archival HTML file.

This document defines the canonical vocabulary the codebase uses across
packages. It is the glossary; architectural decisions live in
`docs/adr/`.

## Language

### The data model

**Site**:
The top-level user document. Holds organisation identity, theme choice,
declared languages, and an ordered list of **Pages**. Schema-defined,
versioned, the only thing the Renderer takes as input.
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
`@sosb/editor-app`. New block types land by adding all three.
_Avoid_: section, component, widget.

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
A registered visual treatment identified by a string id (`stub`, `minimal`,
`modern`, `editorial`, `civic`, `academic`). A theme contributes a CSS
string and a token table; the renderer composes both into the final
output. Themes never own user content — only the visual treatment.
_Avoid_: skin, template, layout.

**Token**:
A CSS custom property exposed on `:root` (`--color-primary`,
`--font-headline`, `--space-md`, etc.). Tokens come from three layers:
the renderer's universal baseline, the active theme's defaults, and
user-set overrides in `site.theme.tokens`. Later layers win.
_Avoid_: variable, custom property (use these only when speaking about
the CSS mechanism, not the content).

**Template** (curated):
A complete pre-built Site shipped from `@sosb/themes/templates/` that
acts as a real-content seed for new editor sessions. The canonical one is
the HISTORIPOL Academic demo. Templates are *not* themes — a template
chooses one theme and wires content into it.
_Avoid_: starter, preset, sample.

### The editor

**Site spine**:
Everything in the Site schema *except* `pages[].blocks` **and `theme`**.
Org name, declared languages, page metadata, social URLs. The spine is
edited through the **SpineForm**; blocks are edited through the
**BlockForm**; the theme is edited through the **ThemeForm**. Each
carve-out is deliberate and load-bearing — block forms need an array
editor (per ADR 0005), and theme editing surfaces token pickers
(color/font/etc.) the auto-generator doesn't know how to render.
_Avoid_: site config, site settings (use "Site settings" only for the
user-facing affordance label, not as a synonym for spine).

**SpineForm**:
The auto-generated form that walks `SiteSchema` minus the blocks
carve-out. One Preact component, recursive, emits `<input>` / `<select>`
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

**Inspector** (the editor's drill-in panel):
The drilled-in view shown when the user clicks a block row in the
**BlockListEditor**. Replaces the un-drilled editor pane body with the
**BlockForm** for the active block. The user "drills in" to a block,
edits, then "drills out" via a back affordance. Pattern recorded in
ADR 0042.
_Avoid_: detail pane, block editor pane.

**Active block**:
The single block currently selected in the **Inspector**. Distinct from
the **active page** (selected in **PagesList**) and the **active page
index** (the snapshot field that drives the preview).

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
offer it. Screenshots deferred past v1 — catalog entries are
label + description + font lists only.

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

**Asset picker** (planned):
The UI affordance that replaces the auto-generated nested fieldset for
an `AssetRef` (or `DocumentRef`) field with a single picker widget
(upload + thumbnail + an alt input). Form-generator dispatches on
schema identity — when it sees `AssetRefSchema` / `DocumentRefSchema`,
it renders the picker instead of recursing into the sub-tree. The
picker writes a complete `AssetRef` back into the snapshot using
`@sosb/assets`' existing `uploadAsset` / `uploadDocument`. The
auto-generated text inputs for `hash`, `mime`, `path`, `metadataPath`,
`width`, `height`, `byteSize` go away entirely. **v1 is upload-only**:
no asset-library reuse panel; the asset pipeline's hash-based dedup
keeps the zip from doubling in size if the same file is uploaded
twice. **Round-trip invariant**: exporting a site and re-importing it
requires **zero re-uploads** — on import, the picker reads referenced
`AssetRef`s from the VFS (assets travel with the zip per ADR 0003) and
shows thumbnails directly. If an asset is missing from the imported
zip, the empty state is a "missing asset" affordance — never a raw
hash text input as a fallback.
_Avoid_: file picker, image picker, asset chooser, file input — these
all collapse onto the same widget.

**Theme picker** (planned):
The UI affordance that replaces the auto-generated `<input>` for the
spine `theme.id` field. Reads from the theme catalog. Dispatched via the
field-override metadata table (`{ path: "theme.id", renderer: "theme-picker" }`),
not by schema-identity — `theme.id` is a plain `z.string().min(1)` (a
deliberate looseness for forward-compat round-trip) and has no
distinctive Zod object to dispatch on.

**"Show advanced" toggle** (planned):
The per-form disclosure affordance that reveals fields whose
field-override metadata declares `tier: "advanced"`. Rendered once per
`SpineForm` / `BlockForm` instance. **Scope is per-form** (toggling the
hero block's advanced view does not affect the contact-card form).
**Default state is hidden, session-scoped, never persisted** — reopening
a form starts hidden every time. The wizard does not render the toggle
and hard-suppresses all advanced fields. Rationale: the editor's audience
is yearly-rotating student-org leadership (per README), not a returning
power user; persistence here would serve an audience that isn't the
project's audience.

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
preview iframe. Channel-namespaced and version-gated. v1 is half-built:
the host posts `siteData` envelopes, but the iframe currently has no JS
listener (the iframe is static HTML rebuilt via `srcdoc` reassignment on
every snapshot change). The receiver-side script lands when the
iframe-reload work is picked up.

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
`info`. Surfaced through the **Site Health** footer + panel and the
pre-export confirm dialog.

## Relationships

- A **Site** has one **Theme** and one or more **Pages**
- A **Page** has zero or more **Blocks** in an explicit order
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
- **"Page"** can mean a page within a Site or a *language version* of a
  page. Resolved: a "language version" is itself a separate Page; the
  link is the `localizedAs` field. There is no nested per-language
  structure inside a single Page.
- **"Default"** is overloaded between "the active theme's default tokens"
  and "the seed Site loaded on first launch". Resolved: prefer **theme
  defaults** for the former and **seed** or **template** for the latter.
- **"Alt text"** has two homes in the schema (`AssetRef.alt` and
  block-level alt fields like `GalleryImage.alt`, `Hero.backgroundAlt`,
  `Quote.authorImageAlt`, `TeamPerson.photo.alt`). Resolved: the
  **block-level alt is the canonical user-facing surface**; `AssetRef.alt`
  is populated from the block-level alt on upload and is never shown in
  the editor as an independent input. The schema continues to model both
  fields (forward-compat: other consumers — a future API, scripts —
  retain their freedom), but the editor's UI commits to a single
  contextual alt per usage site. Labelled in the UI as "Image description
  (for screen readers)", not "alt".
