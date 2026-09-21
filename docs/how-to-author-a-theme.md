# How to author a Theme package

This is the developer guide for building a **Theme package**: a shareable file
that restyles a Site without touching its content. It is the authoritative
reference for the `theme.json` manifest and for the limits the builder
enforces.

Decisions behind the format live in
[ADR 0050](adr/0050-theme-package-format.md) (package format),
[ADR 0051](adr/0051-theme-package-lifecycle.md) (import, update, removal) and
[ADR 0052](adr/0052-renderer-theme-seam.md) (how a Theme reaches the
renderer). [ADR 0046](adr/0046-trusted-executable-theme-and-block-extensions.md)
sets the boundary of what a Theme may do at all.

A complete worked example ships at
[`examples/themes/practice/`](../examples/themes/practice/). Copy it.

---

## What a Theme can and cannot do

A Theme controls **appearance**. It styles the page shell (header, navigation,
footer) and the Blocks the author has placed, and it may offer named design
variants for Block types.

A Theme **does not define content**. There are no Theme-owned text or image
fields. Editable content belongs to Site data and Blocks — including the text
and images in headers and footers. This is ADR 0046's central line: if a Theme
could declare its own editable fields, it would become a second content model
that the author cannot fully edit and that vanishes when they switch Themes.

Three further limits, all enforced by the builder rather than left to
convention:

1. **Reading order is fixed.** You may use columns, overlaps and any visual
   arrangement, but the DOM order the author created must survive. Use grid
   and flex _placement_; do not use `order`, and do not lift content out of
   sequence.
2. **Everything is offline.** No remote `@import`, no `url(http…)`, no
   protocol-relative `url(//…)`. Bundle the font; bundle the image. The import
   fails with a message naming the offending line.
3. **No code, yet.** Phase one is declarative: manifest, CSS, fonts, images.
   Executable rendering and Custom Blocks are phase two (see the end of this
   guide).

---

## Package layout

```
my-theme/
  theme.json      # manifest — required, at the root
  theme.css       # stylesheet — filename declared in the manifest
  fonts/          # packaged .woff2 files, each declared in the manifest
  assets/         # decorative images your CSS references relatively
  README.md       # optional, carried verbatim
  LICENSE         # optional, carried verbatim
```

Ship it either way:

- **A directory** — what you develop against, and what belongs in a git
  repository. The builder loads a directory directly.
- **A `.sosb-theme.zip`** — what you send someone. The editor's
  **Theme settings → Theme packages → Export** produces one.

Both forms load to exactly the same result.

**Size limit:** 12 MB unpacked. If you are near it, you are shipping
un-subsetted fonts or uncompressed photographs.

---

## `theme.json` reference

### Required

| Field                   | Type     | Notes                                                                                                                                                                              |
| ----------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `formatVersion`         | `1`      | Exactly `1`. A different number is rejected with "update the builder".                                                                                                             |
| `id`                    | `string` | Namespaced, lowercase: two or more dot-separated segments, e.g. `org.example.practice`. Segments are `[a-z0-9]` with internal hyphens. **Permanent** — it keys the Site's storage. |
| `name`                  | `string` | What authors see in the Theme picker. Rename freely; it is not the identity.                                                                                                       |
| `version`               | `string` | Semver `major.minor.patch`, optional pre-release. Bump it every release.                                                                                                           |
| `builder.formatVersion` | `1`      | The builder format your package needs.                                                                                                                                             |

### Descriptive

| Field         | Type     | Default | Notes                                                 |
| ------------- | -------- | ------- | ----------------------------------------------------- |
| `description` | `string` | `""`    | One line, shown beside the Theme in the picker.       |
| `author`      | `string` | `""`    | You or your organisation.                             |
| `license`     | `string` | `""`    | Cover your fonts too — most OFL fonts require notice. |

### `supports` — which controls you honour

```json
"supports": { "colors": true, "fonts": false, "density": true, "radius": false }
```

Every flag defaults to `true`. The editor **hides** the controls you set to
`false`, with a short note explaining the absence.

Declare `false` for anything your CSS overrides. Showing an author a colour
picker whose value your stylesheet ignores is worse than showing nothing: they
change it, nothing happens, and they conclude the editor is broken.

