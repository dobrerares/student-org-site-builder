# 0029 — Electron auto-update via electron-updater + GitHub Releases

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #36

## Context

Issue #36 asks for an Electron auto-updater backed by GitHub Releases.
The PRD's "Distribution & ownership" section pins the broad strokes:

- "Auto-update for Electron via `electron-updater` against GitHub
  Releases. Background check + auto-download + prompt to install. Single
  stable channel for v1. Never auto-restarts mid-session."
- "Telemetry: none. No analytics, no crash reports, no third-party
  scripts. The only network call is the auto-update manifest GET
  (anonymous)."

The issue body refines the lifecycle:

- Check on launch + every 6 hours.
- Background download once an update is found.
- Prompt to install (`Restart now / Later`) — never silent install
  mid-session.
- User-declined updates do NOT auto-install on the next launch.
- Auto-check toggle (default ON) persists across launches.
- Manual check via `Help → "Check for updates"`.
- Failures log + retry on the next interval; never block the editor.

The PRD does **not** pin:

- The IPC channel naming for update events.
- Where the orchestrator's business logic lives (main file vs. extracted
  module).
- How user-declined versions are recorded.
- The release CI matrix.

This ADR records those choices.

## Decision

### Three new modules under `@sosb/electron-shell`

The same pattern as ADR 0006: pure logic in unit-testable modules,
Electron's globals + `electron-updater`'s singleton at the boundary
in `main.ts`.

| Module                          | Surface                                                                  | Touches Electron at runtime?   |
| ------------------------------- | ------------------------------------------------------------------------ | ------------------------------ |
| `auto-update-channels.ts`       | constants `AutoUpdateChannels`, `AUTO_UPDATE_EVENT_LIST`, `_INVOKE_LIST` | no — strings only              |
| `auto-update-settings.ts`       | `loadAutoUpdateSettings` / `declineUpdateVersion` over a settings store  | no                             |
| `auto-updater-orchestrator.ts`  | `createAutoUpdaterOrchestrator(deps)` over an `AutoUpdaterLike` shim     | no — `autoUpdater` is injected |
| `register-auto-update-handlers` | wires renderer-invoke channels via shims                                 | no                             |
| `main.ts`                       | imports `electron-updater`, builds the real `autoUpdater` shim, runs it  | yes                            |

Editor-app side:

| Module                  | Surface                                          |
| ----------------------- | ------------------------------------------------ |
| `update-banner.tsx`     | `<UpdateBanner bridge={...} />` Preact component |
| `sosb-update-bridge.ts` | adapter from `window.sosb` to `UpdateBridge`     |

The orchestrator is the only piece of new logic with non-trivial
behaviour (timer, declined-version skip, error-on-event flow). Every
branch is covered by a unit test against an `AutoUpdaterLike` shim — no
Electron runtime needed.

### IPC channel naming: `sosb:update:<noun>`

Channels live in `auto-update-channels.ts` and are imported by both the
preload (renderer side) and the main router. Two surfaces:

- **Events** (main → renderer, via `webContents.send`):

  - `sosb:update:available`
  - `sosb:update:not-available`
  - `sosb:update:downloaded`
  - `sosb:update:error`
  - `sosb:update:download-progress`
  - `sosb:update:checking`

- **Invoke** (renderer → main, via `ipcRenderer.invoke`):
  - `sosb:update:check`
  - `sosb:update:install`
  - `sosb:update:decline`
  - `sosb:update:get-settings`
  - `sosb:update:set-settings`

Splitting into two surfaces reflects the actual flow: events are pushed
opportunistically as `electron-updater`'s state machine progresses;
invokes are user-action triggers.

Rejected:

- **Reusing `sosb:invoke` from #35.** Mixing recent-sites and update
  channels in one file blurs ownership; #36 owns its slice.
- **Inline string literals.** A typo on either side is a runtime no-op
  (renderer Promise rejects with "no handler for channel"). Single
  source of truth + a test that asserts every channel has a handler is
  the cheapest insurance.

### Lifecycle: 6-hour timer + immediate check on launch

`AUTO_UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000`. The orchestrator's
`start()` runs `autoUpdater.checkForUpdates()` immediately and schedules
a `setInterval` for the same call. `stop()` clears the interval and
removes all listeners.

The interval-vs-check-on-event-of-some-sort decision: a setInterval is
boring, well-understood, and cheap. Every 6 hours, an idle desktop app
makes one anonymous HTTPS GET to `api.github.com/repos/.../releases`.
That's the whole network footprint.

