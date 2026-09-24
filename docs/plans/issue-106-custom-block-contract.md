# Custom Block fields and editor behavior

Contract discussion for issue #106. This document records agreed decisions
as the interview proceeds. The full contract is not yet confirmed; no
implementation is requested.

## Agreed: builder-provided editing controls

Developers declare Custom Block fields using supported field types and
combine them into groups and lists. The builder creates the editing form,
consistent with ADR 0046. Authors use familiar controls rather than an
extension-provided editing interface.

The agreed example is a Partners Custom Block with a heading and a list
of partners. Each partner has a name, image, and link. The builder provides
a heading text box, controls to add or remove partners, and an Asset picker
for each image.

## Agreed: required extensions travel with the archive

Every editable Site archive must include its required Custom Block
extensions. A recipient must be able to open the archive offline without
finding and installing those packages separately. This requirement covers
editable archives; it does not decide how extension code is packaged for
the exported public Site.

Missing packages are therefore an incomplete or damaged archive case,
not the expected handover flow. Compatibility and missing-extension
behavior are recorded below.

## Agreed: empty list entries and unfinished work

New list entries start with empty content rather than example content.
For the Partners Block, Add partner presents an empty name, image, and
link with clear labels. The developer declares which fields are required.
Authors can save unfinished work. Before public export, the builder flags
required fields that remain empty. Authors may proceed with public export
after accepting the warning. Theme designs must handle empty fields without
crashing. This permission applies to missing required content, not to
rendering failures, which still stop export under ADR 0045.

## Agreed: standard image controls

Custom Block image fields use the standard Asset picker. Authors can upload
or replace an image and enter its description for screen readers. Images
are included in the editable archive, so a recipient does not need to
upload them again. This applies to images inside list entries as well.

## Agreed: independent content per language Page

Custom Blocks follow the existing Page language model. Each language Page
has its own Block data. Authors can translate text and choose different
images or links. Editing a Block on the Romanian Page does not change
the corresponding content on the English Page. This does not introduce
per-field language maps or automatic synchronization between Blocks.

## Agreed: starting field vocabulary

Developers can declare short text, rich text, numbers, yes/no switches,
choices, links, images, downloadable documents, groups of fields, and
repeatable lists. Groups and lists can contain other groups and lists.
For example, a Partners Custom Block can contain groups with a heading
and a separate partner list in each group.

## Agreed: external and Page links

Custom Block link controls let authors enter an external web address or
select a Page in the same Site. A link to a selected Page retains that
Page's identity when its address changes, rather than storing only the
address as text. If the target Page is deleted, the editor keeps the link
marked as "Page missing" and lets the author select another Page or remove
the link. Public export warns the author. If the author proceeds, the
linked text or image appears without a clickable link.

## Agreed: author-controlled extension updates

The Site keeps using the Custom Block extension version included in its
editable archive until the author chooses to update it. Before an update
changes Block data, the builder keeps a recoverable copy of the working
extension and data. If the update fails, the old version and data remain
usable. Updates must not silently replace the archived extension.

An appearance-only update preserves saved content. When fields change,
the update must adapt saved Block data while preserving existing content
where its fields remain; adding a partner description must not lose names,
images, or links. Before applying an update that removes fields containing
content, the builder shows the content that would be removed and lets the
author cancel. The recoverable copy remains available if the author
proceeds. A failed update leaves the old extension and data usable.

## Agreed: extension requires a newer builder

If an archived Custom Block extension requires a newer builder, the Site
can still be opened and saved with its Block data and files preserved.
The affected Block is marked unavailable and its content cannot be edited.
Public export stops until the builder is updated to a compatible version.
This is distinct from a working Custom Block with no design in the active
Theme, which follows ADR 0045's omission acknowledgement rule.

## Agreed: missing required extension

If a required Custom Block extension is missing from an incomplete or
damaged archive, the Site can still be opened and saved without losing
its Block data or files. The affected Block is marked unavailable and
public export stops until the extension is restored. Missing extensions
do not use the acknowledgement flow for missing Theme designs.

## Agreed: permanent Custom Block type identity

Each Custom Block type has a permanent identifier containing its developer's
namespace, such as `campus-tools/partners`. Authors see a friendly name such
as "Partners". Renaming that label does not change the type identity or
which Block type owns saved data. This type identity is separate from the
identity of an individual Block instance.

## Agreed: existing Block envelope and separate versions

Custom Blocks retain the existing `{ id, type, version, data }` Block
envelope. The builder manages instance identity; `type` identifies the
Custom Block type, and `version` identifies its Block data format. The
extension package has a separate version, so a visual fix need not change
the data format or rewrite the author's content. These technical details
are not author-editable fields.

## Agreed: defaults for new Custom Blocks

New Custom Blocks start with empty text, images, and lists. Developers may
provide useful starting values for choices and switches, such as
"Show heading: Yes". Templates may contain sample content. These defaults
describe new Blocks; they do not authorize overwriting saved content.

## Agreed: translated editing labels

Developers supply clear field labels and may supply help text. Editing
labels and help text can have translations, including Romanian and English.
When a label translation is missing, the builder uses the extension's
default label. Editing-label translations are separate from the author's
Block data and do not translate or change that content.

