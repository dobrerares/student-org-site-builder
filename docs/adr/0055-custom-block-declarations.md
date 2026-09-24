# 0055 — Custom Block declarations, the registry, and author-controlled updates

- **Status:** Accepted
- **Date:** 2026-09-24
- **Issues:** [#106](https://github.com/dobrerares/student-org-site-builder/issues/106) (Custom Block fields and editor behaviour); builds on [#104](https://github.com/dobrerares/student-org-site-builder/issues/104)–[#109](https://github.com/dobrerares/student-org-site-builder/issues/109)
- **Plan:** [docs/plans/issue-106-custom-block-contract.md](../plans/issue-106-custom-block-contract.md) — every "Agreed" section there is a requirement of this ADR

## Context

[ADR 0046](0046-trusted-executable-theme-and-block-extensions.md) drew the
line: "Custom Blocks declare their editable fields; the builder provides the
editing forms, including supported asset pickers and list controls.
Extensions do not supply executable custom editing interfaces."
[ADR 0054](0054-executable-theme-rendering-and-sandbox.md) built the
rendering half — a Theme's `render.js` designs a Custom Block type through
the same `blocks[type]` map it uses to override a built-in — and left the
field contract, the editor form, validation and the extension lifecycle to
the issue-106 plan.

That plan is agreed in detail: a starting vocabulary of field kinds, groups
and lists that nest, links stored by identity, standard image controls,
empty new list entries, per-language Block data, translated editing labels,
warning-only content rules, a permanent namespaced type id, the existing
`{ id, type, version, data }` envelope with a data version separate from the
package version, packages that travel with the archive, unsupported field
kinds refused at import, missing or too-new packages that preserve content
and block export, and updates that adapt saved data only after the author
has seen what would be removed.

What was still open was the concrete shape: where a declaration lives and
how it is parsed, what a link field stores, how the editor derives the set of
available types, how "unavailable" is told apart from "omitted", and what the
minimal honest version of an author-controlled update is.

## Decision

### A Custom Block is declared in a `block.json` inside a Theme package

A Theme package lists its declarations in the manifest —
`"blocks": ["blocks/partners/block.json"]` — and each file declares one
type:

```json
{
  "formatVersion": 1,
  "type": "org.example/partners",
  "version": 1,
  "label": { "default": "Partners", "ro": "Parteneri" },
  "fields": [
    { "name": "heading", "kind": "text", "label": "Heading", "required": true, "maxLength": 80 },
    { "name": "groups", "kind": "list", "label": "Groups", "itemLabel": "group",
      "item": { "kind": "group", "fields": [ … ] } }
  ]
}
```

`type` is permanent and keys saved data; it carries a namespace and a slash
(`campus-tools/partners`), which makes a Custom Block type recognisable on
sight and impossible to confuse with a built-in type (`partnerLogos`) or a
Theme package id (`org.example.practice`). `label`, `description` and every
field's `label` and `help` are editing copy with translations (`default`
plus one entry per editor locale, falling back to `default`); they never
reach the published Site. `version` is the Block _data_ format and lands in
every envelope of the type; the package's semver is separate, so a visual
fix never rewrites content.

The field vocabulary is exactly the agreed one: `text`, `richText`,
`number`, `boolean`, `choice`, `link`, `image`, `document`, `group`, `list`.
Only `boolean` and `choice` may carry a `default`. The validation rules are
`required`, `maxLength`, `min`/`max` and `minItems`/`maxItems`. A list's
entry is always a group; a list of bare values is deferred (a group with one
field expresses it without a second storage shape). Groups and lists nest to
five levels and a type declares at most a hundred fields.

Two shapes are **shared with the rest of the builder rather than invented**:

- A `link` field stores a **Link target** exactly as prose links do
  (ADR 0048): `{ kind: "page", pageId }`, `{ kind: "article", articleId }`
  or `{ kind: "external", href }`. One identity model means a Page rename
  cannot break a Custom Block link any more than it can break a paragraph's,
  and the editor's link picker, the schema's resolver and the renderer's
  routing are reused, not duplicated. The plan's sketch of
  `{ kind: "url", url }` is superseded by this.
- A `richText` field stores a Rich-text document (ADR 0048), the same shape
  the Rich-text Block edits with the same editor.

