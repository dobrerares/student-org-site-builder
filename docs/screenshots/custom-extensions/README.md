# Custom extensions — workflow run

Screenshots recorded by `e2e/custom-extensions-workflow.spec.ts` (issue #110's
prototype validation) on 2026-09-24 for the Partners acceptance follow-up on
`feat/custom-extensions-followup`, in headless Chromium at 1400 × 950, with:

```sh
SOSB_SCREENSHOTS=1 pnpm exec playwright test custom-extensions-workflow --workers=1
```

The spec passes without the variable too; the images are written only on
demand so an ordinary run never dirties the tree. Re-record them when the
pane or the example Theme changes, and commit the result with the change.

| Step                                                                                                     | Image                                                        |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| The developer's `.sosb-theme.zip` imported and selected on the Theme screen                              | [01-theme-imported.png](01-theme-imported.png)               |
| Hero on the Theme's Spotlight design, title edited, banner added                                         | [02-page-workspace.png](02-page-workspace.png)               |
| Static preview: the executable shell renders, the menu button stays hidden                               | [03-static-preview.png](03-static-preview.png)               |
| Interactive preview on: the script ran, status line, second page reached                                 | [04-interactive-preview.png](04-interactive-preview.png)     |
| Partners authored through generated fields, with its uploaded logo and Page link, in interactive preview | [07-partners-interactive.png](07-partners-interactive.png)   |
| Reopened Partners heading and group beside the restored preview                                          | [08-partners-reimported.png](08-partners-reimported.png)     |
| Export readiness panel before the Site download                                                          | [05-export-readiness.png](05-export-readiness.png)           |
| A fresh editor after importing the exported archive: Theme and edits intact                              | [06-reimported-fresh-site.png](06-reimported-fresh-site.png) |

What the run checked beyond the pictures (all asserted by the spec):

- the imported package is listed and switches the Site without an error;
- Blocks the Theme designs take its variants (`hero` → Spotlight,
  `ctaBanner` → Outline);
- the Partners Custom Block is added through the dialog, then its heading,
  group and partner are entered through generated fields; a real PNG is
  uploaded through the Asset picker and a Page is selected by identity;
- the static document carries no `public.js` and the same-origin sandbox;
- the interactive document has an opaque origin (`parent.document` and
  storage throw `SecurityError`), loads every asset inline, runs the script
  (the header is marked `data-nav-enhanced`), opens the partner link in a
  new tab, and follows an internal link by moving the preview;
- both previews render the Partners heading, group, name, decoded logo and
  Page link; following the partner link moves the preview to that Page;
- the downloaded archive holds `data.json` with the chosen variant and
  title, the package under `themes/<id>/`, and a built `dist/` whose pages
  reference `assets/theme/<id>/public.js` at the right depth, carry the
  script byte for byte, and contain no `render.js` and no preview-only
  script; its Partners markup and uploaded logo are checked against the
  saved Block, including the link's permanent Page id;
- the standalone package export is byte-identical to what the developer
  zipped;
- both files open in fresh editors with the design, the variants and the
  edited content intact; the reopened Partners form keeps the heading,
  partner, image and selected Page without another upload. The standalone
  package offers an empty Partners Block and renders newly entered content.

Not covered: comparison of the Partners design to the published reference,
user feedback, or the packaged Electron app. See the acceptance document.
