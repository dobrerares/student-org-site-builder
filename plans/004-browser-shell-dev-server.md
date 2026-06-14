# Plan 004: Add a `pnpm dev` loop that runs the editor in a browser

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 176e34e..HEAD -- packages/browser-shell package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (new tooling path; must not disturb the archival build)
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `176e34e`, 2026-06-12

## Why this matters

There is currently **no way to run the editor interactively** from a clean
clone. `CONTRIBUTING.md` ("Running locally") still says the host shells "are
still being implemented" and promises `pnpm dev` "in the same PR" — but the
shells landed months ago and the promised script never appeared. The only
executable artifact is the archival single-file build
(`pnpm --filter @sosb/browser-shell build:archival` → `dist/archival/builder.html`),
which is a full rebuild per change — unusable as a dev loop. Every manual QA
session, every visual check of editor work (theme refresh, pickers, forms),
and every new contributor hits this wall. This plan adds a Vite dev server to
`@sosb/browser-shell` that mounts the same `WelcomeShell` entry the archival
build uses, plus a root `pnpm dev` alias.

## Current state

- `packages/browser-shell/package.json:10-14` — scripts today:

```json
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.test.json",
    "build": "tsc --build",
    "build:archival": "node ./scripts/build-archival.mjs"
  },
```

- `packages/browser-shell/scripts/archival-entry.tsx` — the browser entry the
  archival build bundles. Key excerpt (lines 8–27):

```tsx
import { render } from "preact";
import type { Site } from "@sosb/schema";
import { importFromZip } from "@sosb/zip";
import { WelcomeShell } from "../src/welcome-shell.js";

declare const __SOSB_INITIAL_SITE_JSON__: string;

const initialSite = JSON.parse(__SOSB_INITIAL_SITE_JSON__) as Site;
const root = document.getElementById("root");
if (root === null) {
  throw new Error("archival-entry: missing #root");
}
render(<WelcomeShell blankSite={initialSite} onImportSite={importSiteZip} />, root);

async function importSiteZip() {
  /* file-input picker + importFromZip; ~45 lines, defined below in the same file */
}
```

The `__SOSB_INITIAL_SITE_JSON__` constant is injected at compile time by
esbuild `define` in `scripts/run-archival-build.ts`; the seed is
`asociatiaStudenteascaDemoData` exported from `@sosb/themes` (the curated
HISTORIPOL demo — `CONTEXT.md` calls this a **Template**: "a complete
pre-built Site … real-content seed for new editor sessions").

- `packages/browser-shell/src/` contains `welcome-shell.tsx` (the component
  to mount), `archival/`, `persistent-vfs/`, `service-worker/`.
- The archival build is covered by
  `packages/browser-shell/test/archival-cli.test.ts` (asserts
  `dist/archival/builder.html` ≤ 3MB, self-contained) — this test is the
  regression gate proving you didn't break the archival path.
- Vite `6.0.5` is a root devDependency but **not** a browser-shell
  dependency; with pnpm's strict node_modules, the package should declare its
  own devDependency to use the `vite` binary reliably from a package script.
- JSX in this repo is Preact automatic-runtime
  (`jsx: "automatic", jsxImportSource: "preact"` — see the esbuild flags in
  `scripts/build-archival.mjs:30-33`). Vite must be configured the same way;
  do **not** add `@preact/preset-vite` (new dependency, unnecessary).
- Repo convention: packages each have `package.json` with `name: "@sosb/<dir>"`,
  scripts `typecheck`/`build`; root scripts fan out via `pnpm -r --if-present`.

## Commands you will need

| Purpose                              | Command                                                             | Expected on success           |
| ------------------------------------ | ------------------------------------------------------------------- | ----------------------------- |
| Install (after editing package.json) | `pnpm install`                                                      | exit 0, lockfile updated      |
| Typecheck                            | `pnpm typecheck`                                                    | exit 0                        |
| Browser-shell tests                  | `pnpm vitest run packages/browser-shell`                            | all pass (incl. archival-cli) |
| Dev-graph compile check              | `pnpm --filter @sosb/browser-shell exec vite build --logLevel warn` | exit 0, bundle emitted        |
| Full suite                           | `pnpm test`                                                         | exit 0                        |
| Lint                                 | `pnpm lint`                                                         | exit 0                        |

## Scope

**In scope** (the only files you should modify/create):

- `packages/browser-shell/dev/index.html` (create)
- `packages/browser-shell/dev/dev-entry.tsx` (create)
- `packages/browser-shell/src/import-site-zip.ts` (create — extracted helper)
- `packages/browser-shell/scripts/archival-entry.tsx` (refactor to use the helper)
- `packages/browser-shell/vite.config.ts` (create)
- `packages/browser-shell/package.json` (add `dev` script + vite devDependency)
- `packages/browser-shell/README.md` (document the dev loop)
- Root `package.json` (add `"dev"` alias script)
- `pnpm-lock.yaml` (regenerated by `pnpm install` — do not hand-edit)

**Out of scope** (do NOT touch):

- `CONTRIBUTING.md` — Plan 005 owns the docs update; keep this plan code-only.
- `packages/electron-shell/**` — an Electron dev loop is a separate effort.
- `scripts/run-archival-build.ts`, `scripts/build-archival.mjs` — the
  archival pipeline itself must remain byte-for-byte untouched except for the
  entry file's import of the extracted helper.
- Service-worker registration / OPFS persistence wiring in dev — explicitly
  deferred; the dev loop is an ephemeral editor session (note it in the README).

## Git workflow

- Branch: `advisor/004-browser-shell-dev-server`
- Two commits suggested: (1) extract `import-site-zip.ts` helper (pure
  refactor, archival test green), (2) add dev server + scripts. Verb-first
  messages, e.g. `Add Vite dev server for the browser-shell editor`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract the zip-import picker into `src/`

Move the `importSiteZip` and `pickZipBlob` functions (currently defined at
the bottom of `scripts/archival-entry.tsx`) into a new
`packages/browser-shell/src/import-site-zip.ts`, exported as
`importSiteZip`. Keep the code byte-identical apart from adding `export` and
the imports it needs (`importFromZip` from `@sosb/zip`). Update
`archival-entry.tsx` to `import { importSiteZip } from "../src/import-site-zip.js";`
and delete the local copies.

**Verify**: `pnpm vitest run packages/browser-shell` → all pass, including
`archival-cli.test.ts` (proves the single-file build still assembles and
stays ≤ 3MB).

### Step 2: Create the dev entry and HTML

`packages/browser-shell/dev/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SOSB editor — dev</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/dev-entry.tsx"></script>
  </body>
</html>
```

`packages/browser-shell/dev/dev-entry.tsx` — same mount as the archival
entry, but seeded by a direct import instead of a compile-time `define`:

```tsx
import { render } from "preact";
import { asociatiaStudenteascaDemoData } from "@sosb/themes";
import { WelcomeShell } from "../src/welcome-shell.js";
import { importSiteZip } from "../src/import-site-zip.js";

const root = document.getElementById("root");
if (root === null) throw new Error("dev-entry: missing #root");
// structuredClone: never let dev-session edits mutate the imported template module.
render(
  <WelcomeShell
    blankSite={structuredClone(asociatiaStudenteascaDemoData)}
    onImportSite={importSiteZip}
  />,
  root,
);
```

Check `WelcomeShell`'s actual prop names in `src/welcome-shell.tsx` before
writing this — the archival entry (Step 1's excerpt) is the authority; mirror
exactly what it passes.

### Step 3: Vite config and scripts

`packages/browser-shell/vite.config.ts`:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  root: "dev",
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  build: { outDir: "../dist/dev", emptyOutDir: true },
});
```

`packages/browser-shell/package.json`: add to scripts
`"dev": "vite"`, and add `"vite": "6.0.5"` to `devDependencies` (create the
block if absent — match the exact root version; do not use a caret, the root
pins tooling exactly).

Root `package.json`: add `"dev": "pnpm --filter @sosb/browser-shell run dev"`
to scripts.

Run `pnpm install` to settle the lockfile.

**Verify**: `pnpm install` → exit 0;
`pnpm --filter @sosb/browser-shell exec vite build --logLevel warn` → exit 0
(this compiles the full dev entry graph headlessly — the dev-server
equivalent of a typecheck). If `dist/dev/` was produced, delete it is NOT
needed — but confirm `packages/browser-shell/dist/dev` is covered by the
existing `.gitignore` (check; if not, add the ignore entry and include that
file in scope).

### Step 4: Manual smoke test + README

Start `pnpm dev` (from repo root). In a browser at the URL Vite prints
(default `http://localhost:5173`):