Rejected:

- **`node-schedule` / `cron`.** Adds a runtime dep for a 30-second
  setInterval.
- **Check-only-on-window-focus.** Misses long-idle sessions; the PRD
  specifies "Background check fires on launch and every 6 hours".

### Auto-download but NEVER auto-install on quit

`autoDownload = true`, `autoInstallOnAppQuit = false`. The PRD says
"never auto-restarts mid-session", and the user's "Later" choice should
not silently install on the next quit.

`electron-updater` defaults `autoInstallOnAppQuit` to `true`. We override
on every `start()` so a future upstream default change can't sneak past
us.

The "Later" path explicitly persists the version to a `declinedVersions`
list (see below). This means: even if the user closes the app while
`update-downloaded` has fired, the next launch's check gets the same
version, sees it's declined, and stays quiet — no banner, no install
prompt.

Rejected:

- **`autoDownload = false` + manual download trigger.** Doubles the
  user prompts (one for "downloading?", one for "install?"). PRD's
  "Background check + auto-download + prompt to install" is one prompt.

### Declined-version persistence: append-only string list

When the user clicks "Later", we record the in-flight `update.version`
in `auto-update-settings.json` under `declinedVersions: string[]`. Future
checks skip notifying the renderer when `update-available` fires for
that version.

The list grows without bounds in the worst case, but it grows by one
entry per "Later" click — a user has to actively decline N updates for
the list to reach length N. Pruning happens implicitly: once we ship a
version newer than the declined ones, the older entries are inert (no
network call ever returns those versions). A future migration can prune
versions older than the current installed version if the list gets
unwieldy.

Rejected:

- **Single `lastDeclinedVersion: string`.** Loses the history. If the
  user declines 1.2.0 and then we ship 1.2.1 + 1.2.2, the user should
  see only one banner-promotion-cycle (for 1.2.2), not three.
