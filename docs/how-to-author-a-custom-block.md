# How to author a Custom Block

This is the developer guide for declaring a **Custom Block** in a Theme
package: a Block type with its own editable fields, which the builder edits
with its own controls and the active Theme's `render.js` designs. It is the
authoritative reference for the `block.json` declaration format.

Decisions behind the format live in
[ADR 0055](adr/0055-custom-block-declarations.md); the rendering side is
[ADR 0054](adr/0054-executable-theme-rendering-and-sandbox.md) and the
[Theme authoring guide](how-to-author-a-theme.md). The product contract is
the [issue-106 plan](plans/issue-106-custom-block-contract.md).

A complete worked example ships at
[`examples/themes/practice/blocks/partners/block.json`](../examples/themes/practice/blocks/partners/block.json),
designed by the same package's `render.js`. Copy it.

---

## What a Custom Block is, and is not

A Custom Block **declares fields**. The builder generates the editing form
from that declaration — text boxes, the rich-text editor, switches, choice
lists, the link picker, the Asset picker with its description, the Document
picker, nested groups, and repeatable lists with add, remove and reorder. You
do not write editing code, and you cannot: ADR 0046 draws that line so an
author never meets a form the builder does not understand.

A Custom Block **does not render itself**. The active Theme's `render.js`
designs it under `blocks["<type>"]`, exactly as it would override a built-in
Block. A Theme with no design for the type leaves the Block out of the
published Site; the author is told and acknowledges it before exporting
(ADR 0045). The content is never touched — switching Themes cannot lose a
field.

The two halves may live in one package (the example does that) or in
different ones: a package may declare Blocks and design none, design Blocks
it does not declare, or both.

---

## Package layout

```
my-theme/
  theme.json                   # manifest — lists the declarations
  blocks/partners/block.json   # one declaration per type
  render.js                    # designs blocks["org.example/partners"]
  …
```

In `theme.json`:

```json
"blocks": ["blocks/partners/block.json"]
```

Paths follow the same rules as fonts (bundle-relative, no `..`). Every listed
file must exist and parse, or the package is refused.

---

## `block.json` reference

```json
{
  "formatVersion": 1,
  "type": "org.example/partners",
  "version": 1,
  "label": { "default": "Partners", "ro": "Parteneri", "en": "Partners" },
  "description": { "default": "Groups of partner logos.", "ro": "Grupuri de logo-uri." },
  "builder": { "formatVersion": 1 },
  "fields": [ … ]
}
```

| Field                   | Type           | Notes                                                                                                                                                                                                                                                              |
| ----------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `formatVersion`         | `1`            | Exactly `1`. A newer number is refused with "update the builder" before anything else is checked.                                                                                                                                                                  |
| `type`                  | `string`       | **Permanent.** A namespace, a slash, a name: `campus-tools/partners`, `org.example/partners`. Lowercase; segments `[a-z0-9]` with internal hyphens; the namespace may be dot-separated. It keys saved data. Distinct from Theme ids (no slash) and built-in types. |
| `version`               | positive int   | The Block **data** format. Lands in every envelope of this type. Bump it when the fields change in a way saved data must follow; a visual fix is a package release, not a data version.                                                                            |
| `label`                 | localized text | What authors see in the Add Block dialog and the outline. Rename freely; it is not the identity.                                                                                                                                                                   |
| `description`           | localized text | One line under the label in the Add Block dialog. Optional.                                                                                                                                                                                                        |
| `builder.formatVersion` | `1`            | Optional; the declaration format the builder must understand.                                                                                                                                                                                                      |
| `fields`                | array, ≥ 1     | The fields, in editing order.                                                                                                                                                                                                                                      |

**Localized text** is either a plain string (the default) or an object with
`default` and one entry per editor language (`ro`, `en`). A missing
translation falls back to `default`. These strings are editing copy for the
builder; they never reach the published Site.

Unknown keys are preserved, not honoured, so a declaration authored for a
future builder still loads here.

### Fields