An `image` is the canonical `AssetRef` with its `alt` as the description; a
`document` is a `DocumentAssetRef`.

The schema for all of this lives in `@sosb/schema` (`custom-blocks/`),
because `validate()` has to check saved data against declarations and that
package sits below everything else. `@sosb/theme-package` parses each listed
file at import time — before the design is compiled, so a refused package
leaves no sandbox realm behind — and a declaration this builder cannot honour
refuses the whole package: `block-invalid` for an unsupported field kind
(the message names the file, the field and the supported kinds), bad JSON or
a type declared twice; `block-format-unsupported` for a newer declaration
format. Import stays all-or-nothing (ADR 0051), so the previously installed
version keeps working — the plan's "unsupported field definitions".

### The registry: what a Site can use is what its packages declare

A `CustomBlockRegistry` is built from the Site's installed packages — the
bundles that loaded, plus the packages under `themes/` that would _not_ load,
with the type ids read leniently from their `block.json` files. It answers,
for any namespaced type:

- **available**, with the declaration and the providing package; or
- **unavailable**, for one of four reasons: `package-missing` (no package
  declares it), `needs-newer-builder` (a package declares it but needs a
  newer builder), `package-damaged` (a package declares it but would not
  load), or `data-newer` (the saved envelope's `version` is greater than the
  installed declaration's — the plan's "cannot read the saved Block data
  version", resolved here: the Block is kept, not editable, not exportable,
  until the newer package is imported; data _older_ than the declaration
  stays editable, with a warning, because the update flow adapts it).

The editor derives one registry and hands it to validation, the Add Block
dialog, the Block Inspector, the outline and the export readiness panel, so
the five cannot disagree about which types exist. When two loaded packages
declare the same type, the smaller package id wins, deterministically.

### Validation: content rules warn, unavailability blocks

`validate(site, { customBlocks })` checks every namespaced Block:

- an **unavailable** type is a `blocking` error at the Block
  (`block.custom.unavailable.<reason>`), with the path ending in `data` so
  the readiness panel's "Fix" opens the Inspector where the reason is
  explained; the content is untouched and the export stops — the plan's
  "missing required extension" and "extension requires a newer builder";
- an **available** type's data is checked against its declaration with
  **warnings only** — required fields empty, text over `maxLength`, numbers
  out of range, lists outside `minItems`/`maxItems`, a choice value the
  options no longer contain, a value of the wrong shape (kept as saved, shown
  empty), a link to a deleted Page or Article or to a Draft, an image without
  a description. Nothing is truncated or removed; the author acknowledges and
  exports. A Rich-text field reuses the Rich-text rules, so unsupported
  content inside one is the same blocking error it is in a Rich-text Block,
  and an image or document whose bytes are missing from the project is a
  blocking error for the same reason ADR 0048 gives — publishing would
  silently drop the author's work. These two are damaged-archive findings,
  not content rules.

Without a registry — `validate(site)` from the zip importer or the build —
a Custom Block is envelope-only, like any unknown type. `build()` separately
refuses a Page or public Article holding a Custom Block no supplied package
declares (`BuildCustomBlockMissingError`), the loud sibling of
`BuildThemeMissingError`.

### Unavailable is not omitted

Two states look alike from the preview and are kept apart on purpose:

|         | Unavailable (this ADR)                                                   | Omitted (ADR 0045)                                   |
| ------- | ------------------------------------------------------------------------ | ---------------------------------------------------- |
| Cause   | No usable _declaration_: package missing, damaged, too new; data too new | A declared type the active _Theme_ has no design for |
| Editing | Not editable; notice in the Inspector; badge in the outline              | Editable as normal                                   |
| Export  | Blocked; listed among the blockers                                       | Allowed after a checkbox acknowledgement             |
| Fix     | Import or update the package / builder                                   | Switch Theme, or accept                              |

The readiness panel lists an unavailable Block once, among the blockers,
never also in the omission list. Rendering is unchanged: a designed Custom
Block renders through ADR 0054's seam, an undesigned one is omitted with the
pre-existing marker, and a design that throws still stops the export.

### The editor generates the form; nothing else does

