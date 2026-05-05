# 0005 — Editor app shell, preview bridge, and auto-save persistence

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #7

## Context

Issue #7 asks for the editor app shell: a Preact two-pane layout (forms left,
iframe preview right) that swaps to tabs on narrow viewports, an
auto-generated site-spine form derived from `@sosb/schema`'s Zod schemas, a
postMessage bridge for the iframe, and an in-memory data model with
debounced auto-save and a working import/export round-trip.

The PRD pins the broad strokes (Implementation Decisions → Editor architecture
and → Editor experience):

- Two-pane editor pane + live preview iframe; tabs at narrow widths.
- Per-block forms auto-generated from per-block schemas (this issue is the
  spine; block forms land with #9–#22).
- Live preview update <200ms after a change.
- Mandatory undo/redo via debounced data snapshots (history stack itself is
  out of scope here; this issue ships only the debounced auto-save half).
- Persistence drivers: OPFS-backed VFS with IndexedDB fallback. The OPFS
  driver and IndexedDB driver are explicit follow-ups (#35 / #37).

The PRD does **not** pin:

- The form-generation introspection mechanism for Zod 4.
- The iframe ↔ host postMessage envelope shape.
- The auto-save storage choice for v1, given that the production OPFS /
  IndexedDB drivers are deferred.
- How the iframe preview reuses the renderer (vs. forking renderer logic).

This ADR records those choices.

## Decision

### Three new packages, narrow seams between them

- `@sosb/editor-state` — framework-agnostic in-memory model + debounced
  auto-save. No Preact dependency.
- `@sosb/preview-bridge` — the postMessage envelope encoder/decoder plus a
  small host-side helper. No Preact dependency.
- `@sosb/editor-app` — the Preact shell. Composes the two modules above with
  `@sosb/schema`, `@sosb/renderer`, `@sosb/vfs`, and `@sosb/zip`.

This split is deliberate: the state model and the bridge are testable in
the default node vitest environment without a DOM, while the Preact shell
adds the jsdom/`@testing-library/preact` cost only to the editor-app tests.

### Form generation: Zod 4 `def.type` introspection over a synthesised field tree

Walking `SiteSchema.shape` and reading `child.def.type` (`"string"`,
`"number"`, `"boolean"`, `"enum"`, `"object"`, `"array"`, `"optional"`)
produces a tree of `FieldNode`s that the form renderer iterates over to emit
one `<input>` / `<select>` per leaf. Optional/nullable wrappers are stripped
upfront and remembered as a per-node `optional` flag.

We **deliberately read `def.type` strings** rather than `instanceof`-checking
Zod's classes, because the class hierarchy shifts between Zod minor
versions but `def.type` is part of Zod 4's documented metadata surface.

The generator carves out `pages[].blocks` — block forms are owned by #9–#22
and would explode the form's complexity here. The carve-out is explicit
(skip the `blocks` key entirely) so a regression test (`field-generator.test.ts`)
can assert it.

Rejected:

- **A pre-existing Zod-to-form library.** Most ship with React, opinionated
  CSS, or a runtime that doubles as a layout engine. We need a 100-line
  walker, not a framework.
- **Hand-coded forms per spine field.** Defeats the PRD's "adding a new
  block type is just defining a schema" goal. The spine form follows the
  same pattern that the future block forms will.

### Preview-bridge protocol: namespaced envelope `{ channel, version, payload }`

Every message is wrapped:

```ts
{ channel: "sosb:preview", version: 1, payload: { type, ... } }
```

- **Channel** namespaces our messages from page noise (analytics scripts,
  embedded widgets, browser extensions all use `postMessage`).
- **Version** lets a v2 iframe loaded into a v1 host fail closed —
  `decodeHostMessage` rejects mismatched versions rather than silently
  partial-decoding a payload.
- **Payload type** is the `siteData` / `ready` / `error` discriminator.

Decoders return `null` (rather than throwing) on any unknown / malformed
input. The host helper's `handleIncomingMessage` is the single funnel for
inbound `MessageEvent.data`; the caller hooks `window.addEventListener`
itself so the helper has no global side effects (and so its unit tests run
without a `window`).

The host helper does **not** install a `message` listener for the caller —
the caller scopes that to a Preact effect. This keeps the helper trivially
unit-testable.

Rejected:

- **A bare `{ type, payload }` shape.** Misses the channel/version
  guarantees. Browser extensions, analytics, and embedded widgets routinely
  post un-namespaced messages and would all match.
- **Symbol-keyed envelopes.** Symbols don't survive postMessage's
  structured clone in any cross-realm scenario.
- **Versioned channel string (`sosb:preview:v1`).** Conflates two axes
  (namespace + protocol version). The current shape lets us evolve channel
  and version independently if either ever needs to.

### Iframe preview reuses the renderer via the editor's own bundle

In v1 the iframe is fed a `srcdoc` whose contents are the **renderer's HTML
output** for the current snapshot. The host calls
`renderPreviewHtml(site, themeId)` (a thin re-export of `renderSite`) and
writes the resulting document into the iframe.

This makes the AC "iframe and main share the renderer — no duplicate code
path" trivially true. There is exactly one symbol — `renderSite` from
`@sosb/renderer` — that produces preview HTML, used by both the editor and
the build pipeline. The byte-equality test
(`packages/editor-app/test/iframe-renderer-reuse.test.ts`) asserts it.

The host **also** posts a `siteData` envelope through the bridge. v1 has no
iframe-side message listener (because the iframe is static HTML), but the
hook is in place for #9–#22's interactive blocks (lightbox, accordion,
mobile nav) to opt in without re-architecting.

Rejected:

- **Bundling a separate iframe-side script that imports the renderer.**
  Two bundlers, two transform configs, two surfaces to keep in sync. The
  AC explicitly says "no duplicate code path"; using `srcdoc` with the
  renderer's HTML literally is the smallest expression of that.
- **`iframe.contentDocument.write(...)`.** Same outcome but stiffer on
  same-origin and CSP. `srcdoc` is the modern equivalent.

### Auto-save persistence: VFS-backed serialisation with caller-chosen driver

`createEditorState({ initial, vfs?, debounceMs? })` accepts any
`@sosb/vfs.Vfs` driver. The state model:

- Holds the snapshot in memory.
- On every `update()`, schedules a debounced write to the VFS at
  `AUTOSAVE_PATH = "editor/autosave.json"`.
- The serialised format is the same UTF-8, 2-space JSON the zip module
  writes — this means an auto-save and an export of the same site are
  byte-identical.

Callers pick the driver:

- v1 ships with `@sosb/vfs.MemoryDriver` for ephemeral state and tests.
- Persistence "across reload" is achieved by callers that pass an
  IndexedDB-backed driver (#37) or an OPFS-backed driver (#35) once those
  land. For v1 in production, the editor's host (Electron / browser shell)
  wires the appropriate driver — the editor's contract is "I write
  snapshots through whatever VFS you give me".

The state package therefore does **not** know about IndexedDB or
`localStorage`. That keeps it node-runnable for tests and avoids a
dependency on a specific browser-storage API at this layer.

The `loadAutosave(vfs)` helper returns the most-recent snapshot or `null`,
and the editor's boot path uses that to seed `EditorState.initial`. This
satisfies the "VFS-backed auto-save persists across reload" AC by way of:
caller picks a persistent driver → editor writes through it → caller
restores via `loadAutosave` on next boot.

The default debounce window is 250ms. This sits comfortably inside the
PRD's 200ms preview-update SLA (which is owned by the bridge subscriber,
not by the auto-save) — auto-save is intentionally a step slower so a
stream of typing-fast edits collapses into a single write.

Rejected:

- **`localStorage` write inside the state package.** Forces a browser
  context on the package, breaking node-runnable tests. Also caps storage
  at a few MB and serialises synchronously.
- **`IndexedDB` write inside the state package.** Same browser-context
  issue, and IndexedDB is the wrong layer for this package — the VFS
  abstraction (#6) already exists for exactly this purpose.
- **No persistence in v1 (defer entirely to #35 / #37).** Would leave the
  AC "persists across reload" unimplementable in v1. The
  caller-chooses-driver design lets v1 deliver the AC with
  `@sosb/vfs.MemoryDriver` plus a thin host-side adapter (e.g. a
  `localStorage`-backed VFS driver in `@sosb/browser-shell`) without
  touching this package.

### Layout switching

The Preact shell reads `window.innerWidth` inside an effect (with a
`resize` listener) and picks two-pane (`≥768px`) or tabs (`<768px`). The
breakpoint matches the PRD's mobile-vs-desktop boundary and is a
single-source constant.

The shell defaults to two-pane in non-DOM environments (vitest's node
runner without jsdom) so SSR-style smoke tests don't crash on missing
`window`.

## Rationale

The most subtle requirement is "iframe preview reuses the renderer code,
no duplicate code path." Two equivalent designs satisfy it:

1. The iframe runs a small JS bootstrapper that imports `renderSite`
   directly (the contract describes this option).
2. The host renders the HTML via `renderSite`, writes it into the iframe's
   `srcdoc`, and the iframe is therefore static HTML — no JS.

We chose (2) for v1 because it eliminates an entire bundling surface, the
iframe is byte-identical to what the build pipeline would produce, and the
postMessage bridge is still in place for #9–#22's interactive-block
listeners to opt into design (1) when they need to mutate the iframe
without a full re-render.

The form-generation walker is intentionally minimal — primitives, optional
wrapping, nested objects, arrays. The PRD-listed quality nudges
(missing-alt warnings, contrast, etc.) live in `@sosb/schema`'s
`validate()`, not in the form. The form's job is to produce inputs; the
validator's job is to flag issues. Keeping that separation lets future
issues (a Site Health panel, contrast warnings) layer on without touching
the form generator.

The auto-save persistence design (caller-chosen VFS driver) was chosen
over a hardcoded `localStorage`/`IndexedDB` write because the project
already has a VFS abstraction (#6) and adding a second persistence
mechanism would have created two parallel storage layers in the editor.
The cost is that v1's `MemoryDriver` doesn't survive a reload by itself;
the v1 browser shell (#36) and Electron shell (#38) wire their own
persistent drivers behind the same interface.

## Consequences

- `pnpm -F @sosb/editor-app add preact zod` and
  `pnpm -F @sosb/editor-app add -D @testing-library/preact jsdom @types/jsdom`
  are run inside the worktree; the lockfile carries the dependencies only
  inside the editor packages.
- The root `vitest.config.ts` gains an `esbuild` block configuring Preact
  JSX so editor-app `.tsx` test files transform correctly. Per-test
  jsdom-vs-node environment selection uses vitest's
  `// @vitest-environment jsdom` comment pragma.
- Each new editor package follows the existing `tsconfig.json` /
  `tsconfig.test.json` split that the schema, renderer, vfs, zip, and
  build packages established.
- The auto-save format is the same as `@sosb/zip`'s `data.json`, so
  debugging an editor session by inspecting the autosave bytes uses the
  same JSON the user would see in their exported zip.
- Future block forms (#9–#22) extend the form generator's switch statement
  but do not change its public API.
- Future persistent VFS drivers (#35, #37) and host shells (#36, #38) plug
  into `createEditorState({ vfs })` without touching this package.

## Alternatives considered

- **Use `preact/signals` instead of a hand-rolled subscribe model.** Would
  force every consumer to depend on signals; for a single-listener Preact
  effect the win is marginal. Revisit if multi-fan-out reactivity becomes
  a real need.
- **Use a state-management library (`zustand`, Redux, `@preact/signals`).**
  Adds a runtime dep for behaviour we can express in 30 lines. The shape
  is so narrow (single document, listeners on update, debounced save) that
  a library would be overhead.
- **Use `react-hook-form` / equivalent for the form layer.** Same as above;
  forces React or a Preact-compat layer, ships a runtime, and we only need
  controlled inputs against a known schema shape.
- **Bundle a separate iframe-side JS module that calls `renderSite`.** The
  renderer-reuse AC allows this. We rejected it because `srcdoc` with the
  rendered HTML is strictly simpler and still satisfies the AC. The
  postMessage bridge remains so future interactive blocks can layer on.

## Out of scope

- Block forms beyond the spine (`hero` form, `richText` form, etc.) — owned
  by #9–#22.
- Undo/redo history beyond the debounced auto-save snapshot — #27 owns the
  history stack and DnD.
- Theme switching UI / theme preview — #47 / #28–#31.
- Wizard / onboarding flows — #33.
- A persistent VFS driver implementation — #35 (OPFS) and #37 (IndexedDB).
- Validation surfacing inside the form (per-field error markers, Site
  Health panel) — `@sosb/schema`'s `validate()` already returns the issue
  list; rendering it is a follow-up issue.
- i18n of the editor UI — #34. v1 ships English-only labels; the
  translation system overlays without restructuring the form generator.
