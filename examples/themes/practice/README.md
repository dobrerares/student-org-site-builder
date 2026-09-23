# Practice — example Theme package

A complete, CI-covered Theme package. It is the reference implementation for
[`docs/how-to-author-a-theme.md`](../../../docs/how-to-author-a-theme.md) and
the working proof that the format in
[ADR 0050](../../../docs/adr/0050-theme-package-format.md) and the executable
design contract in
[ADR 0054](../../../docs/adr/0054-executable-theme-rendering-and-sandbox.md)
compose end to end.

Copy this directory as the starting point for a real Theme. Since 1.1.0 it
ships a `render.js` (an executable page shell and a hero override) and a
`public.js` (a phone navigation toggle and a sticky-header shrink). Delete
both and it is still a complete, declarative Theme.

## The design

A dark, high-contrast treatment for a student society: a deep navy ground,
pale gold accents, and very heavy grotesque headlines in uppercase.

It recreates the project's published design reference (the Figma Make mockup
linked from [ADR 0046](../../../docs/adr/0046-trusted-executable-theme-and-block-extensions.md))
as closely as CSS and design variants over the builder's **existing** Blocks
allow. The reference was inspected at desktop and phone widths; its palette
(`#0a0c39` ground, `#f6df82` accent, `#e63000` highlight), its Montserrat-900
display type and its section rhythm are reproduced here.

Two deliberate departures:

- **Type.** The reference uses Montserrat. This package ships **Archivo** at
  400/700/900 for display and **Inter** at 400/600 for text — both OFL, both
  already vendored in this repository, and Archivo at 900 is a close
  structural match for Montserrat Black. Keeping to fonts already present
  avoids adding a dependency just to make an example look right.
- **Navigation.** The reference collapses its phone navigation behind a
  toggle. This Theme does too, but honestly: `render.js` ships the menu
  button `hidden` and the list visible, and `public.js` reveals the button
  and marks the header so the stylesheet collapses the list only once the
  button exists. Without JavaScript the nav wraps to a stacked list and every
  destination stays reachable.

## The executable design

`render.js` runs in the builder's sandbox (no network, files, clock or
randomness; an instruction and memory budget) and returns element trees,
never HTML. It contributes:

- **A page shell** — a sticky header with the organisation's logo and
  wordmark, the navigation (with the phone-width menu button), the language
  switcher in the same row, and a quiet colophon under the author's footer
  Block with the name, tagline, the navigation once more and a "since" line
  from the founding year. Exactly one `["slot"]` marks where the builder
  places the page's Blocks. The **Standard** and **Compact** shell variants
  still apply through `[data-shell-variant]`; Compact drops the wordmark
  beside a logo.
- **A hero override.** The "Spotlight" variant gains concentric rings (inline
  SVG coloured by the accent token), a stepped title and a gold rule; the
  default and "Split" variants reproduce the built-in markup, so the
  phase-one stylesheet keeps working for them unchanged.

Everything visible comes from Site content, the builder's computed navigation
and URLs, or `input.t()` in the page's language. The colophon has no
copyright year on purpose: a design cannot read the clock, and a year baked in
at export would be wrong by the time anyone noticed.

`public.js` is ~1.5 KB, declares `network: []`, and is exempt from the
builder's script budget by rule rather than by size.

## Contents

```
theme.json   manifest: tokens, fonts, variants, shell variants, render, public
theme.css    the stylesheet (~18 KB)
render.js    the executable design: page shell + hero override (~7 KB)
public.js    the public-site script: nav toggle, sticky-header shrink (~1.5 KB)
fonts/       Archivo 400/700/900 and Inter 400/600, latin + latin-ext
assets/      grid.svg — the decorative background texture
screenshots/ desktop and phone captures of the sample Site
```

`latin-ext` is shipped for both families on purpose: Romanian needs `ș`, `ț`,
`ă`, `î` and `â`, and a Theme that ships only `latin` renders the
organisation's own name in a fallback font.

## What it demonstrates

- **Appearance controls.** Declares `colors: true`, `density: true` but
  `fonts: false` and `radius: false` — it has a fixed type pairing and sharp
  corners, so the editor hides those two controls with a note rather than
  offering settings the CSS overrides.
- **Block design variants** for `hero` (Spotlight / Split), `valueList`,
  `teamGrid`, `activitiesList`, `partnerLogos` and `ctaBanner`. Authors pick
  them from the Block Inspector's **Design** control.
- **Shell variants** — Standard and Compact — surfaced as **Header style**.
- **A packaged decorative asset.** `theme.css` references `assets/grid.svg`
  relatively; the builder rewrites it to
  `assets/theme/org.example.practice/assets/grid.svg` and resolves it to a
  real file on export and a `blob:` URL in preview.
- **An executable page shell and a Block override** in `render.js`, and a
  **public-site script** that degrades without JavaScript, declared with
  `network: []`.

## Using it

In the editor: **Theme settings → Theme packages → Import**, after exporting
this directory as a `.sosb-theme.zip`.

In code:

```ts
import { loadThemePackageFromDirectoryAsync } from "@sosb/theme-package/node";
import { renderSite } from "@sosb/renderer";

const { bundle } = await loadThemePackageFromDirectoryAsync("examples/themes/practice");
const html = renderSite(site, bundle.id, { theme: bundle });
```

The `Async` loader starts the render sandbox first; the package has a
`render.js`, so it cannot be loaded synchronously before that.

## Tests

Covered by `packages/theme-package/test/`:

- `example-practice.test.ts` — loads and validates the package, renders every
  page of the HISTORIPOL sample Site through the executable shell, checks
  `build()` emits its fonts, assets and `public.js` (and never `render.js`),
  that the public script stays out of the static preview and out of the
  script budget, that three separately loaded sandbox realms render the same
  bytes, and round-trips it through a `.sosb-theme.zip`.
- `example-practice-golden.test.ts` — pins the home page (Standard shell,
  Spotlight hero, script on) and the about page (Compact shell, script off)
  to golden files.
- `example-practice-a11y.test.ts` — runs axe over every page and every shell
  variant, asserting this Theme introduces no violation a built-in Theme does
  not already produce on the same content.
- `preview-build-parity.test.ts` — asserts the editor preview and the build
  produce identical HTML modulo asset-URL rewriting, with the public script
  on and off.

## Licence

The Theme's CSS and manifest are MIT, with the repository. The bundled fonts
are **SIL Open Font License 1.1**: Archivo (Omnibus-Type) and Inter (Rasmus
Andersson). Redistributing this package redistributes those fonts under the
OFL; keep the notice.
