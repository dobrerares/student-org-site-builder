# 0006 — imageGallery block and vanilla-JS lightbox

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #14

## Context

Issue #14 asks for the `imageGallery` block: a schema-defined image grid
with optional click-to-enlarge lightbox UI. The PRD pins:

- semantic gallery markup with mandatory alt text on every image,
- grid and masonry layouts with a column count,
- an optional lightbox supporting fullscreen viewing, keyboard navigation,
  and focus management,
- the lightbox must ship as vanilla JS (no client framework) per the
  renderer's no-runtime contract from #46 / ADR 0003,
- a JS budget of "≤ 3kb minified" for the lightbox,
- axe-core clean output in both the closed and open lightbox states.

The block stacks on top of:

- `@sosb/schema` (#3) — adds a registered block schema and a validation
  rule branch.
- `@sosb/renderer` (#46, ADR 0003) — adds a Preact block component that
  emits semantic HTML, plus a page-global lightbox dialog scaffold and
  the inline JS bootstrap.
- `@sosb/assets` (#8, ADR 0004) — gallery images carry an `AssetRef` from
  the asset pipeline. The schema mirrors the `AssetRef` shape rather than
  taking a runtime dep on `@sosb/assets` (the schema package is the
  lowest-level workspace and importing assets would invert the dependency
  direction).

The PRD does not pin: the column-count bounds, where the lightbox JS lives
in the renderer, how multiple galleries on a page share one dialog, the
exact data attributes the script binds to, or how to enforce the 3kb
budget. This ADR records those choices.

## Decision

### Block schema shape

```ts
ImageGalleryDataSchema = {
  title?: string,
  layout: "grid" | "masonry",
  columns: 1..6,
  lightbox: boolean,
  images: { asset: AssetRef, caption?: string, alt: string }[],
};
```

`alt` is mandatory at the schema level (`min(1)` + non-whitespace
refinement), so a malformed gallery surfaces an `error` from `validate()`
without the editor having to layer a separate rule. The `1..6` columns
bound is sensible because narrower than 1 makes no sense and wider than 6
does not survive the PRD's mobile-first responsive breakpoints.

The schema mirrors `AssetRef` from `@sosb/assets` as `AssetRefSchema`.
Both shapes are `looseObject`-typed so unknown future fields round-trip,
matching the v1 forward-compatibility contract.

### Lightbox is one dialog per page, not one per gallery

A single `[data-sosb-lightbox]` `role="dialog"` scaffold is rendered into
the page footer when at least one gallery has `lightbox: true`. Multiple
galleries on the same page share that dialog: each `<button
data-sosb-lightbox-open>` carries `data-gallery="<block id>"` and
`data-index`, and the script keys navigation off those attributes. This
keeps the rendered HTML small, avoids rendering N modal dialogs that all
do the same thing, and means the inline JS ships exactly once per page.

### The lightbox JS is a hand-minified IIFE in `lightbox-script.ts`

Two strings live in `packages/renderer/src/lightbox-script.ts`:

- `LIGHTBOX_SCRIPT_SOURCE` — readable, formatted source. Authored
  alongside the minified counterpart for review.
- `LIGHTBOX_SCRIPT` — hand-minified IIFE. The renderer ships this string
  verbatim inside an inline `<script data-sosb-lightbox-script>` tag.
  The byte budget AC is verified against this constant.

Hand-minifying rather than running a bundler at build time keeps the
renderer's "pure data-in / string-out function" property. There is no
build step that depends on filesystem access, no temp files, no per-
build divergence between Node and browser environments. The renderer
remains determinism-safe: every call to `renderSite(data, themeId)` ships
the same byte payload, including the same script bytes.

Trade-off: any future edit to the lightbox behaviour requires re-minifying
both strings in lockstep. The two are kept short (~2.5 kb minified) and
the test budget enforces the 3kb cap; if the script grows we can switch
to esbuild's minifier at that point. Today the cost is one PR-time
duplicated edit per behaviour change.

The script binds via DOM data attributes only. It never embeds user
strings, asset URLs, or schema values. This makes the inline-script
content a renderer-owned constant safe to inject as `__html` (security-
equivalent to the existing inline `<style>` element).

### Trigger-side data attributes

Each gallery image inside the rendered HTML emits a `<button
data-sosb-lightbox-open>` carrying:

- `data-gallery` — the block id, partitioning triggers across galleries.
- `data-index` — numeric position within the gallery (used to sort
  triggers so DOM order doesn't matter).
- `data-src` — the asset URL (`AssetRef.path`).
- `data-alt` — the image's `alt` text (required).
- `data-caption` — the optional caption (empty string when absent).

The script reads these attributes when opening the dialog and when
stepping (ArrowLeft / ArrowRight / prev / next button).

### Naming separation: dialog vs script

Initial implementation marked both the dialog and the inline script with
`data-sosb-lightbox`, which made the script tag a CSS / JS click-through
target inside the test page (Playwright reported the script intercepting
clicks). The decision: dialog stays `data-sosb-lightbox`, the script tag
gets `data-sosb-lightbox-script`. The triggers stay
`data-sosb-lightbox-open`. The three attribute names are now mutually
exclusive prefixes.

### Focus management

The script:

1. Stores the trigger element when opening, returns focus to it on close.
2. Moves focus to the first focusable element inside the dialog when
   opening.
3. On `Tab` / `Shift+Tab` while open, wraps focus among the dialog's
   focusable elements (lightweight focus trap; we deliberately do _not_
   use `inert` because Safari 15.4's support is partial — the v1 floor).
4. Esc / close-button / backdrop click closes.

The dialog has `role="dialog"`, `aria-modal="true"`, and an `aria-label`
("Image preview"). Each trigger has a generated `aria-label` ("Open image
N" or "Open image N: <caption>") so the button name passes axe-core
without relying on visible text.

### Axe-core verification surface

Two layers cover the AC:

- **vitest + jsdom** (`packages/renderer/test/image-gallery-accessibility
  .test.ts`) — both closed and open states. Colour-contrast is disabled
  (jsdom doesn't compute styles); structural rules — alt text presence,
  dialog role, modal state, button name, label association — are all
  exercised here.
- **Playwright + real Chromium** (`e2e/lightbox.spec.ts`) — the open
  lightbox is scanned with axe-core injected via `addScriptTag`. This
  catches anything jsdom misses (real layout, real focus visibility),
  same approach the renderer-parity spec already uses. axe-core is
  resolved via `require.resolve("axe-core/axe.min.js", { paths: [<
  renderer-package> ] })` because it is a renderer-side dep, not a root
  workspace dep.

### Test fixture and golden file

A new `packages/renderer/test/fixtures/image-gallery-only.json` covers
title-on grid layout with caption / no-caption mix, JPEG and PNG output
mimes, and Romanian diacritic alt text. The fixture is consumed by
`renderSite(...)` for: structural tests, lightbox jsdom tests, axe tests,
the new stub-theme golden file at `__golden__/stub-theme-image-gallery.html`,
and the Playwright e2e.

The Academic-theme imageGallery golden file (PRD's 15 × 5 matrix) is
owned by #47 — this issue ships the stub-theme equivalent so the
regression net catches every renderer-side change.

## Rationale

### Why mirror `AssetRef` in the schema instead of importing `@sosb/assets`?

`@sosb/schema` is the lowest-level workspace and is a runtime dep of
every other package. Importing `@sosb/assets` would create a cycle once
the asset pipeline grows to consume schemas (e.g. for #21
documentDownloads). Mirroring the type costs a small duplication today,
prevents a topology problem tomorrow.

The mirror is loose (`looseObject` over the AssetRef shape), so unknown
future fields on `AssetRef` survive round-trip even if they are added in
`@sosb/assets` first.

### Why one dialog per page rather than one per gallery?

Per the PRD's performance budget (HTML <=50kb / JS <=10kb total per
page), duplicating dialog markup per gallery is wasteful — even three
galleries times the dialog scaffold is several KB. The shared-dialog
model also maps cleanly onto a single focus-trap state machine in the
script: without sharing, the script would need to track per-gallery
state and the ARIA model would have to handle multiple modals competing
for focus.

### Why hand-minify rather than build-time minify?

The renderer's contract from ADR 0003 is "pure function data-in /
string-out, byte-identical between Node and browser". A build-time
minify step would either run during package build (couples the renderer
to a build pipeline) or during render (introduces non-determinism if the
minifier output drifts across versions). Hand-minifying ships the same
bytes from every renderer invocation, which is the only way to keep the
parity test passing.

The pre-minified payload also makes the byte-budget AC trivially
verifiable: the test reads the inline script content out of the rendered
HTML, encodes it with `TextEncoder`, and asserts the byte length under
3072. No tooling involved.

### Why `data-sosb-` prefix on every attribute?

Consistency with the existing renderer convention (`data-block`,
`data-block-id`, `data-layout`). Theme CSS is allowed to read these for
layout / styling hooks, so they are part of the public surface; the
`sosb` prefix makes them unambiguously renderer-owned and reduces the
chance of clash with theme-author CSS later.

### Why a refinement on `alt` rather than a `min(1)` alone?

`min(1)` rejects empty strings but accepts whitespace-only ones (`"   "`
is length 3). The PRD's accessibility commitment says "Mandatory alt
text on all image-bearing blocks", which a whitespace-only string fails.
The refinement closes that gap.

## Consequences

- `KnownBlockSchemas` now has two entries (`hero`, `imageGallery`).
  `runBlockRules` uses a distributive mapped type (`KnownBlockUnion`) to
  preserve the discriminated union of block shapes; the previous
  `z.infer<KnownBlockSchemas[keyof ...]>` collapsed to `never` once a
  second block was added.
- `zodIssuesToErrors` was widened to `ZodSafeParseResult<unknown>` so it
  accepts the union return type from `KnownBlockSchemas[block.type]
  .safeParse(data)` without per-call casts.
- `migrateBlock` registers `imageGallery: 1`. Future imageGallery schema
  bumps land in #26 and add to `BLOCK_MIGRATIONS`.
- The stub theme picks up `imageGallery` and `[data-sosb-lightbox]`
  layout-only CSS (still 100 % `var(--token)` references — no raw
  hex/rgb leaks). The hero-only golden file picked up the new CSS rules
  on the same render pass, so the existing golden snapshot was updated
  in lockstep.
- The build pipeline (`@sosb/build`) is unchanged: `build()` still
  delegates to `renderSite()`, and the new lightbox JS travels through
  unchanged.
- The editor app's form-generator carve-out for blocks (the spine-form
  renders only site spine fields today, per #7's contract) is
  unchanged; per-block forms are still owned by future issues. Schema-
  level alt enforcement satisfies the AC's "Editor enforces alt text on
  every image (validation error if missing)" because `validateBlock`
  surfaces a hard `error` for any image with empty / missing alt, and
  that result is what the editor's validation panel will surface
  whenever it is wired (#27 / future block-form issues).

## Alternatives considered

- **One dialog per gallery** — see Rationale; rejected on size and
  focus-management grounds.
- **Build-time minify with esbuild** — keeps source readable but breaks
  determinism unless we pin esbuild's minifier output, which we cannot
  do across patch versions. Hand-minify is the honest answer for v1's
  small script.
- **`<dialog>` element instead of `<div role="dialog">`** — the native
  `<dialog>` element's `showModal()` API is appealing but the focus-trap
  semantics are not yet uniform across browsers (Safari 15.4 — v1's
  floor — has partial support). The `<div role="dialog">` form gives us
  identical ARIA semantics with full control over focus management,
  which the AC requires.
- **Inline JS injected via `__html` on every page that has any block** —
  would simplify the conditional rendering branch, but ships bytes the
  page does not need (PRD performance budget).
- **`AssetRef` as a runtime import from `@sosb/assets`** — see Rationale;
  rejected on dependency-direction grounds.
- **Captions duplicated as both `<figcaption>` and dialog caption** —
  would let the dialog reuse the same DOM node. Rejected: the dialog is
  page-global, copying caption text via the script is cheaper than
  cloning DOM nodes that may be deeper than the trigger.

## Out of scope

- Slideshow / autoplay / timed transitions in the lightbox (per the
  issue's out-of-scope).
- Video / audio assets in galleries (per PRD).
- Editor-side per-image cropping / focus-point UI (asset pipeline #8
  handles output variants; per-image editor controls would be a future
  feature on top of the form generator).
- Caption translation / i18n — strings live with the block data in v1
  (per PRD).
- Editor-form support for the imageGallery (block forms are owned by
  the per-block issues #9-#22; this issue ships the schema, the
  renderer, and the lightbox JS).
- The Academic-theme imageGallery golden file (#47).
