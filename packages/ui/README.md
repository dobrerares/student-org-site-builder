# @sosb/ui

Shared builder controls and the builder stylesheet. shadcn-style React
components built on [Base UI](https://base-ui.com) primitives, used by
`@sosb/editor-app`, `@sosb/wizard` and `@sosb/browser-shell`'s welcome
interface.

## Boundaries

- **Builder only.** Nothing here may reach public-site output. `@sosb/build`
  and `@sosb/renderer` must not depend on this package, and
  `packages/build/test/no-builder-css.test.ts` enforces both halves of that:
  no builder marker in any emitted file, no builder dependency declared.
- **Presentation only.** No Site awareness, no schema knowledge. Site-aware
  adapters and the ADR 0043 schema-form overrides stay in `@sosb/editor-app`.
- **Offline.** No network at runtime: no web fonts fetched, no icon CDN, no
  telemetry. The compiled stylesheet travels as bytes inside the bundle.

## Surface

- `<Button variant size>` — `primary` / `secondary` / `outline` / `ghost` /
  `destructive`, sizes `sm` / `md` / `lg` / `icon`. Defaults to
  `type="button"`.
- `<Input>`, `<Textarea>`, `<NativeSelect>` — the native elements. `<Input>`
  is type-aware: text chrome for text entry, nothing but the shared
  focus/disabled treatment for `checkbox`, `radio`, `color`, `file`, `range`.
- `<Label>`, `<Hint>` — the two text parts of a field.
- `Dialog`, `Popover`, `Select`, `Tabs`, `Toast` — Base UI compositions,
  exported as part objects (`Dialog.Root`, `Dialog.Popup`, …).
- `cn(...)` — the shadcn class merger (`clsx` + `tailwind-merge`).

Every wrapper renders the underlying element and forwards every prop, so the
`data-*` hooks the builder's stylesheets and tests hang off survive. Native
file inputs stay native (ADR 0044).

## Styling

Source: `src/styles/builder.css` (Tailwind v4).
Committed artifacts: `src/styles/builder.generated.css` and its string
mirror `src/styles/builder-css.generated.ts`.

Two deliberate choices:

- **No Tailwind preflight.** The editor and welcome shells still carry their
  own hand-written stylesheets; a global reset would restyle every existing
  surface. Instead the package ships a reset scoped to `data-sosb-ui`, an
  attribute only its own controls carry.
- **Everything is layered.** All rules live in a cascade layer (theme, base,
  components, utilities). `editor-app-css.ts` and `welcome-shell-css.ts` are
  unlayered and therefore outrank them, so adopting a shared control cannot
  regress a surface that already had an opinion.

The font stack names Inter first but ships no font file. Inter's bytes come
from `@sosb/renderer`'s registry via `@sosb/editor-app/src/editor-fonts.ts`;
without it the stack falls back to the system sans.

### Consuming the styles

```ts
import "@sosb/ui/styles.css"; // bundlers that handle CSS
```

```ts
import { injectBuilderCss } from "@sosb/ui/css"; // hosts with no CSS pipeline
```

The archival build uses the first (its esbuild pass collects the CSS output
and inlines it); the Vite dev entry and the e2e entries use the second,
because those bundles run through an esbuild call with no output path, which
rejects CSS imports.

### Regenerating

```sh
pnpm --filter @sosb/ui run build:css       # rewrite both artifacts
node packages/ui/scripts/build-css.mjs --check   # verify, write nothing
```

`builder.css` `@source`s the `src` trees of `editor-app`, `wizard` and
`browser-shell`, so **adding or renaming a Tailwind class in any of those
packages changes this output**. `test/generated-css-sync.test.ts` runs the
check, so stale artifacts fail CI rather than shipping an unstyled control.

See ADR-0049 for the React/Preact boundary and why Base UI rather than Radix.
