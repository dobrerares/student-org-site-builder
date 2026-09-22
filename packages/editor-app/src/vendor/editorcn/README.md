# Vendored editorcn toolbar

ADR 0049 selects Tiptap with editorcn's toolbar, and requires the source to
be **copied into this repository** with its upstream revision recorded, rather
than installed as a package:

> The required editorcn source is copied into the repository with its upstream
> revision recorded; local adaptations and manually reviewed upstream updates
> become repository responsibilities. This trades package-update convenience
> for control over image/link integration, accessibility fixes, and history
> behavior.

## Upstream

|           |                                                                 |
| --------- | --------------------------------------------------------------- |
| Project   | [shadcn-labs/editorcn](https://github.com/shadcn-labs/editorcn) |
| Revision  | `99232190a9d8a69fab406c7fb2ce1b7020f1127a` (`main`, 2026-09-20) |
| Licence   | MIT — see `LICENSE` in this directory                           |
| Copied on | 2026-09-22                                                      |

editorcn is distributed the shadcn way — as source you copy, not a package you
install. There is no `editorcn` package on npm (the name is unpublished), so
copying is the only way to use it regardless of what the ADR says.

### Files this directory derives from

| Upstream path                                 | Here               |
| --------------------------------------------- | ------------------ |
| `packages/editor/src/rte-toolbar.tsx`         | `Toolbar`          |
| `packages/editor/src/ui/rte-button.tsx`       | `ToolbarButton`    |
| `packages/editor/src/ui/rte-button-group.tsx` | `ToolbarGroup`     |
| `packages/editor/src/ui/rte-separator.tsx`    | `ToolbarSeparator` |

Only the toolbar primitives are vendored. Upstream's controls, bubble menu,
dropdowns, colour swatches, Twitter/YouTube embeds, table and image-placeholder
extensions, icons and `labels.ts` are **not** copied: this builder's toolbar is
driven by issue #100's fixed vocabulary, its controls are Site-aware and
therefore editor-owned (ADR 0049), and its icons and strings already have homes
(`../../rich-text/icons.tsx`, `@sosb/i18n`).

## Local changes

Recorded precisely, because these are the changes a future upstream sync has to
re-apply by hand.

1. **`role="toolbar"` with arrow-key roving focus.** Upstream's `Toolbar` is a
   plain `<div>`, so all fourteen buttons are tab stops sitting between the
   author and the text they are editing. This version is one tab stop; the
   arrows move within it.
2. **`aria-pressed` instead of an `active` class.** Upstream's `RteButton`
   takes `active?: boolean` and expresses it purely as a CSS class, which is
   invisible to assistive technology. These are formatting toggles and several
   may be active at once, so `aria-pressed` is the right state (not
   `aria-checked`).
3. **`onMouseDown` prevents default.** Clicking a toolbar button would
   otherwise move focus out of the editing surface and collapse the selection,
   so "select three words, click Bold" would bold nothing. Load-bearing, not a
   tweak.
4. **`@sosb/ui` styling instead of upstream's `rte-*` stylesheet.** ADR 0049
   puts the builder's shared controls and styles in one package; importing a
   second, parallel design system for one toolbar would contradict that.
   Classes go through `cn` and the elements carry `data-sosb-ui` so the
   package's scoped reset applies.
5. **No editor context.** Upstream reads `variant` and `editable` from
   `useRichTextEditorContext`. These primitives take props instead and know
   nothing about Tiptap, which keeps the Site-aware layer
   (`../../rich-text/rich-text-toolbar.tsx`) cleanly separate as ADR 0049
   requires.
6. **`forwardRef` dropped.** React 19 passes `ref` as an ordinary prop, and
   nothing here needs a forwarded ref.
7. **Accessible name required.** `ToolbarButton`'s `label` is a required prop
   feeding both `aria-label` and `title`, so an unlabelled icon button cannot
   be written by accident.

## Updating

There is no automatic path, by design. To sync:

1. Read the upstream diff for the four files above since the recorded revision.
2. Apply what is wanted by hand, re-applying every local change in the list.
3. Update the revision and date in this file.
4. Run `packages/editor-app/test/richtext-field.test.tsx` — it covers the
   roving focus, the accessible names, the pressed state and an axe pass, which
   is where a careless sync would show up.
