# @sosb/renderer

Pure function from `(siteData, themeId)` to HTML. The same code runs at
build time (Node) and in the editor preview iframe (browser), and produces
byte-identical output in both.

```ts
import { renderSite } from "@sosb/renderer";

const html = renderSite(siteData, "stub");
// returns a complete HTML document string starting with `<!doctype html>`.
```

## Determinism contract

- Identical `(data, themeId, opts)` input produces identical output, byte
  for byte.
- The render path uses no `Date.now()`, `Math.random()`,
  `crypto.randomUUID()`, or `performance.now()`.
- IDs that surface in the output (e.g. `aria-labelledby` targets) are
  derived deterministically from schema-supplied block IDs.

## Tokens as CSS custom properties

The renderer emits a single inline `<style>` element in `<head>` with:

1. A `:root { ... }` rule declaring baseline tokens followed by any user
   theme overrides (`site.theme.tokens`). Later wins.
2. The active theme's layout-only CSS, where every value is either a
   structural primitive or a `var(--token)` reference.

The test suite asserts no raw hex / rgb leaks outside `:root`.

## No client-side runtime

Built sites contain no Preact / React runtime. Preact is used purely as the
build-time template language via `preact-render-to-string`.

## Forward-compat

Hero block data is consumed tolerantly: optional fields are conditionally
rendered, unknown fields on `data` are ignored without throwing. Unknown
block types render as `<!-- unknown block: <type> -->` HTML comments to
satisfy the v1.x preserve-unknown-keys contract.

## Architecture

See [`docs/adr/0003-renderer-skeleton-and-determinism.md`](../../docs/adr/0003-renderer-skeleton-and-determinism.md)
for the design decisions behind this package.

Tracking issue: #46.