The Inspector turns a declaration into a Zod schema and a list of path-keyed
overrides and hands both to the existing `BlockForm` — the form a built-in
Block gets. Every control is one the builder already had: text boxes, the
Rich-text editor, number inputs, switches, selects (with the declaration's
translated option labels), the Asset picker, the Document picker, nested
fieldsets, and the list controls with add, remove and reorder. Two renderer
arms are new and are the builder's own: `image-with-description` (the Asset
picker plus the screen-reader description, written onto the `AssetRef`'s
`alt`) and `link-target` (one select: no link, a web address, then this
language's Pages and Articles; a deleted Page shows as _missing_ and can be
replaced or removed, a Draft is marked, choosing a Page stamps its permanent
id first through the same `resolveTarget` the rich-text link dialog uses).
New list entries are empty apart from the entry's own switch and choice
defaults; the add button is named after the declared entry ("Add partner").
Validation findings are shown beside the field they name and in the
readiness panel, from the same message.

An unavailable Block shows a notice with the reason and no form. There is no
raw-data or JSON editing anywhere (ADR 0044). The Add Block dialog lists
available types under their labels in a "From your Theme packages" group;
new Blocks start at the declaration's version with only the declared switch
and choice defaults.

### Author-controlled updates: adapt, show, keep a copy

Re-importing an installed package id (ADR 0051) now runs through
`adaptSiteToDeclarations`, which computes, per Block of an affected type:
fields that remain with the same kind keep their content; new fields start
empty (or at their switch/choice default, only when the update _introduces_
them); a field that is gone, or whose kind changed, takes its content with
it — and every such value is **listed** with its old label, a preview and the
Page or Article it sits in, in the editor's language. The rules are driven by
the two declarations, never by the shape of a value: a key the outgoing
declaration did not name is kept as it is, whatever it holds, and validation
reports a shape the field cannot show. Keys neither declaration knows are
preserved (ADR 0002). Every adapted envelope is stamped with the new data
version; the same content in a different key order is not a change.

A type's **first** import into a Site that already holds Blocks of it (an
archive whose package was lost) has no outgoing declaration and no outgoing
package to keep a copy of, so it removes nothing and asks nothing: the data
is kept exactly, a data version below the declaration's is moved up to it,
and a Block saved by a newer package than the one imported is left untouched
and stays unavailable (`data-newer`) until that package arrives.

If the list is non-empty the editor shows it and asks: _keep the current
version_ (nothing at all is written) or _update and remove this content_.
An update that removes nothing — an appearance-only release, a version that
only adds fields — never asks and writes nothing to Blocks it does not
change. Before an update that changes any Block — data or version — is
applied, the outgoing package's installed files and the affected envelopes
are kept under `themes-recovery/<id>/` in the Site's VFS, which travels in
the editable archive like `themes/`; if that copy cannot be made the update
does not happen. The Theme packages panel offers _Restore previous version
(x.y.z)_: it re-validates the copy by loading it, reinstalls it, puts the
saved envelopes back where a Block with the same id still exists, and
discards the copy. One copy per package id; the next update that changes a
Block replaces it, and an update that changes none leaves it alone, so an
appearance-only release cannot overwrite the copy the author may still want
back. A failed import changes nothing, as before.

### Saving is never refused; exporting the website is

`build()` refuses a Custom Block no supplied package honours (above) and a
missing Theme (ADR 0051), and the same `exportToZip` writes both the
editable archive and the public `dist/` inside it. The two callers now say
which they are: _Export website_ requires the public Site and is refused
loudly, as before; _Save project_ in a shell without its own persistence
passes `publicSite: "when-buildable"` and gets the complete editable archive
— Site, assets, packages, recovery copies — without `dist/` and `DEPLOY.md`
when one of those two refusals occurs. Any other build failure still rejects.
This is the plan's "the Site can still be opened and saved" made true in the
archival single-file editor, whose only way to keep work is that download.

The rest of the lifecycle is unchanged: packages travel with the editable
archive (`themes/`), a same-id import replaces, removal is blocked while in
use.

## Rationale

**Why declarations inside Theme packages rather than a separate extension
format?** The distribution, storage, archive and lifecycle seams already
exist for Theme packages (ADR 0050, ADR 0051) and every one of them applies
unchanged. A package may declare Blocks and design none, design Blocks it
does not declare, or both; the Theme stays independently reusable because a
declaration gives a type its _fields_ and the design is looked up per
Theme. A package that only declares is still a package.

