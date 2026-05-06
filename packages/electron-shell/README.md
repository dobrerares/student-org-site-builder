# `@sosb/electron-shell`

Electron desktop shell: main process, preload, IPC bridge for native
dialogs, recent-sites store, electron-updater orchestration,
electron-builder packaging.

Tracking issues: [#35](https://github.com/dobrerares/student-org-site-builder/issues/35),
[#36](https://github.com/dobrerares/student-org-site-builder/issues/36).
Architecture decisions: [ADR 0006](../../docs/adr/0006-electron-shell.md),
[ADR 0029](../../docs/adr/0029-electron-auto-update.md).

## Layout

```
packages/electron-shell/
├── src/
│   ├── main.ts                          Electron main-process entrypoint
│   ├── preload.ts                       contextBridge.exposeInMainWorld('sosb', ...)
│   ├── ipc-channels.ts                  channel constants (#35)
│   ├── auto-update-channels.ts          channel constants (#36)
│   ├── preload-surface.ts               shape of window.sosb (renderer-side)
│   ├── register-ipc-handlers.ts         dialog/recent-sites IPC wiring
│   ├── register-auto-update-handlers.ts auto-update IPC wiring
│   ├── auto-updater-orchestrator.ts     electron-updater event/timer logic
│   ├── auto-update-settings.ts          auto-check toggle + declined-versions
│   ├── dialog-handlers.ts               open/save dialog factories
│   ├── recent-sites.ts                  store: dedup + FIFO cap of paths
│   ├── editor-url.ts                    dev URL vs. packaged file:// URL
│   ├── browser-window-options.ts        security-first webPreferences
│   └── index.ts                         public API barrel
├── renderer/
│   └── index.html                       packaged-build entry HTML (file:// loaded)
├── test/                                vitest specs (unit, no Electron runtime)
└── electron-builder.config.cjs          cross-platform packaging config
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

Native dialogs + recent sites (#35):

| Method                  | Channel                   | Returns             |
| ----------------------- | ------------------------- | ------------------- |
| `openSiteDialog()`      | `sosb:open-site-dialog`   | `string \| null`    |
| `saveSiteDialog(opts?)` | `sosb:save-site-dialog`   | `string \| null`    |
| `getRecentSites()`      | `sosb:get-recent-sites`   | `readonly string[]` |
| `addRecentSite(path)`   | `sosb:add-recent-site`    | `readonly string[]` |
| `clearRecentSites()`    | `sosb:clear-recent-sites` | `void`              |

Auto-update (#36):

| Method                                     | Channel / direction                          |
| ------------------------------------------ | -------------------------------------------- |
| `checkForUpdates()`                        | `sosb:update:check` (renderer→main)          |
| `installUpdateAndRelaunch()`               | `sosb:update:install`                        |
| `declineUpdate()`                          | `sosb:update:decline`                        |
| `getAutoUpdateSettings()`                  | `sosb:update:get-settings`                   |
| `setAutoUpdateSettings(s)`                 | `sosb:update:set-settings`                   |
| `onUpdateEvent(channel, listener)` → unsub | `sosb:update:available` etc. (main→renderer) |

The renderer cannot reach Node, `fs`, or `ipcRenderer` directly:

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`

## Auto-update flow (#36)

The main process imports `electron-updater` ONLY in packaged builds and
wires it through `createAutoUpdaterOrchestrator(...)`. The orchestrator
checks for updates on launch and every 6 hours
(`AUTO_UPDATE_CHECK_INTERVAL_MS`), forwards lifecycle events to the
renderer via `webContents.send`, and persists the user's auto-check
toggle + declined-versions list in
`app.getPath("userData")/auto-update-settings.json`.

`autoDownload = true` and `autoInstallOnAppQuit = false`: the app
auto-downloads but never auto-restarts. The user clicks "Restart now"
to install or "Later" to decline (the version is recorded so the next
launch's check stays quiet for that version).

The release pipeline (`.github/workflows/release.yml`) runs on tag
pushes matching `v*` — three runners (Ubuntu, macOS, Windows) build
their native installer and `electron-builder --publish always` uploads
to the GitHub Release.

## End-to-end verification (one human pass per major bump)

Auto-update can't be exercised end-to-end in CI — it requires two real
GitHub Releases. The verification checklist:

1. Tag the current main branch with a low version number, push:
   `git tag v0.0.1 && git push --tags`. Wait for `release.yml` to
   complete; confirm artifacts on the GitHub Release page.
2. Install on each platform (`.exe`, `.dmg`, `.AppImage`). Launch.
   Confirm app loads without error. (On macOS: right-click → Open
   to bypass Gatekeeper since builds are unsigned.)
3. Bump version in `packages/electron-shell/package.json` to `v0.0.2`.
   Tag + push. Wait for `release.yml`.
4. Re-launch the v0.0.1 install on each platform. Within ~10 seconds
   the orchestrator's first `checkForUpdates()` runs.
5. Confirm: top banner says "Update 0.0.2 available — downloading…".
6. Wait for download. Banner switches to "Update 0.0.2 ready to install".
7. Click "Later". Confirm banner dismisses; quit + relaunch; confirm
   no banner appears (declined-version logic).
8. Repeat with another release; this time click "Restart now"; confirm
   the app relaunches at v0.0.3.

## Out of scope (still)

- Sharp asset pipeline IPC — owned by [#37](https://github.com/dobrerares/student-org-site-builder/issues/37).
- Mac code signing / Apple notarization — see `.out-of-scope/mac-code-signing.md` and [#44](https://github.com/dobrerares/student-org-site-builder/issues/44) (closed wontfix).
- File-system-backed VFS driver — owned by [#37](https://github.com/dobrerares/student-org-site-builder/issues/37).
- Multi-channel (beta/stable) updates — single stable channel for v1.
