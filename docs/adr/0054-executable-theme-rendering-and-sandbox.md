# 0054 — Executable Theme rendering modules and the render sandbox

- **Status:** Accepted
- **Date:** 2026-09-23
- **Issues:** [#104](https://github.com/dobrerares/student-org-site-builder/issues/104) (Custom Themes map), phase two of #107–#109; groundwork for [#106](https://github.com/dobrerares/student-org-site-builder/issues/106) and [#110](https://github.com/dobrerares/student-org-site-builder/issues/110)

## Context

Phase one of Theme packages ([ADR 0050](0050-theme-package-format.md),
[ADR 0051](0051-theme-package-lifecycle.md),
[ADR 0052](0052-renderer-theme-seam.md)) was deliberately declarative: a
manifest, a stylesheet, fonts and images. It reached most of the published
design reference with CSS and named variants over the built-in Blocks, and it
shipped the distribution, lifecycle and rendering seams against a payload that
could not run code.

[ADR 0046](0046-trusted-executable-theme-and-block-extensions.md) always
intended more. It lets a Theme "control page layouts and Block markup" and
"supply JavaScript both for rendering during preview/export and for
interactions on the exported public Site". It also sets the terms: rendering
code may use supplied Site content, packaged assets and documented helpers
only; no network, no files; the builder **must enforce** those limits rather
than trust documentation; the same Site renders to identical HTML in browser
preview and in Electron/export (ADR 0032's determinism); the preview stays
static unless an interactive mode is switched on; core content and navigation
must work before any script runs.

Two things in the reference need code rather than CSS: a page shell with its
own structure (a brand mark beside the navigation, a phone-width menu button, a
colophon) and, later, Custom Blocks
([issue-106 plan](../plans/issue-106-custom-block-contract.md)) whose markup
no built-in component knows how to produce.

The constraints that shape the answer are the ones the rest of the builder
already lives under. `renderSite` and `build()` are synchronous and browser-
safe (ADR 0004, ADR 0052); the editor's `srcdoc` preview depends on that. The
editor ships as a single archival HTML file (`@sosb/browser-shell`) with a
3 MB budget, and as a packaged Electron app with a strict Content Security
Policy. Everything works offline. And a Theme's rendering must not be able to
make the page a function of anything but the Site.

## Decision

### A Theme design returns data, not HTML

A package may name a `render.js` in its manifest. It is an ES module whose
default export is `{ blocks: { [type]: (input) => tree }, shell?: (input) =>
tree }`. A Block design overrides a built-in type or renders a Custom Block
type; the shell design owns the visible chrome around the builder's content.

A design never emits characters. It returns an **element tree** — `["p", {
class: "lede" }, "text"]`, or the equivalent `{ tag, attrs, children }` —
which the renderer validates and hands to Preact exactly like a built-in
component's vnode. The validator holds a curated allow-list of tags (no
`script`, `iframe`, `object`, `style`, `form` controls, `html`/`head`/`body`)
and per-tag attributes; requires plain attribute names; refuses any `on*`
handler and any inline `style`; checks every URL-valued attribute with the
same predicate the schema uses for links (a `srcset` one candidate at a time),
accepting a builder-produced URL by identity; and refuses the attributes the
builder itself places (`data-block`, `data-block-id`, `data-variant`,
`data-shell-variant`). A new-tab anchor gets `rel="noopener
noreferrer"` whether the design asked or not.

The three properties this buys are the ones ADR 0046 asks for. There is no
raw-HTML injection surface, because there is no string. Preview and export are
byte-identical mechanically, because both go through the same serializer with
the same escaping and the same sorted attribute order. And a failure is
locatable — the error names the Theme, the Block id and type (or "shell") and
the offending node — instead of being HTML that looks fine until a browser
parses it.

### What a design is told

Supplied Site content and nothing else. A Block design receives the envelope
(`id`, `type`, `version`, `data`, the active `variant` or `null`), the
document it sits in, the page language, the organisation's identity and the
Theme's settings (id, version, shell variant, token overrides). A shell design
receives the builder-computed navigation, language links, home href, title
and description — the same values the built-in shell renders from, so a Theme
cannot compute a URL differently from the builder that will export it.

The helpers on `input` are the documented builder services: `asset()` for a
file in the package, `mediaUrl()`/`mediaAlt()` for a Site asset, `pageUrl()`
and `articleUrl()` for builder-owned routes, `richText()` for prose rendered
through the builder's own sanitising pipeline (it returns an opaque sentinel
the renderer substitutes, so even prose never arrives as a string from the
module), and `t()` for a small table of visitor-facing shell copy in the
page's language.

