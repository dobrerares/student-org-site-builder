# 0003 — Renderer skeleton, tokens emission, and Node-vs-browser parity

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #46

## Context

Issue #46 is the infrastructure half of the renderer (split from the original
#4; the visual half — the Academic theme — is #47). It asks for:

- a pure function `renderSite(data, themeId, opts?) -> string` returning a
  full HTML document,
- built on Preact + `preact-render-to-string`,
- a page shell with `<html>`, `<head>` (basic SEO meta), `<body>`,
- a structural hero block (semantic markup, ARIA, no design opinions),
- tokens emitted as CSS custom properties on `:root`, with per-block styles
  consuming them via `var(--token)` (no hardcoded hex/rgb anywhere outside
  `:root`),
- the same code path running in Node (build) and browser (editor preview),
  producing byte-identical output,
- a golden-file test framework wired up against a placeholder/stub theme,
- axe-core clean output on the hero-only sample with the stub theme,
- no Preact / React runtime in shipped output — static HTML + CSS only.

The PRD pins the broad strokes (Preact-based renderer, tokens-as-CSS-vars,
no client framework on built sites) but is silent on the specific renderer
seams: Preact reconciler choice, golden-file diff format, CSS-emission
strategy, how Node and browser stay byte-identical. This ADR records those
choices.

## Decision

### Reconciler / template language: **Preact + `preact-render-to-string`**

Per the PRD. We use Preact's JSX (`@jsxImportSource preact`) to author the
page shell and block components and `preact-render-to-string`'s `render()`
to serialise them. Preact is purely the _template language_: it does not
ship to end-user sites. Preact's renderToString is deterministic by design
(no IDs, no timestamps), which is what the determinism AC requires.

Rejected: hand-rolled string templating (more error-prone for HTML
escaping), `lit-html` server (heavier runtime, less Preact-aligned with the
editor preview iframe), React + react-dom/server (doubles the bundle of the
editor preview and brings React baggage we do not need).

### CSS emission strategy: **tokens-as-CSS-custom-properties on `:root`**

The renderer emits a single inline `<style>` element in `<head>` containing:

1. A `:root { ... }` rule declaring the full token set. Order is
   deterministic: a baseline set of tokens (spacing scale, default radius,
   default colour palette) is emitted first, then schema-provided overrides
   from `site.theme.tokens` are appended. Later wins (standard CSS), so
   user-customised tokens override baselines without us having to compare /
   filter at emission time. The duplicates are by design and cost a few
   bytes; the alternative — filtering — would couple the baseline list to
   the schema's token list at the wrong layer.
2. The active theme's layout-only CSS, where every value is either a
   structural primitive (`display: block`, `box-sizing: border-box`,
   numeric units) or a `var(--token)` reference. The test suite asserts
   no raw hex / rgb leaks outside `:root` (the only place those values
   legitimately appear, since `:root` is where they are _defined_).

