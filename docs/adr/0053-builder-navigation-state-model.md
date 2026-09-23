# 0053 — Builder navigation state model: destinations, workspaces, and a separate preview target

- **Status:** Accepted
- **Date:** 2026-09-23
- **Issues:** #102 (accepted builder workflow design), #103 (implementation
  handoff). Revises the shell half of ADR 0042; keeps its Inspector drill-in.

## Context

ADR 0042 gave the editor pane a drill-in Inspector but left the shell as one
pane with a `PagesList`, a `DrillMode`, and later a temporary `contentKind`
switch for Articles (#97). Issue #102's accepted design replaces that with
persistent main navigation over five destinations — Overview, Pages,
Articles, Theme, Site settings — two of which open a focused _workspace_ for
one Page or one Article, with editing and preview side by side on larger
screens and one at a time on phones. It also asks for preview clicks to
behave like the public website, for distinct **Save project** and **Export
website** actions, and for an export readiness panel.

Three things were not obvious once the design met the code: how to represent
"where the builder is" so that deleted or imported-away content cannot leave
the shell pointing at nothing; what to do when the preview and the editing
pane disagree about which content they show; and how the readiness panel's
gate relates to ADR 0016 ("never hard-block") and ADR 0048 (`blocking`
issues).

## Decision

### 1. A pure, React-free `Destination`, reconciled during render

`builder-navigation.ts` holds the model: a closed `Destination` union
(`overview` · `pages` · `pageWorkspace { pageIndex }` · `articles` ·
`articleWorkspace { articleId }` · `theme` · `settings`) and a
`WorkspaceDrill` union (`outline` · `block { blockId }` · `settings` ·
`related`) that carries ADR 0042's Inspector into the workspace unchanged.
List and workspace destinations are separate cases, so "no content open" is
unrepresentable as a workspace and every consumer must handle both.

Pages are addressed by index because every patch path in the editor is
already index-rooted; Articles by permanent id because the list reorders and
filters them, so an index would mean something different from one render to
the next.

`reconcileDestination(destination, site)` and `reconcileDrill(drill,
blockIds)` drop a target that no longer exists (the page being edited was
deleted, a different project was imported, the Block under an open Inspector
was removed) by falling back to the surrounding list or the outline. The
shell runs them **during render**, not in an effect, so it never paints a
workspace bound to nothing; both return the same object when nothing changed,
so the `setState` they trigger is a no-op in the common case.

No URL router. The builder runs in a browser tab, in Electron, and as a
single `file://` archive; hash routing would be the only common denominator,
and a browser Back button that undid navigation but not edits would be more
confusing than none. Navigation state is shell state.

### 2. What the preview shows is separate from what is being edited

`previewTarget` is its own piece of shell state. Entering a workspace points
it at the content being edited; a site-wide destination (Theme, Site
settings) leaves it where it was, so changing a theme previews the page the
author was just working on rather than the home page. Clicks inside the
preview resolve like the public website (`resolvePreviewTarget`, including
Article URLs and retired slugs) and move **only** the preview. The pane shows
what it is looking at, offers a way back to the edited content, and an
explicit **Edit this Page / Edit this Article** action that makes the
previewed thing the edited thing — the only path that changes the editing
pane from the preview side.

### 3. One split view; the hidden pane is hidden, not unmounted

The workspace, Theme and Site settings all render through `SplitView`:
editing beside preview at ≥768px, one at a time behind an Edit / Preview
switch below. The pane that is not showing stays mounted. The preview holds a
live iframe document whose scroll position and open disclosures PR #116
preserves across edits; unmounting it on every switch would throw that away,
and an Inspector the author drilled into should still be there when they
switch back.

### 4. Escape drills out one level and never leaves the workspace

Escape from a Block Inspector returns to the outline. It does not return to
the list — that is what the back button is for, and an Escape that threw away
the whole editing context would be a nasty surprise. When the phone drawer is
open, Escape closes the drawer first (captured before the workspace's
listener).

### 5. Save project and Export website are different verbs with different gates

**Save project** writes the editable archive, Drafts included, and is never
gated by validation. **Export website** always opens the readiness panel,
even on a clean project: it is where the author learns that exporting does
not update the live website. The gate mirrors the schema's own semantics
rather than inventing one: `blocking` errors (ADR 0048) disable export
outright because there is no correct file to write; ordinary errors keep
ADR 0016's typed-phrase override; warnings gate nothing. The top bar shows
two facts, deliberately unmerged — when the project was last saved here and
when a copy last left the machine — because an author who reads only "Saved"
can reasonably believe they have a file somewhere. Without a place to
autosave (the archival build, an embedded editor) Save project downloads the
archive, ungated, because that is the only way to keep the work.

### 6. A new Draft's address follows its title until the author takes over

Create Article opens the Draft immediately with an empty title (issue #102,
round two), so the address cannot be derived at creation the way the old
title-first dialog did. While the Article is a Draft with no slug history and
an address still derived from its title, the address keeps following the
title. Editing the address, publishing, or a rename that minted history all
stop it — a live URL never changes under the author.

## Rejected

- **Keep `contentKind` + `activePageIndex` + `DrillMode`.** Three flags that
  could disagree about what was open; the Articles wiring had already
  produced a duplicated Block Inspector that drifted.
- **Hash router.** See §1.
- **Unmount the hidden pane on phones.** Cheaper to reason about, but loses
  the preview document and the drill state on every switch.
- **Preview clicks change the edited page.** Reading and editing are
  different activities; the accepted design says browsing the preview is not
  editing.
- **Hard-block ordinary errors in the readiness panel.** Would break the
  PRD's "never hard-block"; the panel makes the distinction visible instead.

## Consequences

- `@sosb/editor-app` gains `builder-navigation.ts` (with unit tests for the
  awkward cases), `MainNav`, `OverviewScreen`, `PagesScreen`,
  `ArticlesScreen`, `Workspace`, `SplitView`, `BlockInspector`, `PreviewPane`,
  `ExportReadinessPanel`, `FindingList`. The shell composes them; each is
  exported standalone.
- The health footer, the Site Health side panel and the pre-export
  confirmation dialog are no longer mounted by the shell. Their components
  remain exported for hosts that composed their own chrome.
- Tests and specs that assumed a Block list at boot now open a page first
  (`test/helpers/nav.ts`, `e2e/builder-helpers.ts`).
- Vocabulary in `CONTEXT.md`: **Destination**, **Overview**, **Workspace**,
  **Preview target**, **Export readiness panel**, **Save project / Export
  website**.