Every field has `name`, `kind`, `label` and an optional `help`. `name` is an
identifier (`heading`, `partnerName`) — it is the key in saved data and the
property your design reads (`input.data.heading`). Names are unique within
their group.

| Kind       | Stores                                                                                                    | Rules                    | Default   | Control                                       |
| ---------- | --------------------------------------------------------------------------------------------------------- | ------------------------ | --------- | --------------------------------------------- |
| `text`     | a string                                                                                                  | `required`, `maxLength`  | —         | a text box (a textarea for long-text names)   |
| `richText` | a Rich-text document (ADR 0048)                                                                           | `required`               | —         | the Rich-text editor                          |
| `number`   | a number                                                                                                  | `required`, `min`, `max` | —         | a number input                                |
| `boolean`  | `true` / `false`                                                                                          | —                        | `default` | a switch                                      |
| `choice`   | one of `options[].value`                                                                                  | `required`               | `default` | a select, with `options[].label` translated   |
| `link`     | a Link target: `{ kind: "page", pageId }`, `{ kind: "article", articleId }`, `{ kind: "external", href }` | `required`               | —         | the link picker                               |
| `image`    | an `AssetRef` (`path`, `alt`, `width`, `height`, …)                                                       | `required`               | —         | the Asset picker plus a description box       |
| `document` | a `DocumentAssetRef` (`path`, `mime`, `byteSize`, `originalName`, …)                                      | `required`               | —         | the Document picker                           |
| `group`    | an object of `fields`                                                                                     | —                        | —         | a fieldset                                    |
| `list`     | an array of groups (`item: { kind: "group", fields }`)                                                    | `minItems`, `maxItems`   | —         | add / remove / reorder; `itemLabel` names one |

Only switches and choices may carry a `default` — "Show heading: Yes". Text,
images, links and lists start empty; a new list entry is empty apart from its
own switch and choice defaults. Sample content belongs in a Template, not in
a declaration.

A list's entry is always a group. To hold a list of plain images, declare a
group with one `image` field. Groups and lists nest up to five levels; a type
declares at most a hundred fields.

`choice.options` is `[{ "value": "wide", "label": … }]`; values are short
tokens and must be distinct; `default`, if given, must be one of them.

### Validation is advice, not a gate

Every rule above produces a **warning** the author sees beside the field and
in the export readiness panel, and may acknowledge. Nothing is truncated or
removed: a list with six entries against `maxItems: 5` keeps all six, and
your design will receive them. Authors save unfinished work at any time.
Design for every field being empty or over its limit.

The only findings that block an export are damaged-archive ones — an image
or document whose bytes are gone, Rich-text content this builder cannot
render — and an unavailable Block (below).

---

## Designing the Block in `render.js`

```js
export default {
  blocks: {
    "org.example/partners"(input) {
      const { data } = input;
      if (!data.heading && !(data.groups || []).length) return null;
      return [
        "section",
        { class: "partners" },
        data.heading ? ["h2", null, data.heading] : null,
        data.intro ? input.richText(data.intro) : null,
        ...(data.groups || []).map((group) => [
          "ul",
          null,
          ...(group.partners || []).map((p) => {
            const href = input.linkUrl(p.link);
            const logo = input.mediaUrl(p.image);
            const item = [
              "figure",
              null,
              logo ? ["img", { src: logo, alt: input.mediaAlt(p.image) }] : null,
              ["figcaption", null, p.name || ""],
            ];
            return ["li", null, href ? ["a", { href }, item] : item];
          }),
        ]),
      ];
    },
  },
};
```

`input.data` is the Block data exactly as saved, in the shapes the table
above fixes. The helpers that matter for Custom Block fields:

- `input.linkUrl(target)` — a `link` value to an href, or `null` when it does
  not resolve: a Page that was deleted, an Article still in Draft, an address
  the builder would refuse. Render `null` as unlinked text; that is the
  "Page missing" behaviour the contract promises.