Because a helper's return value is accepted by the validator by identity —
that is how a preview `blob:` URL gets through a check that would otherwise
refuse it — what goes _into_ a helper is policed: `asset()` accepts only a
package-relative path and throws otherwise, and `mediaUrl()` answers `null`
for anything that is not a Site asset path (`assets/…` with no scheme, `//` or
`..` segment). A design cannot launder a URL of its own through a helper.

### The builder keeps the document

A shell design returns the contents of `<body>`, with exactly one `["slot"]`
where the builder places `<main>` with the page's Blocks in author order
followed by the site-footer Block. Zero slots or several is a `slot-count`
render error, not a repair: a shell that silently drops the page body is the
failure a student would publish without noticing, and two slots would make
the reading order ambiguous (ADR 0046). `<html>`, `<head>`, SEO metadata,
hreflang alternates, the stylesheet, the builder's own enhancement scripts and
the preview bridge stay where they were.

The renderer stamps `data-block`, `data-block-id` and — when the active Theme
offers the selected variant — `data-variant` onto a Block design's root
element, which is why a Block design must return a single element (or `null`
to render nothing). The addressing scheme Theme CSS uses (ADR 0050) is
therefore identical for built-in, overridden and Custom Blocks.

### Failure and omission are different things

A design that throws, returns an invalid tree, exhausts its budget or
mis-counts its slots raises `ThemeRenderError` with a stable code. In deploy
mode it propagates and `build()` stops (ADR 0045: a rendering failure cannot
be acknowledged away). In preview mode it is reported through
`RenderOptions.onIssue` and a builder-owned error box takes the Block's place
— for a failed shell, above the builder's fallback chrome — because a blank
preview teaches an author nothing.

A Block whose type has neither a built-in component nor a Theme design is
_omitted_ (ADR 0045): dropped from the output, marked with the pre-existing
HTML comment, and reported. `omittedBlocksFor(site, bundle)` computes the list
statically from the same predicate the page shell renders with, so the editor
can ask before it builds; `build()` reports the same Blocks through
`onOmittedBlock` from the real render, and `buildWithReport()` returns them as
a value. The export readiness panel (ADR 0053) lists them and gates the export
on a checkbox — not a typed phrase, since nothing is broken, and not a plain
warning, since the whole point is that the author reads it — on top of the
validation gate, never instead of it.

### The sandbox is QuickJS compiled to WebAssembly

`render.js` runs in **QuickJS** via `quickjs-emscripten` (the single-file,
synchronous release variant), in a realm with its own heap. The host realm is
unreachable from inside; the only functions a design can call are the helper
bindings this builder installs, each taking one string and returning one
string. Input goes in as JSON and trees come back as JSON, so a guest value can
never be a host object.

Inside the realm `fetch`, `XMLHttpRequest`, timers, `queueMicrotask`,
`require`, `process`, `WebAssembly`, `console`, `Intl` and QuickJS's own
`std`/`os` bindings simply do not exist. `Date`, `Math.random`, `WeakRef` and
`FinalizationRegistry` — which QuickJS does ship — are removed by the bootstrap
before the module evaluates. A module loader that always throws closes static
`import`; dynamic `import()` yields a promise that can never settle, because
the realm's job queue is never run. The tests probe each of these by `typeof`,
because "absent" and "present but throws" are different guarantees and only
the first is the one promised.

**The engine is instantiated once, asynchronously**, by the three asynchronous
package entry points (zip, VFS, directory); every render call is synchronous.
`renderSite` and `build()` keep their contract. A synchronous load of a package
with `render.js` before the engine is up fails loudly with
`ThemeSandboxNotReadyError` rather than quietly loading the Theme without its
design.

**Compilation happens at import time**, one runtime and context per Theme.
A module with a syntax error, no default export or a foreign `import` is a
`render-invalid` package rejection, so the author hears about it while
importing rather than three pages into an export. Realms are released when a
Theme is replaced, removed or exported, and when the editor unmounts.

**Budgets are counts, not clocks.** A runaway loop is stopped by an interrupt
budget of 2,000 handler invocations per call — QuickJS polls the handler every
ten thousand loop iterations or calls, so roughly twenty million steps, three
orders of magnitude above what the example Theme's shell uses — and surfaces
as a `timeout` error in well under a second. A wall-clock limit would make
"does this Theme render?" depend on how busy the machine is, which is exactly
the environment dependence ADR 0032 forbids.

