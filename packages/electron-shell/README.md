# `@sosb/electron-shell`

Electron desktop shell: main process, preload, IPC bridge for native
dialogs, recent-sites store, electron-builder packaging.

Tracking issue: [#35](https://github.com/dobrerares/student-org-site-builder/issues/35).
Architecture decision: [ADR 0006](../../docs/adr/0006-electron-shell.md).

## Layout

```
packages/electron-shell/
├── src/
│   ├── main.ts                    Electron main-process entrypoint
│   ├── preload.ts                 contextBridge.exposeInMainWorld('sosb', ...)
│   ├── ipc-channels.ts            channel constants (single source of truth)
│   ├── preload-surface.ts         shape of window.sosb (renderer-side)
│   ├── register-ipc-handlers.ts   handler wiring (testable in node)
│   ├── dialog-handlers.ts         open/save dialog factories
│   ├── recent-sites.ts            store: dedup + FIFO cap of paths
│   ├── editor-url.ts              dev URL vs. packaged file:// URL
│   ├── browser-window-options.ts  security-first webPreferences
│   └── index.ts                   public API barrel
├── renderer/
│   └── index.html                 packaged-build entry HTML (file:// loaded)
├── test/                          vitest specs (unit, no Electron runtime)
└── electron-builder.config.cjs    cross-platform packaging config
```

## Development

```bash
# 1. Build the workspace (compiles all @sosb/* TypeScript)
pnpm -r --if-present build

# 2. Start the editor-app dev server (issue #7) — typically vite on :5173
# (today's editor-app is library-only; bundled-renderer wiring is staged
#  per ADR 0006).

# 3. Launch the Electron app
pnpm -F @sosb/electron-shell exec electron dist/main.js
```

Override the dev server URL with `SOSB_DEV_SERVER_URL`.

## Packaging

```bash
# Compile sources first.
pnpm -F @sosb/electron-shell build

# Then run electron-builder (per platform). Each command produces a
# native installer in `dist-electron/`.
pnpm exec electron-builder --config packages/electron-shell/electron-builder.config.cjs --win   # .exe
pnpm exec electron-builder --config packages/electron-shell/electron-builder.config.cjs --mac   # .dmg
pnpm exec electron-builder --config packages/electron-shell/electron-builder.config.cjs --linux # .AppImage
```

CI runs each target on its own runner (matrix release workflow lands with
the release issue).

## What's exposed to the renderer (`window.sosb`)

| Method                  | Channel                   | Returns             |
| ----------------------- | ------------------------- | ------------------- |
| `openSiteDialog()`      | `sosb:open-site-dialog`   | `string \| null`    |
| `saveSiteDialog(opts?)` | `sosb:save-site-dialog`   | `string \| null`    |
| `getRecentSites()`      | `sosb:get-recent-sites`   | `readonly string[]` |
| `addRecentSite(path)`   | `sosb:add-recent-site`    | `readonly string[]` |
| `clearRecentSites()`    | `sosb:clear-recent-sites` | `void`              |

The renderer cannot reach Node, `fs`, or `ipcRenderer` directly:

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`

## Out of scope for #35

- Sharp asset pipeline IPC — owned by [#37](https://github.com/dobrerares/student-org-site-builder/issues/37).
- `electron-updater` auto-update — owned by [#36](https://github.com/dobrerares/student-org-site-builder/issues/36).
- Mac code signing / Apple notarization — see `.out-of-scope/mac-code-signing.md` and [#44](https://github.com/dobrerares/student-org-site-builder/issues/44) (closed wontfix).
- File-system-backed VFS driver — owned by [#37](https://github.com/dobrerares/student-org-site-builder/issues/37).
