# 0050 — Theme package format (declarative phase one)

- **Status:** Accepted
- **Date:** 2026-09-21
- **Issue:** [#107](https://github.com/dobrerares/student-org-site-builder/issues/107)

## Context

[ADR 0046](0046-trusted-executable-theme-and-block-extensions.md) settled the
extension _boundary_: extensions are trusted, Themes control the page shell,
may use arbitrary CSS and packaged fonts, may offer named Block design
variants, and may eventually ship JavaScript. It did not say what a Theme
_is_ as a file you can send someone.

Issue #107 asks for that distribution contract: package identity and
versions, the manifest and its supported files, bundled assets and fonts,
compatibility declarations, validation and rejection behaviour, and exactly
what a standalone export contains so that no Site content leaks into it.

Before this ADR, a Theme was not a file at all. It was a TypeScript module
compiled into `@sosb/renderer`, selected by a string id through an `if`
chain. Adding a Theme meant shipping a new build of the builder.

Two constraints shape everything below. Rendering must work offline and
identically in browser preview and in Electron/export (ADR 0046, ADR 0032).
And the eventual phase two — Custom Blocks with executable rendering code,
per the [issue-106 plan](../plans/issue-106-custom-block-contract.md) — must
not require a format break that invalidates Themes authored today.

## Decision

A **Theme package** is a `.sosb-theme.zip` archive, or an equivalent plain
directory, containing:

```
theme.json          # manifest (required, at the root)
theme.css           # stylesheet named by the manifest
fonts/*.woff2       # packaged font files, declared in the manifest
assets/*            # decorative files the CSS references relatively
README.md, LICENSE  # carried verbatim, ignored by the loader
```

The directory form is a first-class equivalent, not a convenience: it lets a
developer iterate without re-zipping, and it lets a package live in a
repository as reviewable source (see `examples/themes/practice/`).

**Phase one is declarative.** A package contains no executable code. "Install
a Theme" therefore cannot yet mean "run a stranger's JavaScript", even though
ADR 0046 permits that eventually for trusted extensions.

### Manifest

`theme.json` carries `formatVersion: 1`, a namespaced `id`, `name`, semver
`version`, a `builder` compatibility block, `description`, `author`,
`license`, `supports`, baseline `tokens` / `cssTokens`, `variants` (per Block
type) and `shellVariants`, `fonts[]`, and the `css` entry filename.

The manifest deliberately carries **no preview metadata** — no swatches, no
sample words, no thumbnail. The pickers render a real miniature of the Theme
instead (the renderer's own output, so it cannot drift), which is the same
decision #116 made when it deleted the built-in themes' hand-written swatches.
A package that still ships a `preview` block parses and is ignored, because
the manifest is a loose object. The authoritative field-by-field reference is
[`docs/how-to-author-a-theme.md`](../how-to-author-a-theme.md); duplicating it
here would guarantee the two drift.

Package **ids are namespaced** (`org.example.practice`): two or more
dot-separated lowercase segments. A namespace is what stops two unrelated
developers both shipping `dark` and colliding inside one Site's `themes/`
directory. The character set is restricted so an id is simultaneously safe as
a filesystem path, a zip entry name, a CSS attribute value and a URL segment,
with no escaping anywhere.

### Addressing designs from CSS

Block variants are addressed as `[data-block="hero"][data-variant="split"]`
and page-shell variants via `[data-shell-variant="compact"]` on `<body>`.
Both attributes are emitted only when the _active_ Theme actually offers that
variant, so a selection left over from another Theme cannot leak a dangling
attribute into the output.

### Asset references

A package's CSS references its own files relatively (`url(assets/grid.svg)`).
The renderer rewrites those onto the canonical path
`assets/theme/<id>/assets/grid.svg` and resolves them through the existing
asset seam: a relative path in a build, a `blob:` URL in the editor preview.
Packaged fonts are emitted at `assets/theme/<id>/fonts/...` by the same rule.
One canonical path, two resolutions — which is what makes preview/export
parity a property of the code rather than a convention someone must remember.

### Validation and rejection

Loading a package is all-or-nothing. Every rejection carries a stable code —
`manifest-missing`, `manifest-invalid`, `format-version-unsupported`,
`file-missing`, `path-unsafe`, `css-unsafe`, `package-too-large` — plus a
developer-facing message naming the offending field or file.

Rejecting loudly is the point. A half-loaded Theme, one whose font file was
missing or whose CSS rule was dropped, renders a site that looks _nearly_
right, and that is the hardest kind of defect for a non-technical author to
notice, let alone report.

**Offline is enforced, not documented.** Remote `@import`, `url(http…)`,
protocol-relative `url(//…)`, absolute `url(/…)` and package-escaping
`url(../…)` are all rejected at import time. ADR 0046 explicitly requires the
builder to enforce rendering access limits rather than trust authors to
follow documentation; this is that enforcement for the declarative phase. A
stylesheet that fetches something makes the rendered page a function of the
network, so the same Site renders differently on a train than in the office,
and an archived Site decays as third-party URLs rot.

The check is a conservative scanner rather than a full CSS parser. The two
failure modes point in opposite directions: a scanner's mistake rejects a
package the author can trivially reword, whereas a parser's mistake ships a
network request we promised would not exist. We take the noisy side.
Everything rejected has a local equivalent — bundle the font, bundle the
image.

### Standalone export excludes Site content structurally

Exporting a Theme writes back the files the _package_ was loaded from. That
map never contained Site content, so there is no filter to get wrong and no
code path that could sweep `data.json` or an author's uploads into a Theme
export. Export is byte-deterministic, so two developers can diff a package.

### Forward compatibility with phase two

Three properties let a phase-two package (with `render.js`, `public.js` and
`blocks/`) arrive without a format break:

1. `formatVersion` is an exact literal, and it is checked _before_ the rest of
   the schema. A future package gets "this Theme needs a newer builder" rather
   than a wall of field-level errors about keys this builder never heard of.
2. Every manifest object is a _loose_ object. Unknown keys parse and are
   preserved, matching the Site schema's preserve-unknown-keys rule
   (ADR 0002). A phase-two package therefore still loads here, minus the
   behaviour this builder cannot provide.
3. `builder.formatVersion` lets a package state which builder format it needs,
   independently of the manifest format it is written in.

`ThemeBundle` (ADR 0052) is an interface, so adding render hooks to it is an
additive change.

## Rationale

**Why zip rather than a single file or npm?** The builder already has a
deterministic zip layer (`@sosb/vfs`'s `ZipDriver`, ADR 0003) with entry-count
and size limits for untrusted input, and Theme packages get those limits for
free. A single file cannot carry woff2 binaries without base64 bloat. npm
requires a network and a registry, which the offline guarantee forbids.

**Why declarative first?** Executable rendering code needs an enforcement
mechanism for ADR 0046's access limits, which is real work and a real attack
surface. Every requirement in issue #104's design reference that this
milestone targets — responsive nav, decorative hero, card grids, image/text
sections, accordions, news/events, partner groups — is reachable with CSS and
variants over the existing Blocks. Shipping the distribution, lifecycle and
rendering seams against a declarative payload first means phase two adds one
thing rather than five.

**Why a size ceiling?** A Theme is CSS, a few subset woff2 files and some
decorative SVG. Anything past ~12 MB unpacked is either a mistake (an
un-subsetted family, a raw photo library) or something that will bloat every
Site archive that carries it.

## Consequences

- Themes become data. A developer can ship one without shipping a builder.
- Every Theme package added to a Site enlarges its editable archive, which is
  the price of the offline hand-off guarantee.
- The offline scanner will occasionally reject CSS that would have been
  harmless. The fix is always local and always documented.
- Built-in Themes keep their existing restrictions (ADR 0021's token-only
  styling, the script budget). The relaxation applies to packages.

## Alternatives considered

- **Inline the Theme into `data.json`.** Rejected: a Theme must be shareable
  _without_ Site content (issue #104), and binary fonts do not belong in the
  Site document.
- **Allow remote fonts with a documented caveat.** Rejected: it breaks the
  offline guarantee and makes preview/export parity depend on the network,
  and ADR 0046 requires enforcement rather than documentation.
- **A full CSS parser for the safety check.** Deferred: more precision than
  the problem needs, with a worse failure mode.
- **Per-Theme JavaScript in phase one.** Deferred to phase two with Custom
  Blocks, where the sandboxing question has to be answered anyway.

## Out of scope

- Executable rendering code, Custom Blocks with declared fields, interactive
  preview mode and public-site scripts — all phase two.
- Visual Theme creation for non-technical authors (issue #104 defers it).
- Importing WordPress or other platforms' themes.
