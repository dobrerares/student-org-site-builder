---
status: accepted
---

# React builder UI and Preact public-site Renderer

Issue #101 selects React for the builder's editor, onboarding Wizard, and
browser welcome interface, while retaining Preact in the public-site Renderer.
Using the React path for shadcn avoids taking ownership of a Preact compatibility
layer for the new controls; the migration cost is accepted, while replacing the
static Renderer would add work unrelated to the builder UI refresh.

The framework boundary was confirmed on 2026-09-17. This revises the builder UI's
Preact choice described in ADR 0005 and the stack context in ADR 0001; it does
not replace the Renderer or change public-site Themes. React UI and Preact
rendering meet through Site data and rendered HTML, not shared framework
component instances.

This is a selected direction, not a tested integration. Browser, Electron,
and offline single-file archive delivery must still be validated.

## Shared UI and migration boundary

The editor, Wizard, and welcome interface share shadcn components built on Base
UI and builder styles maintained in one UI package. Builder CSS stays separate
from public-site Theme CSS. Schema-generated forms and editor-owned field overrides retain ADR
0043's ownership model and consume the shared controls; specialized experiences
use explicit overrides rather than moving presentation metadata into the schema.

The React/component migration preserves existing workflows first. The approved
navigation and workflow redesign follows separately through issue #102's
prototype. Both remain part of the overall builder redesign. The component
refresh covers common controls across all three interfaces, retaining specialized
native interactions where appropriate.

Tiptap with editorcn's toolbar is the selected rich-text integration candidate.
The required editorcn source is copied into the repository with its upstream
revision recorded; local adaptations and manually reviewed upstream updates
become repository responsibilities. This trades package-update convenience for
control over image/link integration, accessibility fixes, and history behavior.
The library-independent content and history contract from issue #100 and ADR
0048 remains binding. Site-aware adapters remain editor-owned.

Completion requires working browser, Electron, and offline single-file archive
builds; keyboard and focus checks; asset import/export checks; and preview/export
rendering consistency. Representative rich-text interactions are part of this
gate. Detailed evidence is tracked in the
[issue #101 design contract](../plans/issue-101-builder-ui-stack.md), confirmed
in full by the user on 2026-09-17.

The source-only [issue #99 research](https://github.com/dobrerares/student-org-site-builder/blob/bae2366/docs/research/articles-editor-ui.md)
compares React migration with Preact compatibility and identifies packaging,
focus, history, and rendering risks. It supplies no runtime validation.