- `input.mediaUrl(ref)` / `input.mediaAlt(ref)` — an `image` value to its URL
  and stored description. `null` when empty.
- `input.richText(doc)` — a `richText` value, rendered by the builder with the
  page's link and asset resolution. Place the result like any child.
- `input.pageUrl(id)` also accepts a Page's permanent id.

Offer variants for the type in the manifest under its id —
`"variants": { "org.example/partners": [ … ] }` — and read `input.variant`.
The builder stamps `data-block="org.example/partners"` and `data-variant`
onto your root, so `[data-block="org.example/partners"][data-variant="band"]`
works in `theme.css` (quote the selector: the id has a slash).

Everything in [the Theme guide's sandbox section](how-to-author-a-theme.md#what-the-sandbox-allows)
applies.

---

## What the builder does with it

- **Importing.** Each listed `block.json` is parsed at import, before the
  design is compiled. An unsupported field kind refuses the package with a
  message naming the file, the field and the supported kinds
  (`block-invalid`); a newer declaration format asks for a newer builder
  (`block-format-unsupported`). A refused import changes nothing — the
  previously installed version keeps working.
- **Adding.** Available types appear in the Add Block dialog under their
  label, in a "From your Theme packages" group. A new Block starts at your
  `version` with only the declared switch and choice defaults.
- **Editing.** The Inspector generates the form. Labels and help follow the
  editor's language. Findings appear beside fields.
- **Per language.** Each language Page has its own Block data, as for every
  Block. There is no per-field language map.
- **Unavailable Blocks.** If a Site holds a Block whose type no installed
  package declares, or whose package needs a newer builder or would not load,
  or whose data was saved by a newer package than the installed one, the
  Block is marked _unavailable_: its content is kept exactly, it cannot be
  edited, and the export is blocked with a message saying which package to
  import or update. This is distinct from a Theme with no design for the
  type, which is an acknowledgeable omission.

---

## Updating a declaration

The Site keeps the package version in its archive until the author imports
a new one. When they do:

- Same fields → nothing happens to Block data. An appearance-only release
  never asks anything.
- New fields → they start empty (or at their switch/choice default). Nothing
  is asked.
- Removed fields, or a field whose kind changed → before anything is written
  the builder lists the content that would be removed — which Page, which
  block, which field, what it says — and the author chooses to keep the
  current version or to update.

Before an update that touches Blocks is applied, the builder keeps the
outgoing package and the affected Blocks under `themes-recovery/<id>/` in
the Site archive. **Restore previous version** in the Theme packages panel
puts both back. One copy per package; the next update replaces it.

Bump `version` whenever saved data has to follow; the builder stamps every
adapted envelope with it. A Block saved at a _higher_ version than the
installed declaration is unavailable until that package is imported.

Rules for a smooth update: never reuse a `name` for a field of a different
kind; add rather than rename; if you must remove a field, expect the author
to be asked.

---

## Rejection codes

| Code                       | Meaning                                                                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `file-missing`             | The manifest lists a `block.json` the package does not contain.                                                                                                      |
| `block-invalid`            | Not JSON; an unsupported field kind; a bad `type`, `name` or rule; a type declared twice in the package; nesting too deep. The message names the file and the field. |
| `block-format-unsupported` | The declaration's `formatVersion` (or `builder.formatVersion`) is newer than this builder.                                                                           |

---

## Testing

`examples/themes/practice/` is covered by
`packages/theme-package/test/example-practice-partners.test.ts`, which loads
the declaration, checks the registry and validation over sample data, renders
both variants — logos, initials, a Page link, a missing Page — pins the output
to golden files and asserts two separately loaded sandbox realms produce
identical bytes. Copy it for your own Block.

To try a declaration without a package, parse it directly:

```ts
import { parseCustomBlockDeclaration } from "@sosb/schema";
const result = parseCustomBlockDeclaration(
  JSON.parse(readFileSync("blocks/partners/block.json", "utf8")),
);
if (!result.ok) console.error(result.code, result.message);
```
