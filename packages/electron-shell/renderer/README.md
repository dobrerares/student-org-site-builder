# `@sosb/electron-shell` renderer bootstrap

This directory contains the static HTML the packaged Electron app loads
via `file://` and the entry point the bundled renderer code is appended
to.

In v1, the renderer mounts `@sosb/editor-app` and uses the
`window.sosb.*` API exposed by the preload script (see
`../src/preload.ts`) for native dialogs and recent-sites persistence.

## How packaging works

`electron-builder` copies this directory verbatim into the packaged app
under `Resources/renderer/` (macOS) or `resources\renderer\` (Windows /
Linux). The main process resolves it via:

```ts
resolveEditorUrl({
  isPackaged: app.isPackaged,
  rendererRoot: path.resolve(here, "..", "renderer"),
});
```

In dev, the main process loads `http://localhost:5173/` instead — the
vite dev server for `@sosb/editor-app`. Override with the
`SOSB_DEV_SERVER_URL` env var.

## Builder styles

The editor is React (ADR 0049) and its shared controls come from
`@sosb/ui`, whose Tailwind-compiled stylesheet is a build artifact
(`packages/ui/src/styles/builder.generated.css`, produced by
`pnpm --filter @sosb/ui run build:css`). The renderer bundle gets it one of
two ways:

- `import "@sosb/ui/styles.css"` from the renderer entry, which the bundler
  turns into same-origin CSS next to `renderer.js`; or
- `import { injectBuilderCss } from "@sosb/ui/css"` for a JS-only bundle —
  the same idiom `editor-app-css.ts` already uses.

Both are covered by the CSP in `index.html`
(`style-src 'self' 'unsafe-inline'`), which `test/renderer-csp.test.ts`
pins. React needs no `unsafe-eval`, so the policy did not have to be
relaxed for the migration. Nothing is fetched from a network origin.

## What's NOT here

- A bundled `renderer.js` — building the editor-app for the Electron
  renderer is a follow-up wiring task; the file lands here at packaging
  time. See ADR 0006 for the staged-rollout rationale.
