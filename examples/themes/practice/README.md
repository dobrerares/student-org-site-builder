# Practice — example Theme package

A complete, CI-covered Theme package. It is the reference implementation for
[`docs/how-to-author-a-theme.md`](../../../docs/how-to-author-a-theme.md) and
the working proof that the format in
[ADR 0050](../../../docs/adr/0050-theme-package-format.md) composes end to
end.

Copy this directory as the starting point for a real Theme.

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
  toggle. A phase-one Theme has no JavaScript, so at phone width the nav wraps
  to a stacked list instead. Every destination stays reachable, which a
  toggle that cannot open would not manage. Phase two can add the toggle.

## Contents

```
theme.json   manifest: tokens, fonts, variants, shell variants, preview
theme.css    the stylesheet (~14 KB)
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

## Using it

In the editor: **Theme settings → Theme packages → Import**, after exporting
this directory as a `.sosb-theme.zip`.

In code:

```ts
import { loadThemePackageFromDirectory } from "@sosb/theme-package/node";
import { renderSite } from "@sosb/renderer";

const { bundle } = loadThemePackageFromDirectory("examples/themes/practice");
const html = renderSite(site, bundle.id, { theme: bundle });
```

## Tests

Covered by `packages/theme-package/test/`:

- `example-practice.test.ts` — loads and validates the package, renders every
  page of the HISTORIPOL sample Site, checks `build()` emits its fonts and
  assets, and round-trips it through a `.sosb-theme.zip`.
- `example-practice-a11y.test.ts` — runs axe over every page and every shell
  variant, asserting this Theme introduces no violation a built-in Theme does
  not already produce on the same content.
- `preview-build-parity.test.ts` — asserts the editor preview and the build
  produce identical HTML modulo asset-URL rewriting.

## Licence

The Theme's CSS and manifest are MIT, with the repository. The bundled fonts
are **SIL Open Font License 1.1**: Archivo (Omnibus-Type) and Inter (Rasmus
Andersson). Redistributing this package redistributes those fonts under the
OFL; keep the notice.
