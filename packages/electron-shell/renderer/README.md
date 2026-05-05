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

## What's NOT here

- A bundled `renderer.js` — building the editor-app for the Electron
  renderer is a follow-up wiring task; the file lands here at packaging
  time. See ADR 0006 for the staged-rollout rationale.
