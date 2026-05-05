# 0007 — FAQ block and native `<details>`-based accordion

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #18

## Context

Issue #18 asks for the `faq` block: a list of `{ question, answer }`
items rendered as a collapsible accordion. Per the PRD (user story #31
and Implementation Decisions → Block library), an FAQ on a student-org
site is a high-value section ("Cum mă pot înscrie?", "Care sunt
costurile?") and is one of three blocks that consume the markdown subset
from #9 (richText, faq, quote).

The acceptance criteria pin:

- Schema validates and renders end-to-end.
- Accordion accessible: keyboard navigable, screen-reader announces
  state, focus visible.
- Markdown in answers renders correctly (links, lists, formatting).
- First-open mode highlights the first item on initial render.
- Accordion JS under 2 kb minified.
- Golden-file test for faq × Academic theme (the stub-theme golden
  ships now; the Academic golden lands with #47).

The PRD does **not** pin:

- The accordion implementation strategy (`<details>`/`<summary>` vs.
  custom ARIA-tabs widget vs. third-party library).
- Whether the accordion is JS-required, JS-free, or progressively
  enhanced.
- The default open state when a page first loads (all-closed,
  first-open, all-open).
- How to integrate the markdown subset for answers — pass through
  `markdownToHtml` like richText, or render plain text only.

This ADR records those choices.

## Decision

### Native `<details>` / `<summary>`, progressively enhanced

The block emits a `<details>` per item, with the question text inside
`<summary>` and the markdown-rendered answer inside a sibling `<div
class="faq__answer">`. The accordion's *functionality* — expand,
collapse, keyboard activation, screen-reader announcement of expanded
state — comes for free from the browser's built-in handling of these
elements.

A small (~750 B minified) vanilla-JS module
(`packages/renderer/src/blocks/faq.script.ts`) is exported as a string
constant `FAQ_ACCORDION_SCRIPT_SOURCE`. The module is a *progressive
enhancement* that:

- Animates the open/close transition with a CSS height animation.
- Respects `prefers-reduced-motion: reduce` — under reduced motion the
  enhancement no-ops and the browser default instant toggle stands.
- Tags every enhanced element with `data-faq-enhanced="1"` so a second
  pass over the same DOM is a no-op (idempotency).

The script is a self-installing IIFE so it runs at parse time without
any caller boilerplate. The build pipeline (#5) will inline it once per
page that contains a faq block when block-aware JS injection lands;
until then, the constant is exported from `@sosb/renderer` for callers
(editor preview, e2e tests) to inject directly.

Rejected alternatives:

- **Custom ARIA-tabs / disclosure widget** (a `<button
  aria-expanded>` toggling a sibling `<div role="region">`). Equivalent
  semantics in theory, but requires every block's JS to manually wire
  up keyboard handlers, focus management, and `aria-expanded`
  state. Native `<details>` does all of that without code.
- **JS-required widget** (no fallback when JS is disabled). Rejected:
  the PRD's privacy positioning ("no third-party scripts, ≤10 kb total
  vanilla JS budget") and the accessibility commitment make a
  no-JS-required block a load-bearing property.
- **Third-party library** (e.g. `@reach/accordion`, headlessui). Adds
  install weight and a runtime dependency for behaviour the platform
  already provides.

### Schema shape

```ts
FaqDataSchema = z.looseObject({
  title: z.string().optional(),
  firstOpen: z.boolean().optional(),
  items: z.array(z.looseObject({
    question: z.string().min(1),
    answer: z.string(),
  })),
});
```

Mirrors hero / richText: `looseObject` for forward compatibility,
`z.literal("faq")` + `z.literal(1)` on the block envelope, registered
in `KnownBlockSchemas`. `validate()` adds two quality nudges:

- `block.faq.items.empty` — published FAQ with zero items is a content
  gap (warning, not error).
- `block.faq.item.answer.empty` — each item with an empty answer
  string is flagged (warning, not error).

Empty answers are accepted at the schema layer so partial drafts can
be saved.

### `firstOpen` semantics

- `firstOpen: true` → the first item renders with the `open` boolean
  attribute on `<details>`. The page lands with the first answer
  visible.
- `firstOpen: false` (or omitted) → all items render closed. This is
  the default on a fresh FAQ block.

Rejected: `defaultOpenIndex: number` (over-engineered — student-org
content rarely wants "open the third item by default"), `allOpen: true`
(equivalent to a richText block, defeats the accordion).

### Markdown for answers, plain text for questions

Answers flow through `@sosb/markdown.markdownToHtml` and the resulting
HTML is set on the answer container's `innerHTML`. This is XSS-safe by
construction (ADR 0006): `markdownToHtml` builds HTML from a typed
AST, so raw HTML in the input is escaped, dangerous URL schemes are
dropped, and only the whitelist set of elements (`p`, `strong`, `em`,
`a`, `ul`, `ol`, `li`, `h2`-`h4`, `blockquote`, `code`) ever appears in
the output.

Questions are rendered as plain text inside `<summary>`. Two reasons:

- A `<summary>` is a heading-like control; inline markdown (links,
  emphasis) inside the focusable element interacts poorly with native
  focus rings and screen-reader announcement of the expand/collapse
  state.
- The PRD's user story for FAQ describes a question as a short prompt,
  not formatted prose. Plain text covers the actual use case without
  inviting authors to nest links or other interactive elements inside
  a `<summary>` (which would be invalid).

The renderer's `faq-block.test.ts` exercises the XSS contract at the
page level (script tags, `javascript:` URLs in markdown, `<img
onerror>` in answers — none survive).

### Renderer follows the hero / richText pattern

`packages/renderer/src/blocks/faq.tsx` mirrors the hero and richText
pattern:

- A structural `<section data-block="faq" data-block-id={id}>` with an
  optional `aria-labelledby` pointing at the title's `<h2>` when
  present.
- Inner `<div class="faq__inner">` with the optional `<h2
  class="faq__title">`, then `<div class="faq__list">` containing one
  `<details class="faq__item">` per item.
- The component is consumed by `PageShell.renderBlock()` via a switch
  on `block.type`.

The stub theme picks up layout-only CSS for the `[data-block="faq"]`
selectors so the "var(--token) only outside `:root`" contract
continues to hold. Per-theme curated golden files for faq × Academic /
Modern / etc. land with the theme issues (#28-#31, #47); this issue
ships only the stub-theme golden file
(`packages/renderer/test/__golden__/stub-theme-faq.html`).

## Rationale

The most subtle requirement is "accordion accessible: keyboard
navigable, screen-reader announces state, focus visible." Two equally
valid designs satisfy it:

1. Native `<details>`/`<summary>`, with a tiny progressive enhancement
   for animation only.
2. Custom ARIA-tabs / disclosure widget with full
   `role="button"`/`aria-expanded`/`aria-controls` wiring.

We chose (1) because the platform already implements every required
behaviour. Browser support is universal in modern engines (the v1
support matrix for the published sites does not include IE 11).
Screen readers (NVDA, JAWS, VoiceOver) announce
`<details>`/`<summary>` correctly out of the box. axe-core has no
violations on the rendered tree (the renderer's
`faq-axe.test.ts` re-asserts this in three states: firstOpen=true,
all closed, no title).

The "by construction" framing of the PRD's accessibility commitment
aligns with (1) — the design's correctness comes from using the
platform's own accordion semantics, not from layering ARIA on top of
a `<button>`. The 2 kb JS budget also pushes toward (1) — a custom
widget would consume that budget on the widget alone, leaving nothing
for the animation.

The native fallback also matters: a visitor with JS disabled gets the
same content (instant toggle instead of animated), and the editor
preview iframe re-renders on every data change without needing to
re-run any custom widget hydration.

## Consequences

- `packages/schema/` adds `blocks/faq.ts`, `KnownBlockSchemas.faq`,
  and two `validate()` rule branches.
- `packages/renderer/` adds `blocks/faq.tsx`, `blocks/faq.script.ts`,
  the page-shell `case "faq"` branch, and the stub-theme CSS rules
  for `[data-block="faq"]`.
- `@sosb/renderer` exports `FAQ_ACCORDION_SCRIPT_SOURCE` (the inline
  script string) and `FAQ_ENHANCED_ATTR` (the sentinel attribute
  name) so the build pipeline (#5) and the editor preview (#7) can
  inline / re-run the enhancement.
- The hero and richText golden files refresh additively because the
  stub theme grew CSS rules for the faq block (the same pattern that
  applied when richText landed in #9).
- The build pipeline's `dist-snapshot` golden refreshes for the same
  reason.
- `packages/renderer/test/` gains `faq-block.test.ts` (16 tests),
  `faq-axe.test.ts` (3 tests), `faq-script.test.ts` (5 tests jsdom
  runScripts integration), `faq-script-size.test.ts` (2 tests Node
  esbuild minify size budget).
- `packages/schema/test/` gains `faq-block.test.ts` (19 tests).
- A new Playwright spec `e2e/faq-accordion.spec.ts` (3 tests) runs
  the enhancement against a real headless Chromium page —
  click-to-toggle, idempotency, keyboard activation. The
  `renderer-parity.entry.ts` exposes the script source on
  `window.__sosbRenderer` so the spec can inject it.

## Alternatives considered

- **Custom ARIA disclosure widget**. Rejected: see Rationale. Doubles
  the code surface and the test surface, pays for behaviour the
  platform provides for free.
- **Single-open semantics** (clicking one item closes others).
  Rejected: explicit out-of-scope per the issue's triage comment
  ("first-open mode" is the only opening mode in scope). Multi-open
  by default matches what student-org content actually wants — a
  visitor reading "Cine poate să se înscrie?" probably also wants
  "Care sunt etapele?" open at the same time.
- **schema.org `FAQPage` JSON-LD emission**. Rejected: out of scope
  per the issue triage ("schema.org `FAQPage` structured-data markup
  — that belongs to the SEO ticket #39"). The schema does not block
  that addition; #39 will read the rendered DOM (`<section
  data-block="faq">`) and emit the JSON-LD from the same source data.
- **Nested categories / hierarchical FAQs**. Rejected: explicit
  out-of-scope per the issue triage.
- **Search/filter UI within the FAQ**. Rejected: explicit
  out-of-scope per the issue triage.
- **Anchored deep-links to specific items**
  (`#cum-ma-pot-inscrie`). Rejected: deferred per the issue triage.
  The `<details>` `id` is stable (`<blockId>__item-<index>`) so #39
  or a later issue can wire deep-links without re-rendering.
- **Inline markdown in `<summary>`**. Rejected: see Decision §
  "Markdown for answers, plain text for questions."
- **Empty-items hard error**. Rejected: the schema accepts a
  placeholder block before the user has written items; the empty
  case surfaces as a quality nudge in `validate()`.
- **JS-required animation**. Rejected: violates the no-JS-fallback
  property; the script is a progressive enhancement.

## Out of scope

- Per-theme curated golden files for faq (themes #28-#31, #47).
- schema.org `FAQPage` JSON-LD emission (#39).
- Anchored deep-links to specific items (deferred).
- Search / filter UI within the FAQ (out of scope per triage).
- Nested categories / hierarchical FAQs (out of scope per triage).
- Block-list editor UI for adding / reordering FAQ items (a follow-up
  issue, not pinned).
- Build-pipeline integration that inlines `FAQ_ACCORDION_SCRIPT_SOURCE`
  into pages with a faq block (a tracking item that sits with the
  build-pipeline package; the constant is exported and ready when
  that work lands).
