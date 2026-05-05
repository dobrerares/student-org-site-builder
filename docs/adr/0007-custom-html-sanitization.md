# 0007 — customHTML sanitization (DOMPurify, danger-mode opt-in)

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #19

## Context

Issue #19 ships the `customHTML` block — the lone power-user escape hatch
in v1's curated 15-block library. The block carries a raw HTML string and
a sanitization toggle. The PRD pins:

- Sanitization is **on by default**. Sanitize-off is an explicit opt-in
  ("danger mode") with a persistent editor warning.
- The strict-mode policy aligns with the markdown subset (no scripts, no
  active content).
- The editor's block-list entry for `customHTML` is visibly tagged as
  advanced/danger.
- A standard XSS test corpus must pass when sanitization is on.

The PRD does **not** pin:

- The specific sanitization library (DOMPurify vs sanitize-html vs
  hand-rolled).
- The exact deny-list / allow-list for sanitize-on mode.
- How sanitization interacts with the renderer's Node-vs-browser parity
  contract (ADR 0003).
- How the editor surfaces the "danger" UI for the off mode.

This ADR records those choices.

## Decision

### Sanitizer: **DOMPurify 3.x**

`dompurify` is added as a dependency of `@sosb/renderer`. We do **not**
add it at the workspace root — only the renderer needs to sanitize
customHTML output.