| Flag      | Controls                          |
| --------- | --------------------------------- |
| `colors`  | Primary and accent colour pickers |
| `fonts`   | Headline and body font pickers    |
| `density` | The Spacing control               |
| `radius`  | The Corners control               |

### `cssTokens` — your palette and type baseline

Raw CSS custom properties emitted into `:root`, after the builder's universal
baseline and before any author override:

```json
"cssTokens": {
  "--color-primary": "#0a0c39",
  "--color-accent":  "#f6df82",
  "--color-fg":      "#f4f5fb",
  "--color-bg":      "#0a0c39",
  "--color-muted":   "#a7abd0",
  "--font-headline": "\"My Display\", system-ui, sans-serif",
  "--font-body":     "\"My Text\", system-ui, sans-serif",
  "--radius-base":   "0px"
}
```

The renderer derives more tokens from these — `--color-*-rgb`,
contrast-safe `--color-on-primary` / `--color-on-accent`, a contrast-safe
`--color-link`, and a `--color-surface` tint. Consume those rather than
hand-rolling equivalents; they stay correct when an author overrides your
palette.

`tokens` is the schema-keyed alternative (`colorPrimary`, `fontHeadline`,
`density`, `radius`). Prefer `cssTokens`.

### `fonts` — self-hosted faces

```json
"fonts": [
  {
    "family": "My Display",
    "weight": 900,
    "style": "normal",
    "file": "fonts/display-latin-900.woff2",
    "unicodeRange": "U+0000-00FF,U+0131,…"
  }
]
```

Every declared file must exist or the import fails. The builder emits matching
`@font-face` rules and copies the files to `assets/theme/<id>/fonts/…`.

**Ship `latin-ext`.** Romanian needs `ș`, `ț`, `ă`, `î`, `â`, and those live in
`latin-ext`. A Theme that ships only `latin` renders the organisation's own
name in a fallback font. Declare one entry per subset with its own
`unicodeRange`; omit `unicodeRange` only when a face covers everything.

Use an OFL-licensed family and subset it. `@fontsource` packages are a
convenient source, and several are already vendored in this repository.

### `variants` — named Block designs

```json
"variants": {
  "hero": [
    { "id": "spotlight", "label": "Spotlight", "description": "Full-height, radial glow." },
    { "id": "split",     "label": "Split",     "description": "Title beside the image." }
  ]
}
```

Keyed by Block type (`hero`, `valueList`, `teamGrid`, `activitiesList`,
`partnerLogos`, `ctaBanner`, `faq`, `eventList`, `quote`, `imageGallery`,
`documentDownloads`, `contactCard`, `richText`, `embed`, `customHTML`,
`siteFooter`).

When you offer variants for a Block type, the author gets a **Design** control
in the Block Inspector. `id` is a lowercase slug; it lands in Site data and in
the emitted attribute. `label` is what the author picks from.

Variants are presentation only. They never change Block data, so switching
between them — or to another Theme — cannot lose content.

### `shellVariants` — header / navigation / footer treatments

```json
"shellVariants": [
  { "id": "standard", "label": "Standard" },
  { "id": "compact",  "label": "Compact", "description": "Tighter sticky header." }
]
```

Surfaced as **Header style** in Theme settings.

### `css`

```json
"css": "theme.css"
```

The entry stylesheet, bundle-relative. Defaults to `theme.css`.

There is no `preview` block of swatches or sample words, and you do not need
to supply a thumbnail. The Theme picker shows a **real miniature render** of
your Theme — the sample site's home page, rendered by the same renderer that
builds a real site, scaled down. It cannot drift from your CSS, because it
_is_ your CSS. Your `name` and `description` are what you write; everything
visual is taken from the Theme itself.

(Fonts and images are not served inside the miniature, so it shows your
fallback font stack and grey placeholders in image slots. It is a picture of
your layout and palette, not a pixel-exact proof.)

---

## Writing `theme.css`

### What you are styling

Every Block renders a root element carrying `data-block="<type>"` and
`data-block-id="<id>"`. Target the type:

```css
[data-block="hero"] { … }
[data-block="teamGrid"] img { … }
```

Your variants become a second attribute on the same root:

```css
[data-block="hero"][data-variant="split"] { … }
[data-block="partnerLogos"][data-variant="band"] { … }
```

The shell variant lands on `<body>`:

```css
[data-shell-variant="compact"] [data-site-nav] { … }
```

