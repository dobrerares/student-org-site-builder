# How to author a Theme package

This is the developer guide for building a **Theme package**: a shareable file
that restyles a Site without touching its content. It is the authoritative
reference for the `theme.json` manifest and for the limits the builder
enforces.

Decisions behind the format live in
[ADR 0050](adr/0050-theme-package-format.md) (package format),
[ADR 0051](adr/0051-theme-package-lifecycle.md) (import, update, removal) and
[ADR 0052](adr/0052-renderer-theme-seam.md) (how a Theme reaches the
renderer) and [ADR 0053](adr/0053-executable-theme-rendering-and-sandbox.md)
(executable designs, the sandbox and public-site scripts).
[ADR 0046](adr/0046-trusted-executable-theme-and-block-extensions.md)
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
2. **Everything is offline.** No `url(http…)`, no protocol-relative
   `url(//…)`, no root-absolute `url(/…)`, and no remote string in
   `image-set()`. Bundle the font; bundle the image. The import fails with a
   message naming the offending target.

   Two rules surprise people, so they are worth stating plainly:

   - **No `@import` at all**, remote or local. A package ships exactly one
     stylesheet (`css` in the manifest). A local `@import` is never resolved
     against the package — it would resolve against the visitor's page URL and
     404 — so paste the rules into your stylesheet instead.
   - **No CSS character escapes in `url()`.** `\75 rl(…)` is `url(…)` to a
     browser, but the builder's asset rewriter matches literal tokens, so an
     escaped reference would never be rewritten onto your package's asset path.
     Write `url(assets/grid.svg)` as plain text.

   The checks run over a copy of your stylesheet with comments stripped and
   escapes decoded, so neither is a way around them. A `url()` inside a `/* */`
   comment is not a reference and is ignored.