**The heap ceiling is 48 MB per call, enforced twice.** QuickJS's own limit
refuses any single allocation larger than that, but under Emscripten its
running total counts allocations rather than bytes (the platform's
`malloc_usable_size` is stubbed to zero), and an allocation loop measured its
way to a 2 GB wasm heap before the engine noticed. The interrupt handler
therefore also watches the WebAssembly heap: a call that grows it by more than
the ceiling is stopped and reported as `memory`. Because the check runs every
ten thousand operations, a runaway can overshoot by tens of megabytes before it
is caught. The guest stack is capped at 256 KB — smaller than the host's —
because at 1 MB the host's own call stack overflowed first and left the engine
in a state that could not be freed; at 256 KB the guest receives a clean
`InternalError: stack overflow`, still with room for more than a thousand
nested calls (1,362 measured) against a 64-level tree limit. Should a host
exception ever escape a call anyway, the realm is marked poisoned and
abandoned rather than freed, because freeing a corrupted runtime aborts the
whole wasm module for every Theme in the session.

The per-call growth check alone would ratchet. What a failed call allocated
goes back to the engine's allocator but never to the browser, so the next call
fills the freed chunks first and is allowed a fresh ceiling on top; a design
that failed on every preview edit would climb the shared heap 48 MB at a time
until WebAssembly refused to grow it, which aborts the module for every Theme.
Two guards close that. A subject — the shell, or a Block type — whose design
has blown the ceiling once is refused in that realm from then on, with a
`memory` error saying so, until the Theme is re-imported (a fresh realm) or the
editor reloaded; the author has already been told which Block failed and why.
And no call may leave the shared heap above an absolute 256 MB cap, whatever
it was at the start (the engine starts at 16 MB).

### The public-site script

A package may name a `public.js` under `public: { file, network, offline }`.
`network` — the hosts the script may contact — is **required** whenever the
block is present, even as an explicit `[]`; `offline` — what stops working
without a connection — is required whenever `network` is non-empty. ADR 0046
asks each extension to document those dependencies; a field the loader does
not check is a field that goes stale, and an explicit `[]` makes "this script
is self-contained" something the author said rather than something the builder
assumed.

