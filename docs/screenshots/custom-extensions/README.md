# Custom extensions — workflow run

Screenshots recorded by `e2e/custom-extensions-workflow.spec.ts` (issue #110's
prototype validation) on 2026-09-24 at commit `7db8dbc` on
`feat/interactive-preview`, in headless Chromium at 1400 × 950, with:

```sh
SOSB_SCREENSHOTS=1 pnpm exec playwright test custom-extensions-workflow --workers=1
```

The spec passes without the variable too; the images are written only on
demand so an ordinary run never dirties the tree. Re-record them when the
pane or the example Theme changes, and commit the result with the change.

| Step                                                                        | Image                                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| The developer's `.sosb-theme.zip` imported and selected on the Theme screen | [01-theme-imported.png](01-theme-imported.png)               |
| Hero on the Theme's Spotlight design, title edited, banner added            | [02-page-workspace.png](02-page-workspace.png)               |
| Static preview: the executable shell renders, the menu button stays hidden  | [03-static-preview.png](03-static-preview.png)               |
| Interactive preview on: the script ran, status line, second page reached    | [04-interactive-preview.png](04-interactive-preview.png)     |
| Export readiness panel before the Site download                             | [05-export-readiness.png](05-export-readiness.png)           |
| A fresh editor after importing the exported archive: Theme and edits intact | [06-reimported-fresh-site.png](06-reimported-fresh-site.png) |

What the run checked beyond the pictures (all asserted by the spec):

- the imported package is listed and switches the Site without an error;
- Blocks the Theme designs take its variants (`hero` → Spotlight,
  `ctaBanner` → Outline);
- the static document carries no `public.js` and the same-origin sandbox;
- the interactive document has an opaque origin (`parent.document` and
  storage throw `SecurityError`), loads every asset inline, runs the script
  (the header is marked `data-nav-enhanced`), opens the partner link in a
  new tab, and follows an internal link by moving the preview;
- the downloaded archive holds `data.json` with the chosen variant and
  title, the package under `themes/<id>/`, and a built `dist/` whose pages
  reference `assets/theme/<id>/public.js` at the right depth, carry the
  script byte for byte, and contain no `render.js` and no preview-only
  script;
- the standalone package export is byte-identical to what the developer
  zipped;
- both files open in fresh editors with the design, the variants and the
  edited content intact.

Not covered: a Custom Block with editable fields (issue #106 had not merged);
see the acceptance document.
