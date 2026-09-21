# Builder UI stack and migration contract

Design interview for [issue #101](https://github.com/dobrerares/student-org-site-builder/issues/101).
The complete contract was confirmed by the user on 2026-09-17, with publication
of the resolution requested. These are planned decisions, not implemented or
validated functionality.

## Confirmed decisions

- Migrate the editor, onboarding Wizard, and browser welcome interface to React.
  Retain Preact in the public-site Renderer, with Site data and rendered HTML
  as the boundary. Public-site Theme redesign is outside this issue.
- Maintain shared shadcn components and builder styles in one UI package used
  by all three interfaces. Keep builder styles separate from public-site styles.
- Preserve schema-generated forms and editor-owned field overrides under ADR 0043. Use shared controls in those forms and explicit overrides for specialized
  experiences such as Rich-text editing.
- First migrate the framework and components while preserving current workflows.
  Then implement the workflow/navigation redesign approved through prototype
  issue #102.
- Require browser, Electron, and offline single-file archive validation,
  keyboard/focus checks, asset import/export, rendering consistency, and
  representative rich-text interactions before calling the migration complete.
- Select Tiptap with editorcn's toolbar as the rich-text integration candidate,
  subject to that validation gate. Adapt image, link, and history interactions
  to issue #100's existing contract.
- Refresh existing common controls across the editor, Wizard, and welcome
  interface during the first migration, preserving their workflows. Retain
  specialized native interactions such as file selection where appropriate.
- Copy the required editorcn toolbar source into the repository, recording its
  upstream revision and retaining applicable notices. Maintain local image/link,
  accessibility, and history adaptations and review upstream updates manually.
  Tiptap remains a dependency behind the library-independent content contract.
- Use Base UI as the primitive foundation for the shared shadcn controls,
  matching editorcn rather than introducing a second general-purpose primitive
  system. Shared controls and styles belong to the UI package; Site-aware
  adapters and schema-form overrides remain editor-owned.

## Existing contracts retained

- Schema, editor state, preview bridge, assets, and build logic retain their
  existing responsibilities; the UI migration does not require React in these
  framework-independent concerns.
- The shared Renderer retains deterministic Node/browser output and the
  existing preview update requirement. Editing UI dependencies do not become
  public-site runtime dependencies.
- Rich-text storage, conversion, assets, publication checks, and history behavior
  follow [issue #100's confirmed contract](issue-100-rich-text-contract.md) and
  ADR 0048. This interview does not reopen those product decisions.
- Offline operation and Electron's existing isolation/CSP constraints remain.

## Evidence required from implementation

The following expands the confirmed validation scope into reviewable checks:

- Exercise the same representative controls in the browser shell, packaged
  Electron interface, and archival HTML opened offline via `file://`.
  Include compiled CSS, icons, and any selected fonts in the delivered artifacts.
- Verify dialog/popover focus entry and return, keyboard operation, accessible
  names and visible focus, and the existing responsive behavior.
- Exercise generated fields and specialized overrides, including asset upload,
  replacement, archive saving and reopening without re-uploading files.
- Exercise rich-text typing, formatting, selection through dialogs, input-method
  composition, local versus Site undo, navigation, project import, and immediate
  export according to issue #100. Source research found a global undo handler
  requiring integration with rich-text history; this is not a reproduced bug.
- Compare Node/browser Renderer output for identical inputs and ensure builder
  CSS and editing runtimes do not enter public output. Measure preview update
  behavior against the existing under-200ms requirement.
- Run repository typecheck, lint, tests, and builds with package-appropriate JSX
  settings. Record exact tested dependency versions and shell artifacts; library
  documentation alone is not integration evidence.

The archive currently uses a separate esbuild path that does not collect
generated CSS. Configuring Vite alone is insufficient. These observations come
from source inspection and [issue #99 research](https://github.com/dobrerares/student-org-site-builder/blob/bae2366/docs/research/articles-editor-ui.md),
not from an executed integration test.

## Review

There are no remaining design questions in the current migration boundary.
Exact dependency versions and package-specific build configuration are
implementation choices that must satisfy the recorded evidence requirements.
Failing those requirements leaves the integration unvalidated; it does not
authorize silently dropping a shell, changing the content contract, or switching
the chosen stack.

The architectural boundary is recorded in ADR 0049. The user confirmed shared
understanding and requested publication of the resolution on 2026-09-17.
Issue #101 resolves the technical decision; implementation and integration
validation remain future work. Issue #102 next validates the navigation and
workflow redesign through an interactive prototype and live user feedback.
No integration tests have been run as part of this design interview.

## Phase one implementation notes

Written during implementation on 2026-09-21. Phase one covers the framework
and component migration only; the navigation/workflow redesign (issue #102),
Articles, tags and the Tiptap rich-text editor are later phases and were not
started.

### Tested dependency versions

Exact, pinned (no ranges) in the affected manifests:

| Package                     | Version    | Where                                               |
| --------------------------- | ---------- | --------------------------------------------------- |
| `react` / `react-dom`       | 19.3.0     | `@sosb/ui`, editor-app, wizard, browser-shell, root |
| `@types/react` / `-dom`     | 19.3.0     | same                                                |
| `@testing-library/react`    | 16.3.3     | editor-app, wizard, browser-shell, ui               |
| `@testing-library/dom`      | 10.4.1     | same (RTL 16 peer)                                  |
| `@base-ui-components/react` | 1.0.0-rc.0 | `@sosb/ui`                                          |
| `tailwindcss`               | 4.3.3      | `@sosb/ui` (source)                                 |
| `@tailwindcss/cli`          | 4.3.3      | `@sosb/ui` (build)                                  |
| `clsx`                      | 2.1.1      | `@sosb/ui`                                          |
| `tailwind-merge`            | 3.7.0      | `@sosb/ui`                                          |
| `class-variance-authority`  | 0.7.1      | `@sosb/ui`                                          |
| `preact`                    | ^10.29.1   | `@sosb/renderer` only — unchanged                   |

Base UI has no stable release yet; `1.0.0-rc.0` is the `latest` dist-tag as
of this date. That is the version the recorded evidence was produced
against.

No icon library was added. The editor's own `icons.tsx` (inline SVG) covers
every icon in use, so `lucide-react` would have been a new dependency and new
bytes in the offline archive for no gain.

### What changed

- `@sosb/editor-app`, `@sosb/wizard` and `@sosb/browser-shell`'s welcome
  interface run on React. `@sosb/renderer` remains Preact; Site data and
  rendered HTML are still the only boundary, and the preview iframe keeps
  mounting the Preact renderer.
- `@sosb/editor-state`, `@sosb/schema`, `@sosb/preview-bridge`,
  `@sosb/assets`, `@sosb/vfs`, `@sosb/zip` and `@sosb/build` were not
  touched and declare no React dependency.
- New `packages/ui` (`@sosb/ui`): Button, Input, Textarea, NativeSelect,
  Label, Hint, Dialog, Popover, Select (listbox), Tabs, Toast, and `cn`.
- Adopted in all three interfaces: buttons, inputs, textareas and native
  selects; both editor modals (via a new `EditorDialog` adapter); the
  narrow-viewport layout switcher (now real tabs).

### Decisions the contract did not settle

- **No Tailwind preflight.** Importing it would reset every existing
  surface, which contradicts "preserve current workflows". `@sosb/ui` ships
  a reset scoped to `data-sosb-ui`, an attribute only its own controls
  carry.
- **Cascade layers as the compatibility mechanism.** Everything the shared
  package emits sits in `@layer utilities` / `@layer base`; the existing
  `editor-app-css.ts` and `welcome-shell-css.ts` are unlayered and therefore
  outrank it. Adoption cannot regress a surface that already had an opinion,
  and the shared defaults still apply where it did not.
- **Two CSS delivery paths.** The archival entry imports
  `@sosb/ui/styles.css` so the bundler genuinely collects it. The Vite dev
  entry and the e2e entries use `@sosb/ui/css`'s injector instead, because
  the e2e specs bundle them through a no-output-path esbuild call that
  rejects CSS imports outright. The Electron renderer can use either; its
  CSP already allows both.
- **Committed generated CSS.** `builder.generated.css` and
  `builder-css.generated.ts` are produced by
  `pnpm --filter @sosb/ui run build:css` and committed, so `tsc`, `vitest`,
  Vite, esbuild and Electron all see identical bytes with no mandatory
  codegen step in the critical path. Re-run the script after changing
  Tailwind class names.
- **Per-file JSX pragma everywhere.** Every `.tsx` in the repo now declares
  `@jsxImportSource`. The repo is deliberately mixed and several build paths
  set a global runtime; a per-file pragma removes the ordering hazard and
  means the e2e specs' esbuild configuration did not have to change.
- **`onInput` kept, typed as `React.FormEvent`.** Rewriting to `onChange`
  would have changed which native events reach the handlers and would have
  churned every test that dispatches a raw `input` event.
- **axe focus-guard exclusion.** Base UI brackets its dialog popup with two
  visually hidden `role="button"` focus guards. They are empty by
  construction, so axe's `aria-command-name` rule fires on an upstream
  implementation detail. The two affected a11y tests exclude
  `[data-base-ui-focus-guard]` and audit everything else.

### Verification actually run

All commands run on this machine, 2026-09-21, Node v24.15.0, pnpm 10.33.3.

| Command                                                | Result                            |
| ------------------------------------------------------ | --------------------------------- |
| `pnpm typecheck`                                       | pass — all 16 packages            |
| `pnpm lint`                                            | pass — no findings                |
| `pnpm test`                                            | pass — 214 files, 2244 tests      |
| `pnpm build`                                           | pass — all 16 packages            |
| `pnpm --filter @sosb/browser-shell run build:archival` | pass — `builder.html`, 1849.1 KiB |
| `pnpm exec playwright test --workers=1`                | pass — 34/34 chromium specs       |

`--workers=1` is required here: this is a 4 GB machine and Playwright's
default of 3 workers exhausts it.

Baseline before any change, for comparison: typecheck/lint/build pass, 210
test files / 2217 tests pass, archival build produces a 1375.1 KiB
`builder.html`. The archive grew by ~474 KiB, which is React DOM plus Base
UI plus the compiled stylesheet; it remains well inside the 3 MB budget the
existing `archival-cli` test asserts.

Evidence for specific contract items:

- **Offline single-file archive with CSS.** `archival-file-url.spec.ts`
  opens the built `builder.html` over `file://` with no network and drives
  the editor. `packages/browser-shell/test/archival-css.test.ts` asserts the
  compiled builder CSS is present in the HTML, that no stylesheet `<link>`
  survives, and that nothing references an `http(s)` origin.
- **Builder CSS absent from public output.**
  `packages/build/test/no-builder-css.test.ts` checks every file `build()`
  emits for builder markers, and checks that `@sosb/build` and
  `@sosb/renderer` declare no builder-only dependency.
- **Dialog/popover focus entry and return, keyboard operation.**
  `packages/ui/test/components.test.tsx` asserts focus moves into the
  dialog on open, returns to the trigger on close, Escape dismisses, the
  title/description are wired for screen readers, the popover's
  `aria-expanded` tracks state, and the tab list roves focus with the arrow
  keys. The two axe suites still pass on the editor's dialogs.
- **Asset import/export, round trips.** The existing
  `asset-picker-upload`, `asset-picker-hero-org`,
  `document-picker-upload`, `round-trip-zero-reuploads` and
  `browser-shell-download` e2e specs pass unchanged, so upload, replacement,
  archive save and reopen-without-re-uploading still work.
- **Renderer parity and preview latency.** `renderer-parity.spec.ts` and
  `build-browser.spec.ts` (byte-identical Node vs. browser output) pass
  unchanged, as does the editor's existing under-200ms preview-update test
  (`edit-propagation.test.tsx`).

### Gaps — what was NOT verified

- **Packaged Electron app.** Not exercised. `@sosb/electron-shell` still
  builds (`tsc --build`) and its 132 unit tests pass, and a new
  `test/renderer-csp.test.ts` pins that the renderer CSP permits the
  builder stylesheet (`style-src 'self' 'unsafe-inline'`), keeps scripts
  same-origin, allows no `unsafe-eval` and names no remote origin. But the
  repo has never shipped a bundled `renderer.js` — `renderer/README.md` has
  always recorded that as follow-up wiring — so there is no packaged app to
  launch here, and `electron-builder` packaging was not run. The claim
  "Electron still builds under its CSP/isolation constraints" is supported
  by the build, the tests and the CSP assertions, not by a launched binary.
- **Screen readers, IME, real touch devices.** Not tested. The keyboard and
  ARIA evidence above is jsdom and headless Chromium only.
- **Colour contrast.** The axe suites disable `color-contrast` (jsdom does
  not compute styles); that convention predates this work and was kept.
- **Rich text.** Out of scope for phase one. Tiptap and editorcn were not
  added, so the undo-ownership question the research raised is untouched
  and still open for issue #100's phase.
- **Popover, Select (listbox) and Toast adoption.** The primitives exist in
  `@sosb/ui` with tests, but the builder currently has no popover, listbox
  or toast surface to convert — its transient messages are inline banners
  and its selects are native by design. Adopting them belongs with the
  issue #102 navigation redesign rather than to a migration that is
  supposed to preserve workflows.
