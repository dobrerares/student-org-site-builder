# 0008 — Quote block: figure/blockquote/cite semantics and inline-only markdown

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #15

## Context

Issue #15 asks for the `quote` block: a pull-quote with attribution. The
PRD pins these load-bearing properties (User Stories #28, Implementation
Decisions → Block library):

- Quote text supports markdown (italic emphasis common).
- Author / role / image are optional attribution fields.
- Theme-styled treatment (e.g. decorative quote mark) per Academic.
- Author image flows through the asset pipeline.

The PRD does **not** pin:

- Which HTML elements carry the quote and its attribution.
- Which subset of the markdown grammar applies to the quote text — the
  full block-level subset from `@sosb/markdown` (#9), or only the inline
  subset (em / strong / inline code / links).
- Where the `data-block="quote"` attribute lands when the root element
  is a `<figure>` rather than the `<section>` used by hero / richText.

This ADR records those choices.

## Decision

### `<figure>` + `<blockquote>` + `<figcaption>` + `<cite>` semantics

The rendered HTML structure is:

```html
<figure data-block="quote" data-block-id="…">
  <blockquote class="quote__text">
    <p>{inline-rendered quote text}</p>
  </blockquote>
  <figcaption class="quote__attribution">
    <!-- only when attribution present -->
    <img class="quote__photo" ... />
    <!-- only when authorImage set -->
    <cite class="quote__author">{author}</cite>
    <!-- only when author set -->
    <span class="quote__role">{authorRole}</span>
    <!-- only when authorRole set -->
  </figcaption>
</figure>
```

Why this shape:

- The HTML Living Standard's guidance for an attributed pull-quote is
  exactly `<figure>` containing a `<blockquote>` and a `<figcaption>`
  with `<cite>` for the source. This pattern keeps the citation
  programmatically associated with the quote without needing extra ARIA
  (no `aria-labelledby`, no `role="figure"`).
- `<cite>` per the spec carries the _title of a work_ (or, for a
  pull-quote, the source / speaker). It is the right element for the
  author name; `<span>` is used for the role because the role is
  metadata about the cite, not itself a cited work.
- `data-block="quote"` lands on the `<figure>` root — there is one
  data-attributed root per block (the renderer's pattern from hero /
  richText). The `<figure>` is the block envelope; the inner
  `<blockquote>` carries only the quote content.
- The `<blockquote>` wraps a single `<p>` because the text is an
  inline-only paragraph (see next decision). This nesting matches what
  the markdown renderer already emits for `>` blockquotes in richText,
  keeping the visual treatment consistent.
- `<img loading="lazy">` for the author photo — the same lazy-load
  contract as the hero `<img>`. Alt text is required for accessibility
  but missing-alt is a quality-warning, not a hard error (see ADR 0006
  for the analogous hero `backgroundAlt` decision).

Alternatives considered:

- **`<section data-block="quote">` like hero / richText.** Rejected:
  `<section>` is a generic landmark; `<figure>` is the semantically
  precise container for a pull-quote. The renderer's pattern is "one
  data-attributed root element"; nothing requires that root to be
  `<section>`.
- **`<aside>` for the whole block.** Rejected: a pull-quote is
  presented as the page's primary content, not tangential to it.
  `<aside>` would mis-classify it for assistive tech.
- **`cite` attribute on `<blockquote>` carrying a URL.** Out of scope:
  the v1 schema does not carry a source URL field. `<cite>` element +
  visible author name is the documented pattern when there is no
  source URL.
- **Skip `<figure>` and put `data-block` on `<blockquote>` with the
  attribution as siblings.** Rejected: the `<blockquote>` would no
  longer wrap _only_ the quoted content (a spec-conformance violation),
  and the attribution would not be programmatically grouped with the
  quote.

### Inline-only markdown for quote text

`@sosb/markdown` exposes two layers:

1. `markdownToHtml(input)` — the full block-level renderer producing
   `<p>`, `<h2>`, `<ul>`, `<blockquote>`, etc.
2. `renderInline(text)` — the inline-only renderer producing `<em>`,
   `<strong>`, `<code>`, `<a>` and escaped text. Block-level constructs
   pass through as literal text.

The quote block uses the inline-only renderer. Reasons:

- A pull-quote is conventionally a single paragraph of inline-emphasised
  prose. Embedding `<h2>` or `<ul>` inside a `<blockquote>` is
  structurally odd and invites layout breakage in themes that style the
  quote as a single decorative block.
- The PRD's user story #28 cites italic emphasis as the "common case."
  The other inline markers (bold, inline code, links) come along for
  free with the same reused parser.
- Forbidding nested blockquotes inside a pull-quote keeps the rendered
  shape as `<blockquote><p>…</p></blockquote>` — predictable, themable,
  and accessibility-clean (a `<blockquote>` containing another
  `<blockquote>` is legal but rare and confusing in this context).
- Reusing `renderInline` (rather than re-implementing inline parsing)
  preserves the XSS-safe-by-construction guarantee from ADR 0006: every
  literal `<`, `>`, `&` passes through `escapeText`, dangerous URL
  schemes are dropped via `sanitizeUrl`, and only the inline whitelist
  ever appears in the output.

To make this reuse possible, `@sosb/markdown` exports `renderInline` as
`markdownInlineToHtml`. The inline parser was already an internal
function — promoting it to a public export is a one-line additive
change. The `@sosb/markdown` package's safety contract (from ADR 0006)
applies unchanged.

The quote text schema is `z.string().min(1)` — empty is rejected. Unlike
richText where empty markdown is an allowed placeholder, an empty quote
is structurally meaningless (there is nothing to attribute to).

Alternatives considered:

- **Use the full block-level renderer (`markdownToHtml`).** Rejected:
  pull-quotes with embedded headings or lists are not a documented
  use case and would complicate themes. The richText block already
  exists for prose that needs full block-level structure.
- **Plain text only (no markdown).** Rejected: the PRD explicitly
  calls out italic emphasis for the quote block (#28's "italic
  emphasis common" wording).
- **A new dedicated parser for "quote-flavoured" markdown.** Rejected:
  re-implementing inline parsing in a second module breaks the
  XSS-safe-by-construction story and doubles the test surface.

### Quote attribution renders only when populated

The `<figcaption>` is conditional on at least one of `author`,
`authorRole`, or `authorImage` being set. A bare quote with only `text`
renders as a `<figure>` containing only `<blockquote>` — no
`<figcaption>`, no `<cite>`. This matches the v1 schema's optional
attribution fields and keeps the rendered tree minimal when there is
nothing to attribute.

## Rationale

The two load-bearing choices reinforce each other. `<figure>` +
`<blockquote>` + `<figcaption>` + `<cite>` gives the block a clean
semantic envelope; inline-only markdown keeps the quote's text exactly
where the `<blockquote>` spec expects it (a single paragraph of
inline-emphasised prose). Reusing the existing `@sosb/markdown` inline
parser preserves the ADR 0006 safety contract verbatim and avoids a
second markdown surface that would have to be tested against the same
XSS corpus.

## Consequences

- `packages/schema/src/blocks/quote.ts` ships the quote block schema
  (`text` required + non-empty, `author` / `authorRole` / `authorImage`
  / `authorImageAlt` optional). Registered in `KnownBlockSchemas`.
- `packages/renderer/src/blocks/quote.tsx` ships the renderer
  component. Wired into `PageShell.renderBlock()` via a new `case
"quote"` branch.
- `@sosb/markdown` exports `renderInline` as `markdownInlineToHtml`.
  Existing callers (richText, future faq) are unaffected — the change
  is purely additive.
- The stub theme picks up layout-only CSS for `[data-block="quote"]`,
  `.quote__text`, `.quote__attribution`, `.quote__photo`,
  `.quote__author`, `.quote__role`. All values are `var(--token)` or
  unitless primitives; the renderer's "no hex/rgb outside `:root`" gate
  continues to hold.
- A new golden file
  (`packages/renderer/test/__golden__/stub-theme-quote.html`) freezes
  the structural output for the alumni pull-quote fixture.
- The hero / richText / build-pipeline goldens are refreshed because
  the stub theme CSS grew. The change is additive only — those blocks'
  output is byte-stable except for the appended quote rules.
- The `validate()` rule pass adds a `block.quote.authorImageAlt.missing`
  warning, mirroring the `block.hero.backgroundAlt.missing` pattern.
- Per-theme curated golden files for quote × Academic / Modern / etc.
  are owned by the theme issues (#28-#31, #47). This issue ships only
  the stub-theme golden.

## Alternatives considered

(See per-decision sections above.)

## Out of scope

- Per-theme curated golden files for quote (themes #28-#31, #47),
  including the Academic theme's "decorative quote mark" treatment
  (which is a CSS / pseudo-element decision, not a renderer-component
  decision).
- A `cite` attribute on `<blockquote>` carrying a source URL (not in
  the v1 schema; future additive field).
- A multi-quote carousel / slider (explicitly out of scope per the
  issue's triage comment — single quote per block in v1).
- Auto-fetched quotes from external sources (Twitter etc.) — explicitly
  out of scope per triage.
- Block-level markdown inside a quote (headings, lists, nested
  blockquotes). The richText block covers that case.
- Editor form UI for the quote block. The PRD's "auto-form generation"
  works against the schema; the block-list editor UI is a follow-up.
