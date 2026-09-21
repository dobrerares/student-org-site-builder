# 0052 — The renderer theme seam (revises ADR 0021's rejection of runtime registration)

- **Status:** Accepted
- **Date:** 2026-09-21
- **Issue:** [#109](https://github.com/dobrerares/student-org-site-builder/issues/109)

## Context

Issue #109 asks how package resolution should feed schema validation, Block
editing, preview rendering, static builds and archived Sites _consistently_ —
the registration and loading seam, and the response to unsupported extensions.

Until now `renderSite(site, themeId)` chose a Theme with a compile-time `if`
chain over `themeId`, backed by `themeCssFor` and `themeBaselineTokensFor` in
`packages/renderer/src/index.tsx`. That made a Theme a _code_ artefact: you
could not render under a Theme the renderer had not been compiled with.

[ADR 0021](0021-modern-theme-palette-and-typography.md) rejected runtime theme
registration. That was the right call for its context — five curated built-in
Themes, where a registry is indirection without a payoff. Issue #104's user
decision to support developer-authored Themes removes that context, and
issue #104 explicitly flags ADR 0021's rejection for reconsideration.

The hard constraint: this change must not alter a single byte of built-in
Theme output. The renderer's golden-file matrix (ADR 0032) and the a11y matrix
(ADR 0026) are the project's regression contract.

## Decision

### `ThemeBundle` is the whole contract

A resolved Theme is data:

```
id, name, version, description, preview
origin: "builtin" | "package"
css, baselineTokens, defaults
supports: { colors, fonts, density, radius }
blockVariants: Record<blockType, ThemeVariant[]>
shellVariants: ThemeVariant[]
fontSource: { kind: "registry" } | { kind: "bundle", faces, bytes }
assets: Map<path, bytes>
```

`renderSite` accepts one via `RenderOptions.theme` and knows nothing else
about Themes.

**Built-in Themes are expressed as bundles too.** This is the load-bearing
decision. There is one code path, not a built-in path plus a custom path that
drift apart until someone notices that variants work in preview but not in
export. The built-in bundle table holds the same constants in the same
composition order as the old `if` chains, so built-in output is byte-identical
and the golden matrix is untouched — verified by the 673-test renderer suite
passing unchanged.

`KNOWN_THEME_IDS` stays. It is the a11y matrix's input (ADR 0026) and now
means "the Themes compiled into the builder", which is exactly the set that
matrix should iterate. An imported Theme cannot join it; packaged Themes that
ship in this repository get their own axe coverage.

### Resolution is the caller's job

`build()` takes `options.themes` and the editor passes the bundle it loaded
from the Site VFS. Neither the renderer nor the build pipeline reads a
filesystem or a VFS to find a Theme.

This keeps `build()` a pure, synchronous, browser-safe function — the
property ADR 0004 is built on — and keeps `renderSite` synchronous, which the
editor's `srcdoc` preview depends on. Loading is I/O and belongs to the layer
that already does I/O.

A Site naming a Theme that is neither built in nor supplied fails the build
with `BuildThemeMissingError` (ADR 0051). Rendering alone falls back to the
layout baseline so content stays visible.

### One canonical asset path, two resolutions

A packaged Theme's files are addressed as `assets/theme/<id>/...` everywhere.
The CSS's relative `url()` targets are rewritten onto that prefix and then run
through the existing `assetUrlForPath` seam: a relative path in a build, a
`blob:` URL in preview. `build()` writes the bytes at those paths; the editor
mints blobs keyed by them.

Preview/export parity therefore falls out of the design rather than being
maintained by hand. The test asserts it directly: preview HTML equals build
HTML modulo asset-URL rewriting, and nothing else.

Built-in Themes skip the rewrite entirely — they carry no packaged assets —
which is part of why their bytes are unchanged.

### Fonts come from two sources, in a fixed order

`@font-face` rules are emitted from the compile-time registry first (gated to
the families the resolved tokens actually name — the existing built-in
behaviour, byte-for-byte), then from the bundle's packaged faces. Both halves
are sorted, so output stays deterministic.

A packaged Theme gets _both_, which is what makes `supports.fonts: true`
meaningful: the Theme's own display face plus whichever builder family the
author picked.

Only registry faces are `<link rel="preload">`ed. A package may bundle many
faces, and preloading all of them would spend the page's byte budget
(ADR 0033) before anything paints; `font-display: swap` already prevents
permanently invisible text.

### Variants are resolved centrally, emitted locally

The active variant is resolved in the page shell — a Block component has no
business knowing what a Theme is — but _emitted_ by the Block component,
because the component owns its root element and is the only thing that knows
which element that is. When no variant applies the attribute is omitted
entirely.

Emission is gated on the active Theme actually offering the variant, so a
stale selection cannot leak a dangling attribute.

## Rationale

ADR 0021's objection to runtime registration was that it buys nothing when
the Theme set is fixed and curated. It no longer is. Note what is _not_ being
revised: ADR 0021's styling discipline for built-in Themes (tokens on `:root`,
no raw colour outside the token block, the script budget) stands unchanged.
ADR 0046 already relaxed those for Custom Themes; this ADR only changes how a
Theme reaches the renderer.

Expressing built-ins as bundles rather than keeping a fast path for them is
the difference between a seam and a special case. A second path would be
exercised by every existing test while the custom path is exercised by a
handful — precisely the asymmetry that lets one rot.

## Consequences

- Rendering under an arbitrary Theme no longer requires rebuilding the
  builder.
- `usedFamiliesFor`, `fontPreloadHrefsFor` and `fontAssetsFor` now take a
  `ThemeBundle` instead of a theme id. `build()` was the only production
  caller.
- `RenderOptions.theme` throws when its id disagrees with `themeId`: two
  sources of truth for "which Theme is this?" is a caller bug, not something
  to paper over by preferring one.
- The Block envelope gains `variant`; `PageShell` threads it to every Block
  component. Sixteen components gained one optional prop.
- Phase two adds render hooks to `ThemeBundle` additively.

## Alternatives considered

- **Keep the `if` chain and special-case custom Themes.** Rejected: two code
  paths, unevenly exercised.
- **A mutable global theme registry.** Rejected: global mutable state in a
  function whose entire contract is determinism, and it would make render
  output depend on registration order.
- **Have the renderer load packages itself.** Rejected: makes `renderSite`
  async and drags I/O into a pure module.
- **Emit `data-variant` by cloning the rendered element in the page shell.**
  Attempted and rejected: the shell holds a _component_ vnode, so cloning adds
  a prop to the component rather than an attribute to its root element. The
  component must place its own attributes.
- **Wrap every Block in a variant-carrying `<div>`.** Rejected: changes markup
  for every Block under every Theme and breaks the golden matrix for no gain.

## Out of scope

- Executable rendering code and the sandbox that would police ADR 0046's
  access limits (phase two).
- Custom Block type registration feeding schema validation and editor forms —
  the issue-106 plan's contract, landing with phase two.
