# Builder navigation and authoring prototype

Design interview for [issue #102](https://github.com/dobrerares/student-org-site-builder/issues/102).
The user confirmed the complete design and requested publication to the issue
on 2026-09-17. These are prototype directions, not implemented behavior or
human acceptance of an interactive prototype.

## Confirmed direction

The user accepted the first interview round on 2026-09-17:

- Open a Site into a content overview. Pages and Articles have separate
  destinations in persistent navigation; each opens a focused editing workspace.
- Use a restrained writing-tool appearance: neutral surfaces, clear typography,
  one accent colour, and visible labels. The Site preview reflects its Theme.
- Support all core authoring tasks on phones, including Blocks and Article lists.
  Show editing and preview one at a time on small screens and side by side on
  larger screens.

The user accepted the second interview round on 2026-09-17:

- Selecting a Block opens a focused Inspector with a clear back button and
  content title, retaining the existing drill-in pattern.
- Creating an Article immediately opens a Draft with a title field and an
  initial Rich-text Block. Its language defaults to the current content
  language. Summary, cover, publication date, tags, and publication state are
  available in Article settings.
- Keep a visible Draft/Published/Unlisted selector and explain that changes go
  live after export and redeployment. Provide distinct Save project and Export
  website actions.
- The Articles destination offers a searchable list showing title, language,
  publication state, and date, with language, state, and tag filters. Manage
  tags is accessible here; inline tag creation remains available in Article
  settings and Article-list configuration.

The user accepted the third interview round on 2026-09-17, with a global
presentation correction: explanatory help belongs behind a small, openable
information (i) icon rather than appearing as persistent prose. Apply this
also to explanations specified in earlier rounds, including publication and
redeployment guidance. Support click, tap, and keyboard activation.

- Article-list configuration uses By tag / Select articles modes in the
  Inspector, with matching Article cards below the controls. Explain any-tag
  matching and the no-tags behavior through information icons. Explicit
  selections support search, reordering, and language/state labels.
- Related Articles appears after an Article's Block outline. Enabling it opens
  the shared list controls; disabling it preserves settings.
- Preview clicks behave like the public website. An explicit Edit this
  Page/Article action opens the previewed destination for editing. Opening a
  Block's Inspector retains the adjacent preview on larger screens.
- Save project saves the editable archive, including Drafts. Export website
  opens a readiness panel with actionable problems and an export button.
  Distinguish local save status from a downloaded project copy; explain via an
  information icon that exporting does not update the live website.

The user accepted the fourth interview round on 2026-09-17:

- Actionable errors, warnings, and repair actions remain visible. Longer
  explanations appear behind information icons.
- The opening content overview contains Pages and Articles summaries, Create
  Page / Create Article actions, and Site Health status. Theme and Site settings
  remain accessible in main navigation.
- Offer Move up / Move down alongside drag handles for Blocks and explicitly
  selected Articles. On phones, use a navigation drawer and full-width Inspector.
  Dialogs restore focus to their opening control; information popovers close
  with Escape or an outside tap.

## Existing constraints

Retain the confirmed contracts in issues #97, #98, #100, and #101 for Articles,
tags, rich text, and the builder UI stack. Navigation changes must account for
ADR 0042's current Inspector drill-in pattern; replacing it requires an explicit
decision. Saving an editable archive and exporting the public Site must remain
distinct, and public-export blockers must not prevent archive saving.

## Pending validation

All four interview rounds and the consolidated understanding have been
confirmed by the user. Building and validating the throwaway interactive
prototype remain outstanding. The prototype must exercise Article creation and writing, metadata
and tags, publication states, both Article-list modes, explicit prose links and
placements, related Articles, preview navigation, representative Page/Block
editing, archive saving, and public-export feedback on large and small screens.
Record the user's acceptance or rejection of the actual interactive experience;
agreement with this document alone is not prototype validation.

No production behavior has changed and no prototype has been validated. These
choices preserve the focused Inspector of ADR 0042; there is no new architectural
trade-off requiring an ADR yet. No new glossary terms were introduced.