Useful shell hooks: `[data-site-nav]`, `.site-nav__inner`, `.site-nav__brand`,
`.site-nav__logo`, `[data-language-switcher]`, and `a[data-active="true"]` for
the current page or language.

### You inherit a working baseline

Your CSS is composed _after_ the builder's layout baseline, which already
covers every registered Block type. You are writing deltas, not a stylesheet
from scratch — so a Theme that curates three Blocks still renders the other
thirteen sensibly.

### Use the tokens

Read `var(--color-*)`, `var(--space-*)`, `var(--type-*)`, `var(--radius-*)`
rather than hard-coding values. It is what keeps the author's overrides,
the density control and the fluid type scale working.

### Referencing your own files

Relative, from the package root:

```css
body {
  background-image: url(assets/grid.svg);
}
```

The builder rewrites that to `assets/theme/<your-id>/assets/grid.svg` and
resolves it to a real file in an export and a `blob:` URL in the editor
preview. Every file your CSS references must exist in the package.

Allowed: relative paths, `data:` URLs, `#` fragments.
Rejected: `http(s)://`, `//host/…`, `/absolute`, `../escaping`.

### Accessibility is your responsibility

Arbitrary CSS means the two easiest ways to hurt a user are yours to get
right:

- **Contrast.** Check body text, muted text and link text against your
  background. The derived `--color-link` and `--color-on-*` tokens are
  already contrast-checked; prefer them.
- **Focus.** Never remove a focus ring without replacing it:

  ```css
  a:focus-visible,
  button:focus-visible,
  summary:focus-visible {
    outline: 3px solid var(--color-accent);
    outline-offset: 3px;
  }
  ```

Also honour `prefers-reduced-motion` for any transition, and remember that a
phone-width navigation must keep every destination reachable — you have no
JavaScript to open a menu with.

---

## Developing and testing

Load your package from its directory while you work:

```ts
import { loadThemePackageFromDirectory } from "@sosb/theme-package/node";
import { renderSite } from "@sosb/renderer";

const { bundle } = loadThemePackageFromDirectory("examples/themes/practice");
const html = renderSite(site, bundle.id, { theme: bundle });
```

`examples/themes/practice/` is covered by tests under
`packages/theme-package/test/` that validate it, render the sample Site across
every page, run axe, and assert preview/build parity. They are a good template
for your own.

Then import the zip through **Theme settings → Theme packages → Import**.

### Rejection codes

| Code                         | Meaning                                               |
| ---------------------------- | ----------------------------------------------------- |
| `manifest-missing`           | No `theme.json` at the root, or it is not valid JSON. |
| `manifest-invalid`           | A field fails the schema; the message names it.       |
| `format-version-unsupported` | The package needs a newer builder.                    |
| `file-missing`               | The manifest or CSS names a file the package lacks.   |
| `css-unsafe`                 | The CSS reaches for the network or an absolute path.  |
| `path-unsafe`                | An entry or `url()` escapes the package root.         |
| `package-too-large`          | Over 12 MB unpacked.                                  |

Import is all-or-nothing: a rejected package leaves the Site untouched.

---

## Shipping and updating

Export from Theme settings and send the `.sosb-theme.zip`. It contains only
your Theme — no Site content, structurally.

Imported Themes are stored **inside the Site** under `themes/<id>/`, so they
travel in the project archive: a recipient opens it offline and sees the
design without installing anything.

Re-importing the same `id` replaces the installed copy. Bump `version` so the
author can see what they are getting. Authors cannot remove a Theme while it
is in use; they switch first.

If a Theme is missing, the Site still opens and saves with all content intact,
the editor offers to switch to a built-in look, and **export is blocked** until
it is resolved — a Site is never silently published in the wrong design.

---

## What phase two adds

Phase one is deliberately declarative. Planned next, without a format break:

- **Executable rendering code** (`render.js`) and **public-site scripts**
  (`public.js`), with enforcement of ADR 0046's access limits.
- **Custom Blocks** with developer-declared editable fields, per the
  [issue-106 contract](plans/issue-106-custom-block-contract.md) — the builder
  generates the editing forms.
- **Interactive preview mode**, so public-site scripts can be exercised
  without triggering real external actions during ordinary editing.

Write your manifest normally. Unknown keys are preserved, `formatVersion`
gates the format, and `builder.formatVersion` lets a future package state what
it needs — so a package authored today keeps working.
