# Cloudflare Pages screenshot library

This directory holds the real Cloudflare-dashboard screenshots referenced
by the generated `DEPLOY.md` (`packages/zip/src/deploy-md.ts`) and by
`docs/deploy/cloudflare-pages.md`.

> **Status:** Awaiting capture. The generator emits filenames the
> maintainer drops images into. Until the images land, viewers see
> Markdown's broken-image affordance — readable text but no visual
> guidance for the dashboard steps.

## Capture protocol

When ready to capture:

1. Sign in to a real Cloudflare account.
2. Use a **clean test project** (no production data, no PII).
3. Capture at the steps marked in the in-zip `DEPLOY.md`. The filenames
   below match the references in `packages/zip/src/deploy-md.ts`.
4. Use the dashboard's default theme. Crop to the relevant content,
   keep at least 1280 px wide for legibility on retina displays.
5. Redact any account email, billing detail, or unrelated project name
   that appears in the chrome.

## Filenames

The generator references these filenames. Ship them as PNG (lossless,
<300 KB each after optimisation):

### Path 1 — Direct upload

- `01-direct-upload-create-application.png` — Workers & Pages list with
  the **Create application** button highlighted.
- `02-direct-upload-drop-dist.png` — The drag-and-drop zone in the
  **Pages → Upload assets** flow, ideally with a `dist/` folder visibly
  ready to drop.
- `03-direct-upload-deployed.png` — The post-deploy confirmation screen
  showing the assigned `*.pages.dev` URL.

### Path 2 — Git-connected

- `04-git-connect-authorize.png` — The GitHub authorization screen
  Cloudflare uses to read repositories.
- `05-git-connect-build-settings.png` — The **Set up builds and
  deployments** screen with **Build command** empty and **Build output
  directory** filled in.
- `06-git-connect-deployed.png` — The deployment list after the first
  successful build, showing at least one commit and its unique URL.

## After committing screenshots

Run `pnpm test` to confirm the golden DEPLOY.md snapshots still match
(they reference the filenames, not the image bytes — capture changes
do not break the golden test).

If a screenshot's filename needs to change (e.g. dashboard step rename
makes the existing name misleading), update the corresponding entry in
`packages/zip/src/deploy-md.ts`'s `RO`/`EN` copy bundles and re-run
`pnpm test` to refresh the golden snapshots.

## Why this directory is empty in v1.0

Issue #43's acceptance criteria include screenshots from a real
Cloudflare dashboard, but the AFK agent (which produced the generator
and this scaffolding) does not have access to a Cloudflare account.
The maintainer captures these once, end-to-end, as the final
verification of issue #43.

See [`docs/deploy/cloudflare-pages.md`](../cloudflare-pages.md) for
the full verification protocol.