Rejected: an external `.css` file (the build pipeline #5 emits HTML+CSS
together in a single file per page; for the renderer's contract, "produce
the HTML document including its CSS" is what matches), CSS-in-JS at runtime
(would require shipping a runtime to end-user sites, violating the
no-framework-in-output AC), Tailwind-style atomic classes (premature; a
later ADR may revisit if bundle size becomes an issue).

### Node-vs-browser parity: **single TS source bundled per target, byte-equality asserted**

The same `index.tsx` is the entry for both environments. Node and browser
diverge only in the bundler's platform target:

- **Node tests** (vitest) import the source directly via the workspace.
- **Browser tests** (Playwright) bundle the source for the browser via
  esbuild (`platform: "browser"`, `format: "esm"`, JSX automatic, Preact
  import source) and inject the bundle into a real headless Chromium page
  via `page.addScriptTag({ type: "module", content: bundle })`.
- The Playwright spec also bundles the source for Node (`platform: "node"`)
  and dynamically imports the bundle, so both the Node string and the
  browser string come from a _bundled_ artifact — eliminating any drift
  caused by Vitest's transform versus esbuild's. This catches code paths
  that accidentally take a hard dependency on Node-only built-ins
  (`process`, `Buffer`) or browser-only APIs (`document`, `window`).

The renderer code itself touches **no environment globals** (no `process`,
no `document`, no `window`, no `Buffer`, no Node `os`/`fs`/`path`). It is a
pure data-in / string-out function. Determinism follows from this:

- No `Date.now()`, no `Math.random()`, no `crypto.randomUUID()`, no
  `performance.now()` — the test suite asserts repeated calls produce
  byte-identical output, which would surface any of these.
- IDs in the output (e.g. `<h1 id="blk_home_hero__title">` for the
  hero's `aria-labelledby`) are derived deterministically from
  schema-supplied block IDs.
- Forward-compatible field handling: `HeroBlock` data is consumed
  tolerantly via `typeof === "string"` checks rather than positional
  destructuring, so an optional field added in #26 (e.g. `subtitle`) does
  not blow the renderer up. Unknown block types render as
  `<!-- unknown block: <type> -->` HTML comments, matching the PRD's
  preserve-unknown-keys policy for built sites.

### Golden-file test framework: **`vitest`'s `toMatchFileSnapshot`**

Vitest 2 ships a `toMatchFileSnapshot` assertion that writes the snapshot
to a sibling file on first run and diffs against it on every subsequent
run. We use it for the stub-theme hero golden, with the file living at
`packages/renderer/test/__golden__/stub-theme-hero.html`. Per-block /
per-theme golden files (the 15 × 5 matrix from the PRD) land per their
respective issues (#9–#22 for blocks, #28–#31 + #47 for themes); this
package only ships the one stub-theme snapshot today, as the AC requires.

The golden directory is added to `.prettierignore` because the snapshot is
a byte-exact capture of the renderer's own output; reformatting it would
invalidate the regression contract.

Rejected: Jest's `toMatchInlineSnapshot` (vitest's analog couples the
snapshot to the source file in a way that hurts review diffs for HTML),
Insta-style external tools (over-engineered for a 1-block matrix today;
revisit if golden-file maintenance becomes a chore at scale).

### Stub theme

A deliberately minimal theme that exists purely to exercise the renderer
framework. It contributes layout-only CSS (`box-sizing`, `margin`,
`display`, `padding`, `font-family`, `border-radius`) — no curated palette,
no per-theme hero variant, no opinionated typography. Five real themes
land later (#28–#31, #47).

### No Preact runtime in built output

`preact-render-to-string` returns a complete HTML string. The renderer
does not emit any `<script>` referencing Preact or React — verified by a
test that checks the output contains no such tags. The editor preview
iframe re-runs the renderer when data changes (rather than hydrating), so
the same "static HTML + CSS only" contract applies in the editor too. The
≤10 kb of vanilla JS the PRD allows for interactive blocks (lightbox,
accordion, eventList past-fade, mobile nav) is owned by the build pipeline
(#5) and the per-block components, not by this skeleton.

## Rationale

The most subtle requirement is byte-identical Node-vs-browser output.
Because Preact's renderer is deterministic and we forbid environment
globals, the only realistic source of drift is _transform divergence_ —
the Node-side typescript transform (vitest's esbuild) vs. the browser-side
TS-to-JS transform (some other esbuild or Vite pipeline). We pin the
transform to a single tool (esbuild) for the parity test by bundling for
both targets from the same source, and run the bundle in both
environments. This is heavier than just importing the TS source and
asserting equality, but it is the only way to get a binding contract on
"Node and browser produce the same string."

Tokens-as-CSS-custom-properties is the right seam because:

- Live token edits in the editor become a `style` element rewrite without a
  DOM rebuild (PRD: "live token edits update the iframe's style element
  without DOM rebuild").
- It naturally enforces "no hardcoded colours in per-block CSS" — block
  styles must reference tokens or fail review.
- It maps cleanly to the schema's token shape, with no transformation
  pipeline between schema and CSS.

## Consequences

- `pnpm -F @sosb/renderer add preact preact-render-to-string axe-core jsdom esbuild`
  is run inside the worktree. `esbuild` is also added at the repo root
  (alongside `@sosb/renderer` and `@sosb/schema`) so the e2e parity spec
  can `import { build } from "esbuild"` and bundle both targets.
- The renderer's `package.json` `main` and `types` point at `./src/index.tsx`.
  Other packages that consume the renderer at type-check time are unaffected
  because TypeScript resolves `.tsx` source through the same workspace
  symlinks the schema package uses.
- The Playwright config gains a `chromium` project so the e2e parity spec
  has a stable browser target; no other browser is needed for this AC.
- The golden-file directory is `packages/renderer/test/__golden__/`. The
  PRD's 15 × 5 matrix populates this directory across many issues; today
  only `stub-theme-hero.html` exists.
- The renderer trusts its input — callers must run `@sosb/schema`'s
  `validate(data)` before calling `renderSite`. The renderer does not
  re-validate; that is the build pipeline's (#5) responsibility.

## Alternatives considered

- **Vite SSR for the parity test** (instead of esbuild). Heavier (Vite
  spins up a dev server), and we do not need its plugin pipeline.
- **Render to a string and inject into a static HTML wrapper string**
  (skip Preact entirely for the shell, use Preact only for blocks). Would
  save a few bytes of bundled Preact code, but at the cost of two
  templating models in the same package. Not worth the split.
- **Use Preact Signals or hooks for token reactivity in the editor**.
  Out of scope for this issue; the editor's preview bridge (#7-related)
  decides how token edits propagate. The renderer remains a pure function.
- **Snapshot via a third-party lib** (`vitest-snapshot-serializer-html`,
  Insta-style). Premature for one snapshot; vitest's built-in is enough.

## Out of scope

- Per-theme curated golden files (Academic = #47, others = #28-#31).
- Block schemas / renderers beyond hero (#9-#22).
- The build pipeline (`(siteData) -> distFolder`), SEO sitemap, JSON-LD
  emission, per-page-budget verification — that is #5.
- Live token-edit propagation in the editor preview iframe — owned by the
  preview bridge (#7-related).
- Hydration / interactive-block JS (≤10 kb vanilla bundle) — owned by the
  build pipeline + per-block components.