DOMPurify is the established, audited XSS sanitizer used by ProseMirror,
Quill, MDX, Notion, and dozens of other projects. It is regularly
fuzz-tested by Cure53 and ships with a conservative default allow-list
that we tighten further. Reaching for an established, audited sanitizer is
the explicit instruction in the contract for this issue ("DOMPurify or
equivalent established sanitizer — don't reinvent sanitization").

Rejected:

- **`sanitize-html`** — also established, but heavier (~300 kb vs DOMPurify's
  ~20 kb minified) and less commonly used in browser contexts. Our
  renderer runs in both Node and the browser; bundle weight matters for
  the editor preview iframe path.
- **Hand-rolled regex / parse-and-rebuild** — security-sensitive code we
  would have to audit ourselves. Sanitization is the canonical example
  of "do not roll your own".
- **`xss` (the `js-xss` library)** — credible, but has a smaller user base
  and a less rigorous fuzzing record than DOMPurify.
- **`isomorphic-dompurify`** — would simplify the Node/browser split but
  pulls in `jsdom@29` whose transitive dep `html-encoding-sniffer`
  requires an ESM module via `require`, breaking vitest's worker
  bootstrap (verified empirically). The split we adopt below avoids the
  problematic transitive entirely.

### Strict-mode policy

Sanitize-on mode runs the input through DOMPurify with this configuration:

```ts
{
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["iframe", "object", "embed", "form", "input", "button",
                "style", "svg", "math"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover",
                "onfocus", "onblur"],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true,
  RETURN_TRUSTED_TYPE: false,
}
```

- `USE_PROFILES: { html: true }` starts from DOMPurify's curated HTML
  safe-list (paragraphs, headings, lists, links, basic inline tags, images,
  tables) and **excludes SVG / MathML by default**. We explicitly
  blocklist SVG / MathML root elements as a defense-in-depth restatement.
- `FORBID_TAGS` removes tags that DOMPurify might otherwise allow but our
  policy rejects for an escape-hatch block: `<iframe>`, `<object>`,
  `<embed>`, `<form>`, `<input>`, `<button>`, `<style>`. Embeds and forms
  are out of scope for v1's `customHTML` — the curated `embed` block
  (#16) handles trusted iframe providers via a separate whitelist; forms
  are an explicit non-goal of v1.
- `FORBID_ATTR` strips `on*` event handler attributes. DOMPurify does
  this by default; we restate the most common ones for explicitness.
- `ALLOW_DATA_ATTR: false` — `data-*` is a common XSS exfiltration
  vector via CSS attribute selectors; power users do not need it on a raw
  HTML block.
- `KEEP_CONTENT: true` preserves text content of stripped tags so the
  user's prose is not silently dropped when, say, a `<style>` block is
  removed.
- `RETURN_TRUSTED_TYPE: false` makes the API return a string for
  straightforward use with the renderer's HTML emission.

The XSS test corpus (`packages/renderer/test/custom-html.test.ts`)
validates: `<script>` removal, on\* attribute stripping, `javascript:` URL
stripping in href, iframe / object / embed / form removal, `<style>` body
removal, SVG `onload` removal, and benign-tag preservation.

### Sanitize-off (danger mode)

The renderer emits the user's html byte-equal when `data.sanitize ===
false`. The user has explicitly opted into this via the editor's
persistent warning UI; the renderer trusts that opt-in and does not
editorialise. The published site is the user's intent verbatim — that is
the explicit point of an "escape hatch".

The renderer does **not** add a warning banner to the rendered page for
sanitize-off. The warning lives editor-side; the published site is what
the user wants visitors to see.

### Node-vs-browser split (preserves ADR 0003 parity)

DOMPurify needs a DOM (`window`, `document`, `Element`, …). In the
browser the page provides one. In Node we need to construct one. We
expose a single named export — `sanitizeCustomHtml(html: string): string`
— from the renderer's `./internal/sanitize` subpath, with two
implementations resolved through `package.json` `exports` conditions:

```jsonc
{
  "exports": {
    ".": {
      /* renderer entry */
    },
    "./internal/sanitize": {
      "browser": "./src/sanitize.ts",
      "node": "./src/sanitize.node.ts",
      "default": "./src/sanitize.node.ts",
    },
  },
}
```

- `sanitize.ts` (browser): uses DOMPurify's bundled UMD build — picks
  `window` / `document` from the page automatically, no JSDOM in the
  bundle.
- `sanitize.node.ts` (Node): constructs a JSDOM window on demand and
  caches it. JSDOM is already a renderer devDependency for the axe-core
  accessibility test, so we are not adding a new heavy dep.

The block code (`packages/renderer/src/blocks/custom-html.tsx`) imports
via the package's own name (`import { sanitizeCustomHtml } from
"@sosb/renderer/internal/sanitize"`) so the conditional resolution kicks
in inside-package too. esbuild's `platform: "browser"` picks the browser
condition; vitest's Node runner picks the Node condition. The
build-pipeline browser-runnability test (`@sosb/build`'s
`no-node-imports.test.ts`) verifies that no `jsdom` reference reaches the
browser bundle.

Both implementations share the same configuration object
(`sanitize-config.ts`). DOMPurify is deterministic by design — the same
input always produces the same output regardless of which window it ran
under, so the renderer's parity contract (ADR 0003) is preserved.

### Editor: persistent danger UI

The customHTML block-form (`packages/editor-app/src/custom-html-form.tsx`)
surfaces:

- A `<textarea>` for the html.
- A `<input type="checkbox">` bound to `data.sanitize`, checked by default.
- An always-visible explainer paragraph describing the trade-offs.
- A persistent warning surface (`role="alert"`,
  `data-testid="custom-html-danger"`) shown whenever `sanitize === false`.
- An advanced/danger marker on the form's legend
  (`data-testid="custom-html-advanced-marker"`). The block-list entry is
  out of scope for this issue — when the block-list UI lands, it can read
  the same marker pattern.

The warning uses `role="alert"` so screen readers announce it on each
render. The explainer is plain prose so the text screen reader users
hear matches what sighted users see.

### Schema-level validation

Sanitize-off raises a **warning** (not an error) in the validation
result, with code `block.customHTML.sanitize.off`. This lets the future
Site Health panel and the validation report surface the off state
alongside the editor's inline danger UI without any additional plumbing.
The PRD's severity model puts "sanitize-off on customHTML" explicitly in
the warnings list.

## Rationale

The two non-obvious decisions are the **library choice** and the
**Node-vs-browser split**.

**Library choice.** The instruction was to use an established sanitizer.
DOMPurify is the de-facto industry default — Cure53 maintains it,
ProseMirror / Quill / MDX / Notion all use it, it has 22M weekly
downloads on npm. Choosing anything else would have required defending
why we are sanitizing differently from the entire downstream ecosystem.

**Node-vs-browser split.** The renderer must run in both Node (build
pipeline) and the browser (editor preview). DOMPurify's API is the same
in both, but its dependency graph diverges (browser uses `window`, Node
needs JSDOM). The cleanest abstraction is `package.json` `exports`
conditions: declarative, supported by Node, esbuild, vitest, and pnpm,
and visible at the package boundary. The alternative — a single
`sanitize.ts` with `typeof window` runtime branching — has esbuild
trying (and failing) to resolve JSDOM in browser bundles.

## Consequences

- `pnpm -F @sosb/renderer add dompurify` is run inside the worktree; the
  lockfile carries `dompurify@3.4.2` only inside the renderer package.
- The renderer's `package.json` gains an `exports` field; the existing
  `main`/`types` fields remain so consumers using bundler-style
  resolution still resolve `.` correctly.
- A new test file `packages/renderer/test/custom-html.test.ts` covers
  the sanitization XSS corpus, the danger-mode passthrough, and the
  determinism contract. A separate `custom-html-accessibility.test.ts`
  asserts axe-core has zero violations on a sanitize-on render.
- A new editor file `packages/editor-app/src/custom-html-form.tsx`
  carries the danger UI, with `custom-html-form.test.tsx` covering the
  on / off distinction, the warning role, and the change handlers.
- The `@sosb/build` browser-runnability test
  (`packages/build/test/no-node-imports.test.ts`) caches the bundle in a
  `beforeAll` so the four sub-tests share one esbuild run; the bundle's
  size now includes DOMPurify's UMD build (~20 kb minified) and bundling
  takes ~2-3s on cold runs.

## Alternatives considered

- **Sanitize at write-time (in the editor) rather than render-time.**
  Less defensible: the data file becomes opaque ("what HTML did the user
  enter? what HTML are we showing?"). The current design keeps the
  schema's `html` field as the user's literal input and applies
  sanitization at the render boundary — easier to audit and easier to
  re-render with a stricter policy if a future CVE in DOMPurify forces
  one.
- **A single sanitization config that both the renderer and the editor
  preview share via `@sosb/markdown` or a new `@sosb/sanitize` package.**
  Premature. There is exactly one consumer today (the renderer's
  `customHTML` block); refactoring into a separate package would introduce
  a dep without earning it. When `@sosb/markdown` (#15) lands its own
  XSS-safe markdown subset, we will revisit whether the two share a
  common configuration.
- **Configurable per-block sanitize policy.** The PRD explicitly puts
  "per-tag allowlist customisation in editor" in the out-of-scope list.
  The strict policy is hard-coded. If a v2 use case emerges we will
  revisit.
- **Block sanitize-off entirely** (only ship sanitize-on). Would betray
  the PRD's "lone escape hatch" framing — a power user with a niche
  trusted embed (a custom interactive widget, a self-hosted analytics
  pixel they own) would have nowhere to go. The persistent danger UI is
  the right design.

## Out of scope

- Customisable per-tag allowlists (PRD-listed non-goal).
- Syntax-highlighted HTML editor / live HTML linting (PRD-listed non-goal;
  plain textarea is sufficient).
- Importing remote HTML / fetch-and-paste tooling (PRD-listed non-goal).
- The block-list UI that hosts the advanced/danger marker — owned by the
  block-list issue. The marker markup lives in this form so it travels
  with the component.
- A shared sanitize package with `@sosb/markdown` — revisit when the
  second consumer lands.