**Why is the schema in `@sosb/schema`?** Because validation over
declarations has to live where `validate()` lives, and the dependency
direction is fixed. The loader parses; the schema owns the shape.

**Why share the Link target and the Rich-text document?** The plan required
links stored by identity and rich text in the agreed document shape. The
builder already had both, with an editor, a resolver, a validator and a
renderer each. A second link shape would have meant a second link picker and
a second "Page missing" rule, free to drift.

**Why only warnings for content rules?** The plan says so, and the reason is
the audience: a student volunteer saving unfinished work must never be told
the file cannot be kept. The two blocking findings are the ones where the
archive is damaged, and those already block for the Rich-text Block.

**Why is "unavailable" a blocking error and not an omission?** An omission is
a choice the author can understand — this Theme does not show that Block. A
missing declaration is not a choice; the author cannot even open the form to
know what would be lost. The plan separates the two explicitly.

**Why generate the form through `BlockForm` rather than a dedicated
component?** So that a Custom Block's form is provably made of the same
controls as a built-in's — same pickers, same list controls, same hints —
and inherits every improvement to them. The declaration chooses; it does
not render.

**Why one recovery copy per package rather than a history?** The plan asks
that the previous extension and data remain usable and that an update never
silently replaces the archived extension. One copy that survives the archive
delivers that; a history of every version would grow every archive for a
benefit nobody asked for.

## Consequences

- `ThemeBundle` gains `customBlocks`; `ThemeManifest` gains `blocks`;
  `ThemePackageErrorCode` gains `block-invalid` and
  `block-format-unsupported`; `ValidateOptions` gains `customBlocks`;
  `BuildOptions` is unchanged but `build()` can throw
  `BuildCustomBlockMissingError`.
- A design gets `input.linkUrl()`; `pageUrl()` accepts a permanent Page id;
  `richText()` renders a structured document with the page's link and asset
  resolution.
- The zip layer mirrors `themes-recovery/` alongside `themes/`; the editor's
  in-shell import does too. Archives grow by the size of one previous package
  version after an update, until the copy is restored or replaced.
- `exportToZip` gains `ExportToZipOptions.publicSite`; the default keeps
  today's behaviour. `BuildCustomBlockMissingError` carries a `reason`
  (`package-missing` or `data-newer`), because a Block saved by a newer
  package is refused by the build exactly as the editor marks it unavailable.
- `ValidationIssue.blocking` has two more cases; the comment on it lists
  them.
- Namespaced type ids (with a slash) are Custom Blocks; a non-namespaced
  unknown type keeps the forward-compatible unknown-block path.
- The example Theme is at 1.2.0 with a Partners Custom Block declared,
  designed in two variants, pinned by golden files and pictured in its
  screenshots.

## Deferred

- Lists of bare values (a list of images with nothing beside them). Wrap the
  value in a group.
- Multiple recovery points per package, and recovering a Block deleted after
  the update.
- Adapting data across a _type_ rename (a new type id is a new type).
- Discarding a recovery copy without restoring it, from the UI. It is
  replaced by the next update.
- A default design shipped by a declaring package for its own type when the
  active Theme has none (the "resolution order" question in the plan). Today
  the active Theme's design is the only one consulted; an undesigned type is
  omitted.
- Per-field help rendered for group and list _entries_ (the entry label is
  used for the add button only).

## Alternatives considered

- **A dedicated extension package format** separate from Themes. Rejected:
  every seam would be duplicated for no gain in this contract.
- **A distinct link shape `{ kind: "url", url }`.** Rejected in favour of the
  existing Link target; see the rationale.
- **Making required fields and list sizes errors.** Rejected by the plan.
- **Treating a missing package as an omission the author can acknowledge.**
  Rejected by the plan; an author cannot acknowledge a form they cannot open.
- **Applying an update silently when only additions occur but keeping every
  update behind a dialog.** Rejected: the dialog exists to show removed
  content, and a dialog with nothing in it teaches authors to click through.
- **A versioned recovery history.** Deferred; see the rationale.
