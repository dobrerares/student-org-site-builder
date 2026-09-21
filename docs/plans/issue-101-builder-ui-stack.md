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
- Preserve schema-generated forms and editor-owned field overrides under ADR
  0043. Use shared controls in those forms and explicit overrides for specialized
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
