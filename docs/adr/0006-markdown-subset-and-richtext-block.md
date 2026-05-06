# 0006 — Markdown subset, custom parser, and richText block

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #9

## Context

Issue #9 asks for two deliverables:

1. The `@sosb/markdown` module — a strict-whitelist sanitised markdown
   renderer used by `richText`, `faq` (#16), and `quote` (#13). The PRD
   pins the subset (Implementation Decisions → Block library): bold,
   italic, links, lists, headings (h2–h4), inline code, blockquotes. No
   raw HTML in markdown. XSS-safe by construction.
2. The `richText` block — schema, render component, default data, editor
   metadata. The block follows the pattern established by the hero block
   in #3 / #46.

The PRD does **not** pin:

- Which markdown library (if any) to use, or whether to roll a custom
  parser.
- The exact whitelist rendering — what HTML elements the output may
  contain, what URL schemes are allowed in links, how heading levels
  outside the subset are handled.
- Whether the rendered HTML is built from a typed AST (and is therefore
  XSS-safe by construction) or built by transforming an HTML string
  (relying on a sanitisation pass).

This ADR records those choices.

## Decision

### Custom parser, no third-party markdown dependency

`@sosb/markdown` ships a small, hand-written tokenizer + renderer in
`packages/markdown/src/`. Total source weight is ~250 lines across four
files (`md.ts`, `block.ts`, `inline.ts`, `sanitize-url.ts`,
`escape.ts`). No runtime dependency.

This is preferred over pulling in `marked`, `markdown-it`, or
`micromark` because:

- The PRD's whitelist is narrow enough that "implement only the subset"
  is shorter than "import a library and configure it to forbid
  everything outside the subset." The parser does not need to handle
  tables, code fences, footnotes, autolinks, or HTML pass-through —
  those are explicit non-goals.
- **XSS-safe by construction** is the load-bearing safety property. A
  hand-written walker that emits HTML one tag at a time from a typed AST
  cannot accidentally pass raw HTML through; a popular library
  configured to disable HTML pass-through has a bigger attack surface
  (the next minor version's default for an option might re-enable it).
- A library plus a sanitiser (e.g. DOMPurify) is two dependencies whose
  combined behaviour we have to verify against the XSS corpus. A custom
  parser plus the same XSS corpus tests one well-bounded thing.
- The PRD's renderer-output budget (HTML ≤50 kb, JS ≤10 kb) is hostile
  to importing a heavy markdown library that will tree-shake poorly. The
  custom parser ships zero JS to end-user sites (markdown is rendered at
  build time / preview time only) but it also keeps the editor bundle
  small.

The trade-off accepted: this parser will not stay current with
CommonMark 2.0+ extensions on its own. Since v1's subset is fixed, that
is acceptable. If v2 needs more (e.g. tables for the academic theme),
the choice can be revisited.

### Whitelist rendering

The output may contain only these elements:

- `<p>` — paragraphs
- `<strong>` — `**bold**`
- `<em>` — `*italic*` or `_italic_`
- `<code>` — `` `inline code` ``
- `<a href="...">` — `[text](url)` with the URL passing
  `sanitizeUrl()`
- `<ul>`, `<ol>`, `<li>` — `- ` / `* ` / `1. ` lists
- `<h2>`, `<h3>`, `<h4>` — `## `, `### `, `#### ` headings
- `<blockquote>` (containing a `<p>`) — `> ` blocks

Everything else — `<h1>`, `<h5>`, `<h6>`, code fences (` ``` `),
tables, images, footnotes, definition lists, raw HTML, comments — falls
through to escaped paragraph text or is dropped.

`<h1>` is excluded because the page hierarchy reserves `<h1>` for the
page title (the hero block's `<h1>`); allowing prose to inject another
`<h1>` would break heading structure for screen readers and SEO. `<h5>`
and `<h6>` are excluded as low-utility for the document depth a student
org's pages need; the PRD subset already pins h2–h4.

### URL allowlist for links

`sanitizeUrl()` returns `null` for unsafe URLs; the renderer falls back
to rendering the link text without an `href`.

Allowed schemes:

- `http:` / `https:` — the common case
- `mailto:` — explicit support per the contact-card pattern
- `tel:` — included for symmetry with `mailto:`; cheap to allow
- Relative paths and anchors — `/path`, `./path`, `../path`, `#anchor`,
  `?query`, or any path with no leading scheme

Forbidden:

- `javascript:`, `data:`, `vbscript:`, `file:` — explicitly rejected
  even when entity-encoded or whitespace-prefixed.

The sanitiser performs three normalisations before checking the
allowlist:

1. Decode leading HTML numeric character references (so an attacker who
   writes `[click](&#106;avascript:…)` does not slip past).
2. Strip leading whitespace and ASCII control bytes (browsers ignore
   them when resolving a scheme; the sanitiser must too).
3. Reject any URL containing whitespace / newlines / control bytes
   anywhere — never legit, almost always a smuggling attempt
   (e.g. `java\nscript:`).

The XSS corpus in `packages/markdown/test/xss-corpus.test.ts` exercises
~35 representative attack vectors from the OWASP cheatsheet against this
contract.

### XSS-safe by construction

The renderer never round-trips raw HTML. Every literal `<`, `>`, `&`
from the input passes through `escapeText()` before being concatenated
into the output buffer. A `<script>` in the input becomes `&lt;script&gt;`
in the output regardless of context. Attribute values pass through
`escapeAttr()` for full quote-and-special-character escaping.

The only `<…>` substrings in the output are the tags the renderer
chose to emit. The renderer's test framework (`isOutputSafe` in the XSS
corpus tests) extracts those _real_ tags and verifies each is on the
whitelist with safe attributes — that is the load-bearing assertion.

### richText block follows the hero pattern

`@sosb/schema/src/blocks/rich-text.ts` mirrors `hero.ts`:

```ts
export const RichTextDataSchema = z.looseObject({ markdown: z.string() });
export const RichTextBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("richText"),
  version: z.literal(1),
  data: RichTextDataSchema,
});
```

Registered in `KnownBlockSchemas` alongside `hero`. The
`validate()` switch carries a quality-nudge warning for empty
markdown (severity `warning`, not `error` — empty placeholder blocks
are allowed at the schema layer).

`@sosb/renderer/src/blocks/rich-text.tsx` mirrors `hero.tsx`: a
structural `<section data-block="richText" data-block-id={id}>` with a
content container whose innerHTML is the `markdownToHtml` output. The
component is consumed by `PageShell.renderBlock()` via a switch on
`block.type`.

### Auto-form generation

The PRD's "Editor form is auto-generated from the schema" requirement
is satisfied by the existing `fieldsFromSchema()` walker (#7 / ADR
0005). Calling `fieldsFromSchema(RichTextDataSchema)` produces a
single-field tree (`markdown: string`) that any block-list editor UI
can pick up without per-block code. The block-list editor UI itself is
out of scope here — owned by a follow-up issue.

## Rationale

The most subtle requirement is "XSS-safe by construction." Two equally
valid designs satisfy it:

1. Parse markdown to a typed AST, then serialise the AST one tag at a
   time, escaping all text nodes.
2. Use a third-party markdown library, then post-process the output
   with a sanitiser like DOMPurify.

We chose (1) because it has fewer moving parts, smaller test surface,
and provably bounded behaviour. The corpus test in (2) would need to
exercise `marked × DOMPurify × N config combinations`; the corpus test
in (1) exercises one well-bounded function. The "by construction" part
of the PRD's wording aligns with (1) — the design's correctness comes
from how the output is built, not from a separate cleaning pass.

## Consequences

- `packages/markdown/` ships an implemented module with 72 tests across
  three files (whitelist enforcement, XSS corpus, escape contract).
- `@sosb/renderer` adds `@sosb/markdown` to its workspace deps. The
  renderer ships no markdown runtime to end-user sites; markdown is
  rendered to static HTML at build time / editor preview time.
- The stub theme picks up layout-only CSS for the `[data-block="richText"]`
  container so the PRD's "var(--token) only outside `:root`" contract
  continues to hold.
- Per-theme curated golden files for richText × Academic / Modern / etc.
  are owned by the theme issues (#28-#31, #47). This issue ships only
  the stub-theme golden file
  (`packages/renderer/test/__golden__/stub-theme-richtext.html`).
- Future block schemas (#10–#22) follow the same pattern: a
  `z.looseObject({...})` data schema, a `z.literal("type")`-anchored
  block schema, registration in `KnownBlockSchemas`, a Preact render
  component, and a `case` branch in `PageShell.renderBlock()`.
- The hero golden file and the build pipeline's golden HTML files are
  refreshed because the stub theme CSS grew (additive only — the hero
  output is still byte-stable except for the appended block CSS rules).

## Alternatives considered

- **`marked` + DOMPurify**. Rejected: see Rationale. ~80 kb of
  installed code for a problem that fits in 250 lines of bespoke code,
  with a less obvious safety story.
- **`micromark`**. Rejected: heavier API surface, harder to bound to a
  strict subset.
- **`markdown-it` + `markdown-it-sanitizer`**. Rejected: same issues,
  plus the sanitiser plugin is community-maintained on a different
  cadence than the core lib.
- **WYSIWYG / contenteditable rich-text input**. Rejected: explicitly
  out of scope per the PRD ("strict markdown subset, plain textarea
  input"). A WYSIWYG would have to serialise to markdown anyway, doubling
  the round-trip surface.
- **Allow `<h1>` in the markdown subset**. Rejected: the page hero
  carries the page-level `<h1>`; a richText `<h1>` would either
  duplicate it (bad SEO + a11y) or compete with it (visual confusion).
- **Allow images in the markdown subset (`![alt](src)`)**. Rejected:
  v1's image-bearing blocks (`imageGallery`, `team`, `hero`) are
  structured blocks with mandatory alt-text validation. Allowing
  free-form markdown images would create a parallel image surface that
  bypasses the asset pipeline (#6) and the alt-text quality nudge.
- **Allow code fences (` ``` `)**. Rejected: out of the PRD subset,
  no demand from student-org content. Inline code (`` ` ``) covers
  the niche case of mentioning a command line.

## Out of scope

- Per-theme curated golden files for richText (themes #28-#31, #47).
- Block-list editor UI for adding / reordering richText blocks (a
  follow-up issue, not pinned to a specific number).
- WYSIWYG editing experience (explicitly out of scope per the PRD).
- Markdown as the user-facing source format for blocks other than
  `richText`, `faq`, `quote` (the three callers the PRD lists).
- Localisation of the parser's behaviour. The parser is purely
  syntactic; it does not vary by language.
