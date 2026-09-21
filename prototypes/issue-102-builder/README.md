# Throwaway prototype — builder navigation and authoring (issue #102)

**This is not production code.** It is a disposable React app built only to answer
one question: _does the redesigned builder described in
[`docs/plans/issue-102-builder-workflows.md`](../../docs/plans/issue-102-builder-workflows.md)
feel right to use?_ Nothing here is imported by `packages/`, none of it is
schema-driven, there are no tests, and all data lives in React state and
disappears on reload. Judge the experience, not the code.

Contracts it tries to respect: publication states and list modes (#97), tag
behaviour (#98), rich-text and link authoring (#100), and the shadcn/React
direction with the Inspector drill-in of ADR 0042 (#101, ADR 0042).

## Run it

```sh
corepack pnpm install                                   # once, at the repo root
corepack pnpm --filter @sosb/prototype-issue-102-builder dev
```

Then open <http://127.0.0.1:5202/>.

Reload the page at any time to get the seeded project back.

To try the phone layout, either narrow the browser window below 820 px or use
the browser's device toolbar (390 × 844 is what the screenshots use).

## What is in the fake project

- Four pages: **Home**, **About us**, **Join us** (English) and **Acasă** (Romanian).
- Eight articles across English and Romanian: five Published, two Drafts, one Unlisted.
- Five tags: Events, Volunteering, Alumni, Workshops, Announcements.
- Two problems seeded on purpose:
  - **Join us** explicitly selects the Draft article "Grant results…" → blocks export.
  - **About us** has a prose link to that same Draft → a warning only.

## Walkthrough script

Do 1–14 on a wide window, then repeat 15–18 at phone width. Tick as you go.

### Wide window

1. **Content overview on open.** You land on the overview: a Pages summary, an
   Articles summary with Published / Draft / Unlisted counts, **Create Page** and
   **Create Article**, and a **Site Health** card listing the two seeded problems.
   Theme and Site settings sit in the left navigation and at the bottom of the
   overview. `[ ]`
2. **Pages and Articles are separate destinations.** Click **Pages** in the
   navigation, then a page: it opens a focused workspace with editing on the left
   and the preview on the right. Go back with **← All pages**. Do the same from
   **Articles**. `[ ]`
3. **Articles list.** In **Articles**, search by title, then filter by language,
   by publication state, and by tag. Every row shows title, language, state and
   date. Clear the filters with **Clear filters**; set an impossible combination
   to see the empty state. `[ ]`
4. **Manage tags.** From the Articles list, open **Manage tags**. Rename a tag
   (note the duplicate rule behind the (i): names differing only in case or
   spacing count as the same tag). Then press **Delete** on _Events_: the
   confirmation names the number of tagged articles, lists the article lists that
   filter on it, and warns explicitly where it is the list's only tag so that
   list will start showing every eligible article. Cancel or confirm. `[ ]`
5. **Create an Article.** Press **Create Article**. It opens immediately as a
   **Draft**, in the current content language (change the language in the left
   navigation first if you want to check that), with a title field and one
   Rich-text block already there. `[ ]`
6. **Write.** Open the Rich-text block. Type; use the toolbar for H2–H4, bold,
   italic, underline, strikethrough, inline code, lists and a quote. `[ ]`
7. **Link to a Page or Article explicitly.** Select some words, press **🔗 Link**,
   choose **Article**, search, and pick **"Grant results…"** (a Draft): the dialog
   warns that the link will render as plain text until it is published, with the
   longer explanation behind the (i). Escape closes the dialog and focus returns
   to the toolbar button. Try the Page, Web address, Email and Phone tabs too. `[ ]`
8. **Article settings.** Back out with **← Back to "…"**, open **Article
   settings**: summary, cover image, publication date, tags (searchable picker,
   with inline **+ Create tag "…"**), web address. The **Draft / Published /
   Unlisted** selector is visible both here and on the outline, with the states
   and the "changes go live after you export and upload" explanation behind
   its (i). `[ ]`
9. **Blocks, moving, Inspector.** On the outline, press **+ Add block**, add an
   **Article list**. Reorder blocks with **↑ / ↓** and by dragging the ⠿ handle.
   Selecting any block opens a focused Inspector with a back button naming the
   content, and the block type as the eyebrow; the preview stays beside it. `[ ]`
10. **Article-list configuration — both modes.** In the Article-list Inspector:
    - **By tag**: pick two tags; the (i) explains that any one matching tag is
      enough. Remove all tags and read the "no tags selected" (i): the list then
      shows every eligible article. Select a tag nothing uses (create one inline)
      and you get the "no longer matches any article" toast, while the preview
      keeps the heading and says "No articles yet."
    - **Select articles**: search for articles, add them, reorder with ↑ / ↓ or
      by dragging, and remove them. Every row and card shows the language and
      publication state. Matching cards appear under the controls either way. `[ ]`
11. **Related Articles.** Open a Published article (e.g. _Welcome Week 2026_).
    After the block outline there is a **Related articles** switch. Turn it off —
    the settings are kept and the list disappears from the preview — and back on
    to get the same shared list controls. `[ ]`
12. **Preview behaves like the website.** In the preview, click a card or a prose
    link: the preview navigates as a visitor would, and the bar names what you
    are looking at. **Edit this Page / Edit this Article** opens that destination
    for editing; **Back to this article** returns the preview to what you were
    editing. `[ ]`
13. **Save project vs Export website.** Press **Save project**: the status reads
    "Saved in this browser", separately from "Downloaded copy: never", and the (i)
    spells out the difference. Press **Export website**: the readiness panel lists
    the blocking problem ("Join us" selects a Draft) with a **Fix** button that
    takes you there, lists warnings separately, explains behind an (i) that
    exporting does not update the live site, and keeps the export button disabled
    until the blocker is gone. Repair the selection (publish the article, or
    remove it from the list) and export succeeds. `[ ]`
14. **Help and keyboard.** There is no standing explanatory prose anywhere: every
    explanation sits behind an (i) next to its heading, label or dialog title —
    Pages, Site Health, Blocks, Preview, Related articles, the list contents, the
    tag screens and the export panel all work this way. Only short labels, status
    lines and actionable problems stay visible. Any (i) opens by click and by
    keyboard (Tab to it, press Enter or Space); Escape or a click outside closes
    it and focus returns to the icon. Dialogs close with Escape and return focus
    to the control that opened them. `[ ]`

### Phone width (≤ 820 px)

15. **Navigation drawer.** The left navigation collapses; the ☰ button opens it as
    a drawer over the content, and the scrim or **Close menu** dismisses it. `[ ]`
16. **One at a time.** A workspace shows an **Edit / Preview** switch instead of
    two panes, and each fills the width. `[ ]`
17. **Full-width Inspector.** Selecting a block gives a full-width Inspector with
    the same back button; Article settings, Article-list configuration and the
    tag picker are all usable at this width. `[ ]`
18. **Everything else still works.** Create an article, write in it, change its
    publication state, configure an Article list in both modes, save, and open the
    export readiness panel. `[ ]`

## Verdict

Record acceptance or rejection on issue #102 yourself — this prototype makes no
claim to be accepted. If something in the list above feels wrong, say which
numbered step and what you expected instead.

## Deliberate shortcuts

- Rich text is a plain `contenteditable` with `document.execCommand`, not Tiptap.
  Undo, paste cleaning, image upload and input-method composition are **not**
  modelled; the image button inserts a placeholder line.
- Five block types only (Rich text, Article list, Heading, Call to action, Image),
  not the real block library.
- No project loading/saving, no assets, no schema validation, no i18n of the
  builder's own interface, no real export.
- The preview is plain DOM in the same page rather than the real Renderer, so it
  approximates the theme rather than reflecting it exactly.

## Screenshots

`screenshots/` holds desktop (1440 × 900) and phone (390 × 844) captures of the
overview, the article workspace, the Article-list Inspector, the export readiness
panel, an opened help popover, the navigation drawer and the phone preview.