`build()` writes the bytes verbatim at `assets/theme/<id>/public.js` and every
page and Article gets `<script defer src>` through the depth-aware URL seam —
deferred so that, as ADR 0046 requires, content and navigation work before it
runs. `renderSite` emits the tag only when `includePublicScript` is set: the
build sets it, the editor preview does not, and `iframeSrcdoc`'s
`PreviewOptions.includePublicScript` is the single flag the interactive-preview
toggle (#110) will flip. The script is exempt from the builder's 10 KB script
budget (ADR 0046 permits a bundled framework); the budget keeps policing the
builder's own scripts. `render.js` is never written to the public Site.

### Where it runs, and what it costs

The same `@sosb/theme-package` module runs in Node, in the browser build and
in Electron; the parity tests render the example Theme through separately
loaded realms and compare bytes. Two environment facts had to be settled:

- **Single-file archival editor.** The single-file variant embeds the wasm as
  base64 inside the ES module, so it inlines into `builder.html` like any
  other code. Measured on the archival bundle: **QuickJS accounts for
  871 KB** of its JavaScript (the wasm plus its Emscripten glue; the sandbox
  itself is 6 KB). Before this change the bundle was about 2.02 MB of
  JavaScript. After rebasing onto the builder redesign (#118) the whole
  `builder.html` is **2,955,539 bytes (2.82 MiB)**; the archival 3 MiB
  acceptance budget still holds, with roughly 190 KB to spare.
- **Electron.** WebAssembly compilation is refused under a bare `script-src
'self'`. The packaged renderer's CSP gains `'wasm-unsafe-eval'`, which
  permits exactly that and nothing about JavaScript `eval`; the CSP test now
  distinguishes the two.

## Rationale

**Why an engine in wasm rather than the host's own JavaScript?** ADR 0046
says _enforce_. A `new Function` with a shadowed scope is escapable in one
expression (`this`, `globalThis`, a prototype walk), and every "harden the
host realm" approach — SES/`Compartment` included — leaves the design sharing
a heap, a clock and an event loop with the editor, offers no instruction or
memory budget, and requires locking down the realm the React editor itself
runs in. A separate engine makes the absence of `fetch` a fact about the
realm rather than a property of a wrapper.

**Why QuickJS specifically?** It is small enough to embed (871 KB in the
bundle, against a 3 MB single-file budget), it is synchronous, its
interrupt handler gives a deterministic budget for free, and its behaviour is
the same in Node, Chromium and Electron because it is the same wasm bytes.
SES was the documented fallback if the wasm could not be embedded; it could,
so the fallback was not needed.

**Why trees rather than HTML strings through a sanitiser?** A sanitiser
decides after the fact what to strip from markup the design meant to ship;
the design cannot learn from that, and the builder's attributes have to be
grafted onto markup it did not produce. A tree is validated before anything
is emitted, refused with a message naming the node, and stamped at the root
without parsing.

**Why compile at import and keep one realm per Theme?** Compiling per render
would dominate the render; sharing a realm between Themes would let one see
another's globals. Import time is also when the author is watching.

**Why a coarse memory check rather than none?** The engine's own limit being
ineffective on this platform was discovered by measurement, not assumed. A
ceiling enforced every ten thousand operations is imprecise, but it turns
"the tab dies" into "this Block fails with a message", which is the whole
purpose. The imprecision is documented rather than hidden.

**Why refuse a design after one memory failure rather than keep retrying?**
The preview re-renders on every edit. Retrying a design that allocates without
bound is not a second chance, it is the same failure with a larger heap, and
the heap is shared with every other Theme in the session. Refusing per subject
keeps the rest of the Theme rendering; re-import is one action away.

## Consequences

- Themes can now produce their own page shell and Block markup, and Custom
  Blocks have a rendering mechanism waiting for them (issue-106 plan).
- Every consumer of the editor bundle carries ~871 KB more JavaScript. The
  single-file archival build is at ~2.82 MiB against a 3 MiB budget; the next
  large dependency in any branch will have to revisit that number.
- A Theme with a `render.js` holds a sandbox realm while installed; the
  editor, the zip export and the package export release them. The wasm heap
  never shrinks, so a design that blows its memory ceiling leaves the process
  larger until reload.
- Loading a package with `render.js` is asynchronous once per process; tests
  that load the example synchronously switched to
  `loadThemePackageFromDirectoryAsync`.
- `ThemeRenderErrorCode` gains `memory`; `ThemePackageErrorCode` gains
  `render-invalid`; `BuildOptions` gains `onOmittedBlock`; `build` gains a
  sibling `buildWithReport`.
- Built-in Themes are byte-for-byte unchanged: the golden matrix, the a11y
  matrix and the script-budget tests pass without edits, and a test asserts
  the new options change nothing for a built-in.
- The example Theme is at 1.1.0 with an executable shell, a spotlight hero
  override and a `public.js`; its output is pinned by golden files.

## Alternatives considered

- **SES / `Compartment` with curated endowments.** Rejected as the primary
  mechanism: same realm as the editor, no budgets, and `lockdown()` of the
  host realm is a change to the whole application to police one module. It
  remains the documented fallback for an environment where wasm cannot run.
- **`new Function` with a scope proxy.** Rejected: escapable, and ADR 0046
  requires enforcement.
- **A Web Worker or a sandboxed iframe.** Rejected: asynchronous, which breaks
  `renderSite` and the `srcdoc` preview; unavailable or different in Node;
  and no determinism gain over an in-process engine.
- **HTML strings through DOMPurify.** Rejected: strips after the fact,
  cannot stamp the builder's attributes, and loses the locatable error.
- **A separate `.wasm` file (the `wasmfile` variants).** Rejected: a second
  file cannot be inlined into the single-file archival editor.
- **Run `render.js` only at build time and preview with the built-ins.**
  Rejected: violates preview/export parity outright.
- **A wall-clock render timeout.** Rejected: environment-dependent
  (ADR 0032).
- **Shipping `render.js` to the public Site.** Rejected: it runs at build
  time; publishing it serves no visitor.

## Out of scope

- Custom Block field declarations, editor forms and extension lifecycle
  (issue-106 plan). The rendering seam here is what those plug into.
- The interactive-preview toggle and its acceptance criteria (#110, #111);
  this ADR ships the flag it flips.
- A TypeScript SDK or type declarations for `render.js` authors.
- `form`, `input`, `select` and `textarea` in element trees — a form's
  `action` is a network dependency the render cannot police; deferred.
