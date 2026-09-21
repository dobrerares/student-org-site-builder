# Rich-text editing contract

Design interview for [issue #100](https://github.com/dobrerares/student-org-site-builder/issues/100).
The complete design was confirmed by the user on 2026-09-17.
This document describes planned behavior, not implemented functionality.

## Confirmed decisions

- Pages and Articles share the same toolbar-based Rich-text Block editor.
  Other Block types retain their dedicated controls. Articles remain ordered
  collections of Blocks, as established in issue #97.
- Supported prose formatting: paragraphs, H2–H4 headings, bold, italic,
  underline, strikethrough, links, numbered and bulleted lists, blockquotes,
  and inline code. Themes control fonts, colors, and sizing. Tables and
  code fences are deferred.
- Authors can insert local images between paragraphs using the existing
  asset pipeline, with image descriptions and optional captions. Images
  occupy their own line; text wrapping and arbitrary positioning are deferred.
- Link authoring supports selecting Pages and Articles, plus entering web,
  email, and telephone links. Selected internal targets remain connected
  when their URLs change.
- Markdown fields in other Block types, including FAQ answers and quotes,
  remain unchanged in this issue.
- Rich-text Blocks persist a versioned structured document independent of
  the eventual toolbar library, with explicit formatting, image references,
  and internal link targets. Public output is static HTML.
- Opening older projects automatically converts legacy Rich-text Markdown
  while preserving the current renderer's displayed meaning. Unsupported
  Markdown remains literal text; FAQ and quote fields do not migrate.
- Paste retains supported formatting and links, removes fonts, colors, and
  layout styling, and flattens tables to readable text. Actual clipboard image
  files use the asset pipeline. Remotely hosted images are omitted with notice.
- While focused inside rich-text editing, Ctrl/Cmd+Z undoes local typing and
  formatting. Outside it, undo operates on Site history. Each editing visit
  forms one Site-history entry restoring its previous content. Updates reach
  preview and export immediately; history grouping does not buffer saved content.
- Deleted Page or Article targets and Draft Article targets retain their internal link
  references for repair, produce Site Health findings, and render as unlinked
  text in public output. Links to Unlisted articles are allowed. Selecting a
  Draft target warns the author.
- Rich-text images follow the upload-only asset picker contract: upload,
  replace, remove, description, and optional caption. Project archives retain
  image files. Missing files show editor placeholders; missing bytes or image
  descriptions produce Site Health findings.
- Unsupported rich-text features in imported projects retain their original
  content with an explanation. Affected content cannot be edited or publicly
  exported until supported; automatic simplification is forbidden.
- Switching Blocks, Pages, or Articles ends an editing visit and its local
  undo history; returning starts a fresh local history. Formatting menus,
  link dialogs, and image pickers remain within the visit. Importing another
  project resets both local and Site histories.
- Broken prose links warn and render as unlinked text. This revises issue #97's
  earlier rule for ordinary internal Article links; unavailable targets in
  active explicit Article-list selections in public content still block export.
- Missing image bytes and unsupported rich-text content in public content
  block public export without an override. Missing image descriptions remain
  warnings. Problems confined to Draft articles do not block public export.
  Saving the editable project archive remains available in every case.

## Architectural amendments

- ADR 0048 replaces ADR 0034's Markdown storage and textarea-only constraints
  for Rich-text Blocks. Other Blocks' Markdown fields retain ADR 0034.
- The public-export blockers above and issue #97's active explicit-selection
  blockers are exceptions to ADR 0016's universally overridable errors.
  Saving an editable archive must be independent of generating public output.

## Handoff verification

- Project archive export/import preserves supported formatting, captions,
  image bytes and descriptions, and internal target identities. Reopening
  requires no image re-uploads. Unsupported imported content remains intact
  in the editable project archive even when editing is unavailable.
- Legacy conversion preserves the current Markdown renderer's displayed
  meaning, including unsupported syntax rendered as literal text.
- Node builds and browser previews produce identical static rich-text output
  for identical inputs. Validate document structure and URL attributes and
  escape text; structured storage does not make imported content trusted.
- Browser, offline archival HTML, and Electron support the same content
  contract without requiring network resources or shipping the editing
  runtime to the public Site.
- Exercise typing, formatting, dialogs, image insertion, switching Blocks,
  local undo/redo, Site undo/redo, project import, and immediate export,
  including input-method composition, to detect stale content and history
  synchronization errors.
- Verify public-export blockers cannot be bypassed by the existing typed
  confirmation or validation-skip paths, while editable archives can still
  be saved. Draft-only problems must not affect public-export eligibility.

## Review

All interview choices are resolved. The user confirmed the complete contract
and requested publication of the resolution on 2026-09-17. The architectural
decision is recorded in accepted ADR 0048; no implementation or UI-stack
selection has been performed.