1. The welcome screen renders (HISTORIPOL demo template available).
2. Entering the editor shows the block list and the live preview iframe.
3. Typing in a text field updates the preview within ~200ms.
4. The asset picker's upload affordance appears on an image slot (upload may
   be limited without persistent VFS — note whatever you observe).

Record the results of all four checks in your report. Then add a short
"Development server" section to `packages/browser-shell/README.md`: the
command, the URL, the demo seed, and the limitation (ephemeral session — no
OPFS persistence, no service worker in dev; export/import zip still works).

**Verify**: `pnpm typecheck` → exit 0; `pnpm test` → exit 0; `pnpm lint` →
exit 0.

## Test plan

- No new unit tests required — the dev server is tooling. The regression
  gates are: `archival-cli.test.ts` (archival build unaffected by the Step 1
  refactor), `vite build` exit 0 (dev graph compiles), and the four manual
  smoke checks in Step 4, reported explicitly.
- If Step 1's extraction changes any behavior, the existing browser-shell
  tests will catch it — do not weaken them.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm dev` (root) starts a Vite server that serves the editor (manual check, reported)
- [ ] `pnpm --filter @sosb/browser-shell exec vite build --logLevel warn` exits 0
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm lint` all exit 0
- [ ] `grep -n "\"dev\"" package.json packages/browser-shell/package.json` → one hit in each
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `WelcomeShell`'s props don't match what the archival entry passes (drift —
  re-read `scripts/archival-entry.tsx` and report the difference).
- The editor mounts but the preview iframe stays blank in dev while the
  archival `builder.html` works — that indicates a dev-server-specific asset
  or worker dependency; report findings rather than patching around it.
- You need to modify `run-archival-build.ts`/`build-archival.mjs` beyond the
  entry file's import line.
- Vite requires a plugin or dependency beyond `vite` itself to compile the
  graph (e.g. a CSS or WASM loader) — adding dependencies is a maintainer
  decision.

## Maintenance notes

- Plan 005 (docs refresh) documents this dev loop in `CONTRIBUTING.md` —
  execute it after this plan lands.
- When OPFS persistence / service worker are wanted in dev, wire them in
  `dev-entry.tsx` (the production wiring lives under `src/persistent-vfs/`
  and `src/service-worker/`) — keep the archival entry unaffected.
- An `electron-shell` dev loop (`electron .` against a dev build) is the
  natural follow-up; it was deliberately left out to keep this plan small.
- Reviewer should scrutinize: the Step 1 refactor is byte-identical logic
  (diff should read as pure code motion), and the new `vite` devDependency
  pins the same version as the root.
