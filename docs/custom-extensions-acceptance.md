# Custom Themes and Blocks — release acceptance

Issue [#111](https://github.com/dobrerares/student-org-site-builder/issues/111)
asks what evidence makes the developer-first custom-extension release ready.
This document lists each criterion with the evidence that proves it — the
ADR that decides it, the test that pins it, the document that explains it —
and says plainly where evidence is missing. It indexes; it does not restate.
The canonical decisions live in the ADRs and the closed tickets of map
[#104](https://github.com/dobrerares/student-org-site-builder/issues/104).

Status words: **Evidenced** (a test or measured artefact proves it),
**Partial** (proved for part of the scope, the gap named), **Not yet** (no
evidence on `main`; the follow-up named).

Every unit test named here runs in CI (`pnpm test`). The Playwright specs
run locally with `pnpm test:e2e`; CI runs only `e2e/a11y.spec.ts` of them
(see [CONTRIBUTING](../CONTRIBUTING.md), "Continuous integration"). The
workflow e2e is `e2e/custom-extensions-workflow.spec.ts`; its recorded run
and screenshots are in
[screenshots/custom-extensions/](screenshots/custom-extensions/README.md).

## 1. Design fidelity against the published reference — Partial

The reference is the Figma Make Site mockup and its published site, inspected
at desktop and phone widths and through its navigation
([ADR 0046](adr/0046-trusted-executable-theme-and-block-extensions.md),
Context). The example Theme `examples/themes/practice` recreates it as far
as CSS, an executable page shell and a hero override over the **existing**
Blocks allow, and documents its two deliberate departures (type, phone
navigation) in its [README](../examples/themes/practice/README.md).

- Rendering of the recreated design on every page of the sample Site, pinned
  by golden files: `packages/theme-package/test/example-practice-golden.test.ts`;
  every page passes axe: `packages/theme-package/test/example-practice-a11y.test.ts`.
- The shell, the Spotlight hero and the variants:
  `packages/theme-package/test/example-practice.test.ts` ("renders every page
  of the sample site through the executable shell", "the spotlight hero is
  the design's, every other hero the built-in shape").
- Reference screenshots of the example at desktop and phone:
  [examples/themes/practice/screenshots](../examples/themes/practice/screenshots).
- The recreated Site as an author sees it:
  [screenshots/custom-extensions](screenshots/custom-extensions/README.md)
  (static and interactive previews, the built output verified from bytes).

**Gap.** The reference's team tabs, educational accordions and partner groups
need Blocks with fields no built-in Block declares. They wait on Custom
Blocks (§2). Fidelity is therefore proved for the shell, the hero, the card
grids, image/text sections, news/events, banners and forms, and not yet for
those three components.

## 2. Editable Custom Blocks — Not yet

The contract is being settled on issue
[#106](https://github.com/dobrerares/student-org-site-builder/issues/106)
([plan](plans/issue-106-custom-block-contract.md)) and implemented on
`feat/custom-blocks` with ADR 0055; neither had merged when this document
was written. What `main` already provides for it:

- The rendering seam: a Theme design's `blocks` map renders a Custom Block
  type ([ADR 0054](adr/0054-executable-theme-rendering-and-sandbox.md);
  `packages/build/test/theme-render.test.ts` "a design for the type means
  nothing is omitted").
- The omission rule when no design exists
  ([ADR 0045](adr/0045-custom-block-content-and-theme-compatibility.md);
  `packages/editor-app/test/export-omitted-blocks.test.tsx`,
  `packages/build/test/theme-render.test.ts` "omitted Blocks").

**Follow-up (short).** Once #106 merges: add the Partners Custom Block leg
to `e2e/custom-extensions-workflow.spec.ts` (add the Block, fill its heading
and a partner with name, image and link through the generated form, see it
rendered by the Theme's design in both previews and in `dist/`), and move
this section to Evidenced. See also
[Not yet covered](#not-yet-covered-by-the-workflow-run).

## 3. Standalone sharing — Evidenced

A Theme package is exported without Site content, structurally: the export
serialises the package's own files and nothing else
([ADR 0050](adr/0050-theme-package-format.md) "Standalone export excludes
Site content structurally"; [ADR 0051](adr/0051-theme-package-lifecycle.md)
"Standalone sharing").

- `packages/theme-package/test/example-practice.test.ts` "round-trips through
  a .sosb-theme.zip without loss".
- Workflow e2e steps 6–7: the standalone download is byte-identical to what
  the developer zipped (every file compared), and it imports into a fresh
  Site and renders its shell.

## 4. Site round trips — Evidenced

An editable archive carries its Theme packages under `themes/<id>/` and the
built website under `dist/` ([ADR 0051](adr/0051-theme-package-lifecycle.md)
"Storage is per Site").

- `packages/editor-app/test/site-io.test.ts` "copies themes/ entries too —
  the archive carries its own Theme"; `packages/editor-app/test/round-trip.test.ts`
  (import → edit → export → re-import identity).
- Workflow e2e steps 5 and 8: the archive holds `data.json` with the chosen
  variant and edited title, the package, and a `dist/`; a fresh editor
  importing it shows the design, the variant, the content and the installed
  package, and offers the interactive preview again.
- Design choices survive Theme switches without touching content:
  `packages/editor-app/test/theme-switch.test.ts`.

## 5. Offline reopening — Evidenced

- A package cannot depend on the network: remote `@import`, remote and
  protocol-relative `url()`, and every way of spelling them are rejected at
  import (`packages/theme-package/test/validation.test.ts` "offline
  enforcement (ADR 0046)", "offline enforcement cannot be spelled around").
- A design cannot reach the network at render time: the sandbox has no
  `fetch`, `XMLHttpRequest` or timers, probed by `typeof`
  (`packages/theme-package/test/sandbox.test.ts`; ADR 0054).
- The editor itself reopens offline: `e2e/service-worker-offline.spec.ts`
  (cached shell), `e2e/archival-file-url.spec.ts` (single-file archive from
  `file://`); the archive carries its Theme (§4), so nothing has to be
  fetched to open it.
- The public script's external connections run only in the interactive
  preview and are declared in the manifest (`network`, `offline`;
  ADR 0054 "The public-site script"); the pane shows them
  (`packages/editor-app/test/interactive-preview.test.tsx` "tells the author
  what runs and what it may contact"). The example declares `network: []`
  ("declares its public script with an honest, empty network list").

## 6. Preview/build consistency — Evidenced

Preview and build render through one `renderSite` with one resolved
`ThemeBundle` ([ADR 0052](adr/0052-renderer-theme-seam.md)); designs return
trees, not strings, so both go through one serializer (ADR 0054).

- `packages/theme-package/test/preview-build-parity.test.ts` ("every page's
  preview HTML matches its built HTML modulo asset URLs", "the public script
  is the only difference between a static and an interactive preview", "the
  preview resolves exactly the paths the build writes").
- `packages/editor-app/test/preview-build-parity.test.ts` (every registered
  theme; no `blob:` URL and no preview-only script in build output).
- Node vs browser: `e2e/theme-render-parity.spec.ts` (a Theme with
  `render.js`, byte-identical through separately loaded sandboxes) and
  `e2e/renderer-parity.spec.ts`.
- `packages/editor-app/test/preview-public-script.test.ts` "the flag is the
  only difference between the two documents".
- Workflow e2e step 5: `dist/` pages reference `public.js` at the right
  depth, carry it byte for byte, contain no `render.js` and no preview-only
  script, no `blob:` and no `data:` script.

## 7. Incompatible or malformed packages — Evidenced

Rejections are stable codes with messages naming the fault, and a rejected
import changes nothing ([ADR 0050](adr/0050-theme-package-format.md)
"Validation and rejection"; [ADR 0051](adr/0051-theme-package-lifecycle.md)
"A rejected import changes nothing").

- `packages/theme-package/test/validation.test.ts`: missing or non-JSON
  manifest, a future `formatVersion`, bad ids and versions, missing
  stylesheet/font/decorative files, duplicate declarations, the size limit,
  path safety.
- `packages/theme-package/test/render-modules.test.ts`: `render-invalid`
  (syntax error, no default export, foreign import), `public.file` naming the
  design module; `packages/theme-package/test/sandbox-not-ready.test.ts`.
- A Site naming a Theme that is not installed keeps its content, renders
  under the fallback with a repair action, and cannot be exported:
  `packages/build/test/theme-missing.test.ts`,
  `packages/editor-app/test/theme-form.test.tsx` (`theme-missing`,
  `theme-missing-repair`).
- Runtime failures of a design are locatable errors, never silent
  (`packages/build/test/theme-render.test.ts` "rendering failures"; ADR 0054
  "Failure and omission are different things").

## 8. Existing-Site compatibility — Evidenced

- Built-in Themes are byte-for-byte unchanged by the extension seams:
  `packages/build/test/theme-render.test.ts` "built-in Themes produce the
  same bytes with the new options as without"; the golden and a11y matrices
  under `packages/renderer/test`.
- The Site schema stays additive: manifests preserve unknown keys
  (`validation.test.ts` "preserves unknown manifest keys so a future package
  still parses"); Blocks keep their envelope and a variant is an optional
  field ([ADR 0045](adr/0045-custom-block-content-and-theme-compatibility.md)).
- Switching Themes files the outgoing design choices and restores them on the
  way back, never touching Block content
  (`packages/editor-app/test/theme-switch.test.ts`).
- The static preview is unchanged by the interactive mode: same sandbox,
  same morph path (`packages/editor-app/test/interactive-preview.test.tsx`
  "starts off with the static document…", "switching off restores the
  static preview and the morph path"; `e2e/preview-live-update.spec.ts`).

## 9. Documentation and examples — Evidenced

- [How to author a Theme package](how-to-author-a-theme.md): format,
  stylesheet, executable design, helpers, sandbox limits, public script,
  interactive preview, testing, rejection codes, shipping and updating.
- `examples/themes/practice`: the CI-covered reference package
  (`packages/theme-package/test/example-practice*.test.ts`), copied as a
  starting point.
- Decisions: ADRs [0046](adr/0046-trusted-executable-theme-and-block-extensions.md),
  [0050](adr/0050-theme-package-format.md), [0051](adr/0051-theme-package-lifecycle.md),
  [0052](adr/0052-renderer-theme-seam.md), [0054](adr/0054-executable-theme-rendering-and-sandbox.md),
  [0056](adr/0056-interactive-preview-isolation.md); vocabulary in
  [CONTEXT.md](../CONTEXT.md) (Theme package, Theme design, Element tree,
  Render sandbox, Public-site script, Omitted Block, Interactive preview).
- The Custom Block contract document ([plan](plans/issue-106-custom-block-contract.md))
  and ADR 0055 arrive with #106.

## 10. Interactive preview isolation (ADR 0046) — Evidenced

Added here because #110 asked for the preview to be exercised and ADR 0046
set its terms.

- Decision and measurements: [ADR 0056](adr/0056-interactive-preview-isolation.md).
- The sandbox strings and the inline resolver:
  `packages/editor-app/test/interactive-preview-assets.test.ts`; the toggle,
  the document switch, the reload-not-morph rule and the rule that
  selecting another Theme turns the mode off rather than running its script
  ("switching to another Theme turns the mode off…"):
  `packages/editor-app/test/interactive-preview.test.tsx`.
- From inside the frame in a real browser (workflow e2e step 4): the origin
  is opaque, `parent.document` and storage throw `SecurityError`, the script
  ran, no `blob:` URL is present, the external link opens a tab, the
  internal link moves the preview, the editor's chrome is untouched.
- Electron: no child window ever inherits the preload; only web URLs go to
  the system browser; the editor never navigates away
  (`packages/electron-shell/test/window-open-policy.test.ts`); the renderer
  is sandboxed with context isolation
  (`packages/electron-shell/test/browser-window-options.test.ts`).

**Open point.** The packaged renderer's CSP
(`packages/electron-shell/test/renderer-csp.test.ts`) is inherited by
`srcdoc` frames and, as written, refuses the builder's inline preview
scripts and a `data:` script. The renderer bundle is not yet wired into the
Electron shell, so this could not be verified in the packaged app; ADR 0056
§7 records the change the wiring needs.

## 11. Sequencing — Evidenced

1. Extension boundary and package format
   ([#105](https://github.com/dobrerares/student-org-site-builder/issues/105),
   [#107](https://github.com/dobrerares/student-org-site-builder/issues/107),
   [#108](https://github.com/dobrerares/student-org-site-builder/issues/108),
   [#109](https://github.com/dobrerares/student-org-site-builder/issues/109);
   ADRs 0046, 0050–0052) — shipped as phase one, declarative (#115).
2. Executable Theme rendering and the public script (ADR 0054) — shipped as
   phase two (#120).
3. Interactive preview and this acceptance pass (#110, #111; ADR 0056) —
   this change.
4. Custom Block declarations, editor forms and lifecycle (#106; ADR 0055) —
   in flight on `feat/custom-blocks`, rebased onto 1–3.
5. The Partners leg of the workflow e2e and the three reference components
   that need Custom Blocks (§1, §2) — the short follow-up after 4.

Nothing in 4 or 5 changes a format: manifests are forward-compatible
(ADR 0050 "Forward compatibility with phase two") and the Block envelope is
unchanged (ADR 0045).

## Not yet covered by the workflow run

Marked here so the follow-up is one edit rather than a search:

- **Custom Block with editable fields (Partners).** Not on `main` when the
  run was recorded; the workflow spec says so in its header and this document
  in §2. Add the leg once #106 merges.
- **Electron packaged app.** The run is headless Chromium against the React
  editor; the Electron renderer bundle is staged (its README), so the CSP
  open point in §10 stands until it is wired.
- **Firefox and Safari.** The sandbox behaviour relied on (`allow-same-origin`
  absent ⇒ opaque origin ⇒ `blob:` refused, `data:` allowed) is
  specification behaviour; it was measured in Chromium only, in line with
  the project's Playwright configuration. There is no cross-browser suite
  and no manual QA checklist in the repository today; a release check in
  either browser should switch the mode on for the example Theme and confirm
  the probe results the workflow e2e asserts (step 4).