- **Time-based "remind me in 24h"** (per Sparkle's `SUSkipped*` keys).
  Adds a clock dependency we don't need; the issue's AC says "User-
  declined update does not auto-install on next launch" — version-keyed
  is the simplest model that satisfies it.

### Manual check via `checkNow()`: bypass the auto-check toggle

`autoCheckEnabled = false` disables the automatic interval but a user
clicking "Check for updates" in the Help menu MUST work regardless. The
orchestrator's `checkNow()` calls `autoUpdater.checkForUpdates()`
unconditionally — the auto-check toggle gates only the timer.

This matches the issue's AC: "Auto-check setting persists; manual check
works."

### electron-updater code in the main process ONLY

`import("electron-updater")` lives in `main.ts` and nowhere else. The
orchestrator accepts an `AutoUpdaterLike` shim — pure interface, no
Electron import. The renderer and the preload never import
`electron-updater`. This is a hard line because:

- `electron-updater` reaches into `fs`, `child_process`, native code-
  signing tools — Node-only modules. Importing from the renderer
  (sandboxed, no Node) crashes at load time.
- `electron-updater`'s `autoUpdater` exposes a `quitAndInstall()` that
  hard-quits the process. Putting that one click away from the page's
  JavaScript context is a security regression.

The renderer talks to the orchestrator only through:

- `window.sosb.checkForUpdates()` — manual check.
- `window.sosb.installUpdateAndRelaunch()` — "Restart now".
- `window.sosb.declineUpdate()` — "Later".
- `window.sosb.onUpdateEvent(channel, listener)` — subscribe.

### electron-builder `publish` provider: GitHub, single stable channel

```js
publish: [
  {
    provider: "github",
    owner: "dobrerares",
    repo: "student-org-site-builder",
    releaseType: "release",
  },
];
```

`electron-builder` consumes this at packaging time AND embeds it into
the installer as `app-update.yml`, which `electron-updater` reads at
runtime. One source of truth.

`releaseType: "release"` excludes pre-releases — the PRD's "Single
stable channel for v1" line. Beta/alpha channels can be wired post-v1
by adding more entries to the `publish` array.

Rejected:

- **`provider: "generic"` against a custom S3/Cloudflare bucket.** Adds
  hosting cost; the project is OSS, free, and student-organisation-
  scale. GitHub Releases is free and has the artifact size budget we
  need.
- **Multi-channel from day one.** The PRD explicitly defers it.

### Release workflow: 3-runner matrix + `--publish always`

`.github/workflows/release.yml` runs on tag pushes matching `v*`. Each
runner produces one native installer:

- `ubuntu-latest` → `.AppImage`
- `macos-latest` → `.dmg` (unsigned)
- `windows-latest` → `.exe` (NSIS, unsigned)

Every job runs the full CI gate (`typecheck`, `lint`, `test`, `build`)
before packaging — a green release implies the build was green.

`pnpm exec electron-builder --publish always` uploads the installer
plus the `latest-*.yml` manifest to the GitHub Release that the tag
created. `secrets.GITHUB_TOKEN` is the GitHub-provisioned token; no
PAT required.

`workflow_dispatch` is wired with a `dryRun` input so a maintainer can
build the installers from a branch (no upload) before tagging — the
electron-updater path is the most expensive thing to debug after a
real release went out.

Rejected:

- **Single-runner cross-build.** Mac DMG and Windows NSIS are reliable
  only on their native runners; the matrix is the documented
  electron-builder pattern.
- **Build artifacts as workflow artifacts** (without publishing).
  Doesn't satisfy the AC; electron-updater needs the Release manifests.

### Renderer banner: top-bar, inline with the editor's TopBar

`<UpdateBanner>` lives at the top of the editor pane, above the existing
`<TopBar>`. Three visual states:

- `available` — "Update X.Y.Z available — downloading…" + "Later".
- `downloaded` — "Update X.Y.Z ready to install." + "Restart now" + "Later".
- `error` — red error banner, dismiss button.

The banner is decoupled from Electron: it takes an `UpdateBridge` shim
(which the desktop wiring builds via `createSosbUpdateBridge(window.sosb)`).
The browser SPA never mounts the banner — `isElectronShellAvailable(window.sosb)`
gates the wiring at the call site.

Rejected:

- **Modal dialog**: blocks the editor while the user makes an update
  decision. The PRD says updates should never block.
- **Help menu only**: doesn't satisfy the AC's "prompt appears" — a
  silent corner badge isn't a prompt.

## Rationale

The most subtle constraint is "never auto-restarts mid-session AND
user-declined updates don't auto-install on next launch." Two equivalent
designs satisfy it:

1. `autoInstallOnAppQuit = false` + decline list (this ADR).
2. `autoInstallOnAppQuit = true` + a "stop" call when the user declines.

We chose (1) because (a) it's stateless across the user's session — a
crash mid-session doesn't accidentally install on the recovery quit, and
(b) the decline-list logic is unit-testable in node, where (2) requires
mocking electron-updater's quit-cleanup hook.

The 6-hour interval is taken verbatim from the issue body. A 24h or 1h
choice would be defensible, but 6h is what the AC says, and a release
schedule of a stable utility app on the order of weeks/months means a
sub-day interval is "soon enough" without burning anyone's bandwidth.

## Consequences

- `pnpm -F @sosb/electron-shell add electron-updater@^6` (recorded in
  the package's runtime `dependencies` because the main process imports
  it at runtime).
- One new ADR file (this one), and a 0006 cross-link comment in the
  electron-shell README.
- `.github/workflows/release.yml` is the second workflow file in the
  repo (alongside `ci.yml`). Tag pushes now automatically trigger a
  build — maintainers should be aware before tagging.
- `auto-update-settings.json` is the second JSON-on-disk file in
  `app.getPath("userData")` (alongside `recent-sites.json` from #35).
- The 7 pre-existing prettier warnings carried over from the
  editor-shell merge (#7) remain unresolved by this issue.
- End-to-end verification of the update flow is a one-time human task:
  - Cut a real GitHub Release via `git tag v0.0.1 && git push --tags`.
  - Install the resulting installers on Win/Linux/macOS.
  - Cut a second release, observe the banner, validate "Restart now"
    - "Later" + "auto-check off" branches.
  - Documented in `CONTRIBUTING.md` so a future maintainer can repeat it.

## Out of scope

- Multi-channel (beta/stable) — PRD explicitly defers.
- Differential updates (`electron-updater` blockmap delta) — works out
  of the box on Windows/Linux but Mac DMG full-replace is fine for v1.
- Mac code signing / Apple notarization — see
  `.out-of-scope/mac-code-signing.md` and #44 (closed wontfix).
- A "What's new" modal that surfaces release notes — banner is the v1
  surface; release notes can land on the GitHub Release page.
- Update server self-hosting — GitHub Releases is the channel.