3. **Code runs in a sandbox.** A Theme may ship a `render.js` that designs
   Block markup and the page shell, and a `public.js` that runs on the
   published Site. The design runs inside an engine the builder controls: no
   network, no files, no clock, no randomness, no timers, no imports, and a
   budget on how long and how much memory a render may take. It returns
   _data_, not HTML. The whole contract is in
   [Executable designs](#executable-designs-renderjs) below.

---

## Package layout

```
my-theme/
  theme.json      # manifest — required, at the root
  theme.css       # stylesheet — filename declared in the manifest
  render.js       # optional executable design (Block markup, page shell)
  public.js       # optional public-site script, declared with its dependencies
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

### `render` — the executable design

```json
"render": "render.js"
```

Bundle-relative path of your design module, under the same path rules as a
font file. Optional: a package without one is a complete Theme and renders
exactly as phase one did. When present, the file must exist and must compile
— a syntax error, a missing `export default` or an `import` of another module
rejects the package at import time with `render-invalid`. The full contract is
[below](#executable-designs-renderjs).

### `public` — the public-site script

```json
"public": {
  "file": "public.js",
  "network": [],
  "offline": "The map does not load."
}
```

| Field     | Required                    | Notes                                                                                                                                |
| --------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `file`    | yes                         | Bundle-relative path, same rules as a font file. The bytes ship verbatim to `assets/theme/<id>/<file>`.                              |
| `network` | yes                         | Hostnames the script may contact (`api.example.org`, `*.tiles.example.org`, optional `:port`). Not URLs. `[]` means "none" — say so. |
| `offline` | when `network` is non-empty | One sentence on what stops working without a connection.                                                                             |

`network` is required even when the honest answer is `[]`: "this script is
self-contained" is something you say, not something the builder assumes. See
[Public-site scripts](#public-site-scripts-publicjs).

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

## Executable designs: `render.js`

A design is an ES module. Its default export names the Block types it renders
and, optionally, the page shell:

```js
export default {
  shell(input) {
    return [
      ["header", { class: "chrome" }, ["a", { href: input.homeHref }, input.org.name]],
      ["slot"],
    ];
  },
  blocks: {
    hero(input) {
      return ["section", { class: "hero" }, ["h1", null, input.data.title]];
    },
    "org.example/partners"(input) {
      return ["ul", null, ...input.data.items.map((item) => ["li", null, item.name])];
    },
  },
};
```

- A key in `blocks` that names a built-in type (`hero`, `faq`, …) **overrides**
  the built-in component for every Block of that type, in every variant. Your
  function receives `input.variant` and is responsible for all of them.
- A key that names a Custom Block type (`org.example/partners`) **renders** a
  type the builder has no component for. Without such a key that Block is
  left out of the Site and the author is asked to acknowledge it before
  export.
- `shell` is optional. Without it the builder's own header, navigation and
  language switcher are used, as in phase one.

The module is compiled once when the package is imported. It may not `import`
anything, and it has no `console` — see [the sandbox](#what-the-sandbox-allows).
One file, up to 512 KB.

### Element trees

A design never returns HTML. It returns a **tree**, in either of two spellings
that normalise to the same thing:

```js
["p", { class: "lede" }, "Hello, ", ["strong", null, "world"]]
{ tag: "p", attrs: { class: "lede" }, children: ["Hello, ", { tag: "strong", children: "world" }] }
```

Rules of the shape:

- The array form is `[tag, attrs, ...children]`. `attrs` may be `null` or
  omitted entirely (`["br"]`, `["span"]`).
- Children may be strings, numbers, nested nodes, or arrays of those. `null`,
  `undefined`, `true` and `false` render nothing, so `cond ? node : null` is
  the idiom for optional content.
- A bare array whose first item is **not** a string is a fragment (a list of
  children). A bare array whose first item **is** a string is a node — so
  `words.map((w) => w)` is not a list of text nodes, it is a node whose tag is
  the first word. Spread text into a parent instead: `["p", null, ...words]`.
- Attribute values may be strings, numbers or booleans. `null`, `undefined`
  and `false` drop the attribute. `""` emits a bare attribute (`hidden`,
  `data-site-nav`). `true` emits a bare attribute for boolean HTML attributes
  (`hidden: true`) but the string `"true"` for `data-*` and `aria-*`
  attributes, which is what CSS selectors such as `[data-active="true"]`
  expect.
- Attributes are emitted in sorted order, whatever order you wrote them.
- Trees are limited to 64 levels deep and 20,000 nodes.

### What you may emit

**Elements:** the ordinary content and sectioning elements — `a`, `article`,
`aside`, `blockquote`, `button`, `details`/`summary`, `div`, `dl`/`dt`/`dd`,
`figure`/`figcaption`, `footer`, `h1`–`h6`, `header`, `hgroup`, `img`,
`picture`/`source`, `audio`/`video`/`track`, `li`/`ol`/`ul`, `main`, `nav`,
`p`, `pre`/`code`, `section`, `span`, `table` and its parts, `time`, and the
inline text elements — plus inline SVG (`svg`, `g`, `path`, `circle`, `rect`,
`line`, `polyline`, `polygon`, `ellipse`, `title`, `desc`).

**Not available, by design:** `script`, `iframe`, `object`, `embed`, `base`,
`link`, `meta`, `style` (your stylesheet goes through the offline scanner; a
`<style>` element would not), `html`/`head`/`body` (the builder owns the
document), `form`/`input`/`select`/`textarea` (a form's `action` is a network
dependency the render cannot check — deferred), and SVG `use`, `image` and
`foreignObject`.

**Attributes:** `class`, `id`, `lang`, `dir`, `hidden`, `role`, `tabindex`,
`title`, `translate`, every `data-*` and `aria-*`, and the ordinary per-element
attributes (`href`, `src`, `alt`, `width`, `height`, `loading`, `datetime`,
`colspan`, `open`, `type`, `disabled`, …). Not available: any `on*` handler
(behaviour belongs in `public.js`), `style` (put the rule in your stylesheet),
and the attributes the builder places itself — `data-block`, `data-block-id`,
`data-variant`, `data-shell-variant`.

**URLs** in `href`, `src`, `srcset`, `poster` and `cite` must be one of: a
value a helper returned (`input.asset()`, `input.mediaUrl()`,
`input.pageUrl()`, `input.articleUrl()`, `input.homeHref`); a relative path
without a scheme; a fragment; or a plain `http(s)`, `mailto` or `tel` URL.
`javascript:`, `data:` and protocol-relative `//host` are refused. A link with
`target="_blank"` gets `rel="noopener noreferrer"` added.

A tree that breaks any of these is an `invalid-tree` error naming the node and
the attribute.

### Block designs

`blocks[type](input)` receives:

| Field      | Contents                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `id`       | The Block's id.                                                                                                                  |
| `type`     | Its type — the key your function was registered under.                                                                           |
| `version`  | The envelope's data-format version.                                                                                              |
| `data`     | The Block data, exactly as saved. Handle empty and missing fields without throwing; authors save unfinished work.                |
| `variant`  | The active design variant id, or `null`. Only variants your manifest declares for this type arrive here.                         |
| `lang`     | The page language (`ro`, `en`).                                                                                                  |
| `document` | `{ kind: "page" \| "article", id, title, lang }` — where the Block sits.                                                         |
| `org`      | `{ name, tagline, foundedYear, email, phone, address, social: [{ platform, url }], logo: { path, alt, width, height } \| null }` |
| `theme`    | `{ id, version, shellVariant, tokens }` — your Theme's settings for this Site.                                                   |

Return **one element** or `null`. The builder stamps `data-block="<type>"`,
`data-block-id="<id>"` and, when the Theme offers the selected variant,
`data-variant="<id>"` onto that root — so `[data-block="hero"][data-variant="split"]`
in your stylesheet works for a designed Block exactly as it does for a
built-in one. A fragment root is refused, because there would be nothing to
stamp. `null` renders nothing at all (no marker, no report): use it when a
Block has no content worth showing.

To keep your phase-one CSS working when you override a built-in, reproduce the
built-in's classes for the variants you are not changing. The example Theme's
`hero` does exactly that: the built-in markup for the default and "split"
variants, its own for "spotlight".

### The page shell

`shell(input)` receives, on top of `lang`, `document`, `org` and `theme`:

| Field         | Contents                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `kind`        | `"page"` or `"article"`.                                                                                |
| `title`       | The document title the builder puts in `<title>`.                                                       |
| `description` | The meta description, or `null`.                                                                        |
| `homeHref`    | The builder-computed href of this language's home Page. Use it for the brand link.                      |
| `nav`         | `[{ id, label, href, isActive }]` — the navigation, in the author's order. Empty on a single-page Site. |
| `languages`   | `[{ lang, nativeName, href, isActive }]` — the language switcher entries. Empty for one language.       |

Return the contents of `<body>`: a fragment (a bare array) or a single element,
containing **exactly one** `["slot"]`. The builder replaces the slot with
`<main>` holding the page's Blocks in the author's order, followed by the
site-footer Block. Zero slots or several is a `slot-count` render error — a
shell that drops the page body must not be publishable, and two slots would
make the reading order ambiguous.

The builder keeps `<html>`, `<head>`, SEO metadata, hreflang alternates, the
stylesheet, its own enhancement scripts and the preview bridge. It also places
`data-shell-variant` on `<body>`; read `input.theme.shellVariant` in your
design if the variant changes structure and not just style.

Two accessibility notes that bite in a shell: the author's footer Block is a
`<footer>` (a contentinfo landmark), so put your own colophon in a labelled
`<section>` rather than a second `<footer>`; and keep every piece of content
inside a landmark. The built-in header markup uses the hooks `[data-site-nav]`,
`.site-nav__inner`, `.site-nav__brand`, `.site-nav__logo`,
`[data-language-switcher]` and `a[data-active="true"]`; reuse them and the
baseline styles keep applying.

### Helpers

Every helper lives on `input`:

| Helper                 | Returns                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `input.asset(path)`    | The URL of a file in your package (`assets/x.svg`). Resolves to a real file in a build and a `blob:` URL in the preview; you never see the difference.                          |
| `input.mediaUrl(ref)`  | The URL of a Site asset — an image reference out of Block data or `org.logo.path` — or `null` when the slot is empty. Handle `null`.                                            |
| `input.mediaAlt(ref)`  | The screen-reader description stored on that asset, or `""`.                                                                                                                    |
| `input.pageUrl(id)`    | The href of the Page with id `"<lang>:<slug>"`, or `null`.                                                                                                                      |
| `input.articleUrl(id)` | The href of an Article by its permanent id, or `null`.                                                                                                                          |
| `input.richText(doc)`  | Builder-rendered, sanitised prose for a rich-text value. Place the result in your tree like any child. It is an opaque token, not a string: there is no raw HTML from a design. |
| `input.t(key)`         | A visitor-facing word in the page's language. Unknown keys come back unchanged.                                                                                                 |

Keys `t()` answers: `menu`, `close`, `navigation`, `home`, `since`,
`siteInfo`, `skipToContent`, `languageLabel`, `publishedOn`, `relatedTitle`,
`tagsLabel`, `emptyList`, `movedHeading`, `movedLink`. A Theme has no editable text of its
own (ADR 0046), so this list is deliberately short: a design that needs a
sentence has content, and content belongs in a Block.

### What the sandbox allows

Your module runs in QuickJS compiled to WebAssembly, in a realm of its own,
identically in the browser, in Electron and in Node (ADR 0053). Inside it:

- **Absent:** `fetch`, `XMLHttpRequest`, `setTimeout`/`setInterval`,
  `queueMicrotask`, `require`, `process`, `WebAssembly`, `console`, `Intl`,
  `window`, `document`, and the engine's own `std`/`os`. `typeof fetch` is
  `"undefined"`, not a stub that throws.
- **Removed before your code runs:** `Date`, `Math.random`, `WeakRef`,
  `FinalizationRegistry`. A copyright year, a random id, a cache-buster —
  each would make the same Site render differently twice. Use
  `input.org.foundedYear` for a "since" line; leave the year out.
- **Closed:** static `import` fails to compile; dynamic `import()` returns a
  promise that never settles.
- **Budgets, per call:** roughly twenty million loop iterations or calls
  (`timeout`), 48 MB of new memory (`memory`), a 256 KB call stack (about 1,300
  nested calls; a plain `stack overflow` error), 512 KB of source.
- **The boundary is JSON.** Your input arrives as plain data and your tree
  leaves as plain data. Functions, cycles and host objects do not cross.

Everything else in ECMAScript 2023 is there: modern syntax, `Map`/`Set`,
`Intl`-free string and array methods, `JSON`, `structuredClone`-free but
`JSON.parse(JSON.stringify(...))` works.

There is no `console.log`. Debug by rendering the value into a `data-` attribute
and reading it in the preview, or by loading the package in a test.

### Errors and how they surface

| Code             | Meaning                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `threw`          | Your function threw (or recursed past the stack limit). The message carries the error.      |
| `timeout`        | The instruction budget ran out — a loop that does not end.                                  |
| `memory`         | The memory ceiling was hit — an allocation that does not stop.                              |
| `invalid-tree`   | The tree contains something the contract refuses; the message names the node and attribute. |
| `slot-count`     | The shell has zero or more than one `["slot"]`.                                             |
| `module-invalid` | The module would not load (also reported at import as `render-invalid`).                    |

Every message names the Theme and the Block (`block blk_home_hero (hero)`) or
`shell`. In the **editor preview** the failing Block is replaced by a
builder-owned error box with the message — for a failed shell, above the
builder's fallback header — so the author keeps editing and sees what broke.
In an **export** the build stops with the same error; a rendering failure
cannot be acknowledged away (ADR 0045).

A Block whose type you do not design (and no built-in renders) is not an
error. It is **omitted**: left out of the Site and listed in the export dialog
for the author to acknowledge.

### Determinism, in one sentence

For the same Site, Theme and assets your design must return the same tree
every time, and the sandbox makes the ways of breaking that rule unavailable
rather than merely discouraged.

---

## Public-site scripts: `public.js`

A `public.js` runs on the **published** Site only — never during a render, and
never in the ordinary editor preview (ADR 0046). Declare it with its
dependencies:

```json
"public": { "file": "public.js", "network": [] }
```

The builder writes the file verbatim to `assets/theme/<id>/public.js` and adds
`<script defer src="…/public.js">` to every page and Article, resolved for the
page's depth. `defer` is not negotiable: content and navigation must work
before your script runs, and a deferred external file cannot block the parse.

Write it to **degrade honestly**. The example Theme's script reveals a
phone-width menu button that `render.js` ships `hidden`, and marks the header
so the stylesheet collapses the list only once the button exists; a visitor
without JavaScript keeps the wrapped list and loses nothing. It also tightens
the sticky header after a short scroll. Both are additive, neither contacts
anything, and the manifest says so with `network: []`.

Rules and facts:

- `network` lists hostnames your script contacts; `offline` says what stops
  working without them. Both are read by people, and the second is required
  as soon as the first is non-empty.
- You may bundle a framework and exceed the builder's 10 KB script budget
  (ADR 0046); the script is exempt from that budget. Say how big it is in your
  README. Core content must still be readable HTML before it runs.
- The script is not sandboxed — it is ordinary JavaScript on the visitor's
  page. The sandbox is for `render.js`.
- In the editor, `iframeSrcdoc`'s `includePublicScript` preview option is the
  seam the interactive-preview toggle flips. Until that toggle ships, test the
  script in a built Site.

---

## Developing and testing

Load your package from its directory while you work:

```ts
import { loadThemePackageFromDirectoryAsync } from "@sosb/theme-package/node";
import { renderSite } from "@sosb/renderer";

const { bundle } = await loadThemePackageFromDirectoryAsync("examples/themes/practice");
const html = renderSite(site, bundle.id, { theme: bundle });
bundle.render?.dispose(); // release the sandbox realm when you are done
```

The `Async` loader starts the sandbox engine before reading the directory; a
package with a `render.js` cannot be loaded synchronously before that
(`ThemeSandboxNotReadyError` says so). The zip and VFS loaders are already
asynchronous and start it themselves. A declarative package still loads with
the synchronous `loadThemePackageFromDirectory`.

`examples/themes/practice/` is covered by tests under
`packages/theme-package/test/` that validate it, render the sample Site across
every page, run axe, pin its output to golden files, and assert preview/build
parity with the public script on and off. They are a good template for your
own.

Then import the zip through **Theme settings → Theme packages → Import**.

### Rejection codes

| Code                         | Meaning                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `manifest-missing`           | No `theme.json` at the root, or it is not valid JSON.                                                             |
| `manifest-invalid`           | A field fails the schema, or a variant id or font face is declared twice; the message names it.                   |
| `format-version-unsupported` | The package needs a newer builder.                                                                                |
| `file-missing`               | The manifest or CSS names a file the package lacks.                                                               |
| `css-unsafe`                 | The CSS reaches for the network or an absolute path, uses `@import`, or hides a `url()` behind character escapes. |
| `path-unsafe`                | An entry or `url()` escapes the package root.                                                                     |
| `render-invalid`             | `render.js` does not compile: a syntax error, no `export default`, an `import`, or over the 512 KB size limit.    |
| `package-too-large`          | Over 12 MB unpacked.                                                                                              |

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

## What comes next

Still planned, without a format break:

- **Custom Blocks** with developer-declared editable fields, per the
  [issue-106 contract](plans/issue-106-custom-block-contract.md) — the builder
  generates the editing forms, and your `render.js` designs them through the
  same `blocks` map described above.
- **Interactive preview mode**, the editor toggle that turns
  `includePublicScript` on so `public.js` can be exercised without leaving
  the editor.

Write your manifest normally. Unknown keys are preserved, `formatVersion`
gates the format, and `builder.formatVersion` lets a future package state what
it needs — so a package authored today keeps working.