## Agreed: supported validation rules

Developers declare validation using supported rules, including required
fields, maximum text lengths, number ranges, and list sizes. They do not
supply executable validation code in this first contract. The builder
explains problems beside the affected fields. Authors can save unfinished
work and review problems before public export. All supported content
validation rules use warning-and-acknowledgement behavior: authors may
export after accepting the reported problems. The builder preserves
content rather than silently truncating text or removing list entries.
Theme designs must handle values that fail these content rules without
crashing. Rendering failures and unavailable required extensions still
stop public export under the separate agreed rules.

## Agreed: Block fields belong to the Custom Block

The Custom Block defines its fields. Theme designs read those fields to
display the Block. Switching Themes must not remove fields or change saved
Block data. For example, a grid design and a row design use the same saved
partner names, images, and links. Existing rules for missing Theme designs
remain governed by ADR 0045.

## Agreed: unsupported field definitions

The builder rejects an extension version that declares unsupported fields
and explains the problem to the developer. It must not show authors a
broken form or raw-data editing controls. An existing working extension
stays in place.

## Representative examples

These examples illustrate the agreed behavior, not a final SDK syntax.

### Image and text

A developer declares a heading (short text), body (rich text), image,
and link. The builder creates the corresponding editing controls. New
content starts empty. An image uses the standard Asset picker and its
description control. The link can target an external website or a Page.
A Theme reads this Block data and can place the image beside the text.
Another Theme can place it above the text without changing the data.

### Partner groups

The type `campus-tools/partners` has a friendly label "Partners", a heading,
and a list of groups. Each group contains a heading and a list of partners;
each partner contains a name, image, and link. New lists start empty and
new partner entries contain empty content. Developers declare required
fields and can declare list-size rules. A list with six partners against
a limit of five retains all six entries. The author can acknowledge the
validation problem and export; the Theme must handle the extra entry.

### Archive handover and recovery

An editable archive includes the Partners extension, saved Block envelopes
and data, and images. The recipient can use a compatible builder offline
without installing the extension separately or uploading images again.
If the extension requires a newer builder, the recipient can open and save
the archive, but cannot edit the affected Block or export publicly until
the builder is updated. A missing required extension has the same
preservation and export restrictions until it is restored.

## Where Custom Block rendering plugs in (ADR 0054)

Rendering is already decided and built, ahead of the field contract above.
A Theme package's `render.js` exports `blocks: { [type]: (input) => tree }`
(ADR 0054). A Custom Block type such as `campus-tools/partners` is rendered by
the active Theme's design for that key, through exactly the mechanism a Theme
uses to override a built-in Block — there is no second path. The design
receives the Block envelope with its `data` as saved (the declared fields, in
the shapes this contract fixes), the active variant, the document, the
organisation and the Theme settings, plus the documented helpers; it returns an
element tree; the builder stamps `data-block="campus-tools/partners"`,
`data-block-id` and `data-variant` on the root.

A Custom Block whose type the active Theme does not design is an **omitted
Block** (ADR 0045): the renderer leaves it out and reports it,
`omittedBlocksFor` lists it before export, and the export dialog requires the
acknowledgement. A design that throws or returns an invalid tree is a
rendering failure that stops the export and cannot be acknowledged away — the
distinction the agreed rules above rely on.

What this contract still has to add on the rendering side is small: the
field vocabulary determines the shape of `input.data` a design can rely on
(links as `{ kind: "page", pageId } | { kind: "url", url }` so `pageUrl()`
resolves them, images as asset references so `mediaUrl()` resolves them,
documents likewise), and a "Page missing" link renders as unlinked text. If an
extension ships a default design for its own Block, it registers through the
same `ThemeRenderModule` seam (a module whose `blockTypes` include the type),
in the same sandbox, and the active Theme's design wins over it — resolution
order is the one open rendering decision.

## Resolved (ADR 0055)

The contract above is implemented and recorded in
[ADR 0055](../adr/0055-custom-block-declarations.md); the developer-facing
format is in [how-to-author-a-custom-block.md](../how-to-author-a-custom-block.md).
The items that were still open:

- **The extension cannot read the saved Block data version.** A Block whose
  envelope `version` is greater than the installed declaration's is
  _unavailable_: kept, not editable, not exportable, until that newer
  package is imported. Data older than the declaration stays editable (the
  update flow adapts it; until then new fields read as empty) with a
  warning.
- **Standard document controls and asset representation.** A `document`
  field stores a `DocumentAssetRef` and uses the Document picker; an `image`
  field stores the canonical `AssetRef` with its `alt` as the description,
  edited beside the Asset picker.
- **Link shape.** A `link` field stores a Link target exactly as prose links
  do (`{ kind: "page", pageId }`, `{ kind: "article", articleId }`,
  `{ kind: "external", href }`), superseding the `{ kind: "url", url }`
  sketch above; `input.linkUrl()` resolves it and answers `null` for a
  missing Page.
- **Resolution order for a package-supplied default design** is deferred:
  only the active Theme's design is consulted; an undesigned type is
  omitted (ADR 0045).

Existing Block envelope and content ownership rules remain constraints
on this discussion. ADRs 0045 and 0046 define the existing Theme design
and rendering behavior.
