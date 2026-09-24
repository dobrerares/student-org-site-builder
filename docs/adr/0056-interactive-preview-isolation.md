# 0056 — Interactive preview: an opaque-origin frame with inline assets

- **Status:** Accepted
- **Date:** 2026-09-24
- **Issues:** [#110](https://github.com/dobrerares/student-org-site-builder/issues/110)
  (prototype validation), [#111](https://github.com/dobrerares/student-org-site-builder/issues/111)
  (release acceptance); map [#104](https://github.com/dobrerares/student-org-site-builder/issues/104)

## Context

[ADR 0046](0046-trusted-executable-theme-and-block-extensions.md) settled the
terms for a Theme's public-site script: the editor preview is static by
default, and "public-site scripts and their external connections run only in
an explicitly enabled interactive-preview mode, isolated from editor controls
and native computer access". [ADR 0054](0054-executable-theme-rendering-and-sandbox.md)
shipped the script (`public.js`, declared with its `network` hosts and its
`offline` note) into the build, and left one flag for this mode to flip:
`PreviewOptions.includePublicScript`.

The preview it has to flip is the one PR #116 built. The editor renders each
snapshot host-side and writes it into a `srcdoc` iframe with
`sandbox="allow-scripts allow-same-origin allow-popups"`; later edits are
posted over the preview bridge and applied by the renderer's morph receiver,
so scroll position and open disclosures survive typing; a nav interceptor
turns internal link clicks into `navigate` messages and opens external links
in a new tab. Uploads, the renderer's fonts and an imported Theme's files
reach that document as `blob:` URLs minted by the editor.

Two facts were measured in headless Chromium before deciding, and both
shape the answer:

- With `allow-scripts` **and** `allow-same-origin`, a script inside the
  `srcdoc` frame reads `parent.document` freely. That frame is the editor's
  own origin; every editor control is one property access away, and in the
  packaged Electron app the `window.sosb` preload bridge (native dialogs,
  the file system) hangs off the same parent window. Isolation "from editor
  controls and native computer access" is not achievable in that frame.
- Without `allow-same-origin` the frame has an opaque origin. It cannot read
  the parent (`SecurityError`), has no storage, and is refused every `blob:`
  URL the editor minted ("Not allowed to load local resource"). `data:` URLs
  for images, fonts and `<script src>` load and run.

So the same frame cannot both load the editor's blob URLs and keep an
untrusted script away from the editor. The task statement anticipated this:
keep `allow-same-origin` only if blob asset URLs require it, and document why.

## Decision

### 1. A per-session switch, offered only when there is something to run

The preview pane gains an **Interactive preview** checkbox with an (i)
explanation. It is off when the editor opens, it is shell state (never
written to the Site, reset when another project is imported), and it is
rendered only when the active Theme ships a public script — a disabled switch
on every built-in Theme would be noise for the authors who will never need
it. While it is on, a status line under the device presets says that the
Theme's script is running and lists the manifest's `network` hosts and its
`offline` note, verbatim; ADR 0046 asked every extension to document those,
and this is where the author reads them before anything is contacted.

The switch is made for one Theme. It is keyed to the active Theme's id, so
selecting or importing a _different_ Theme while it is on turns it off
rather than running that Theme's script on the spot — its hosts have not
been read, and ADR 0046 says "explicitly enabled". Coming back to the first
Theme is an explicit choice again. Re-importing the same Theme (same id,
new bytes) keeps the mode on: that is the authoring loop the mode exists
for. The state is derived during render, so no document carrying another
Theme's script is ever committed, not even for one frame.

### 2. Two sandboxes, one document builder

The static preview is **unchanged**: `allow-scripts allow-same-origin
allow-popups`. It keeps `allow-same-origin` because it must load the
editor's `blob:` URLs and because nothing untrusted runs inside it — the
only scripts are the builder's own (nav interceptor, morph receiver,
lightbox, event list, embed loader), a Theme design is validated into an
element tree that cannot carry `script` or `on*` attributes (ADR 0054), and
the Theme's `public.js` is exactly what this mode leaves out.

The interactive preview boots in a **different** iframe:
`allow-scripts allow-popups allow-popups-to-escape-sandbox`. No
`allow-same-origin`, so the origin is opaque and the script cannot reach the
editor's DOM, its storage or the Electron bridge; no `allow-top-navigation`
of any kind, so it cannot navigate the editor away; no `allow-forms`,
because a form's `action` is a network request nothing declared. Switching
the mode is a document change like a Theme change (it joins the reload key),
because a sandbox attribute only takes effect on the next navigation.

Both documents come from the same `iframeSrcdoc` call. The interactive one
differs in two arguments: `includePublicScript: true`, and an asset resolver
that answers `data:` URLs.

### 3. Assets travel inside the document

Because an opaque origin cannot load `blob:` URLs, the interactive document
inlines every asset as a `data:` URL through the ordinary `assetUrlForPath`
seam (ADR 0052) — the same canonical `assets/...` paths the build writes,
resolved differently. The renderer's registry fonts already exist as base64
in the bundle; a Theme package's fonts, decorative files and `public.js` are
encoded from the bundle's bytes and cached per id and version like the blob
cache; the Site's uploads are read from the project VFS and encoded once
when the mode is switched on, re-encoded after an upload, and dropped the
moment it is switched off. The pane shows "Preparing…" until the uploads are
ready, so the document never boots with half its images missing.

The public script itself is a `<script defer src="data:text/javascript;base64,…">`
— the build's tag with a different URL, not an inline script, so the
document is still the render plus one resolver.

### 4. While interactive, edits reload; nothing is morphed

The morph receiver diffs freshly rendered markup onto the live document. A
public script _owns_ whatever it changed in that document — a menu it
opened, an attribute it set, nodes it injected — and a diff would revert
those on every keystroke, making the Theme look broken for a reason the
author cannot see. So while the mode is on, the pane keeps the iframe's
`srcDoc` equal to the latest render; React reassigns it and the browser
reloads the document, which is exactly what a visitor's refresh does. The
script starts over, scroll position is lost, and the (i) says so. The morph
path is untouched for the static preview.

### 5. Links, and what the bridge can still do

The nav interceptor works unchanged in the opaque frame: `postMessage` to
the parent with `"*"` does not need an origin. Internal links move the
preview target; external links open through `window.open(…, "noopener")`,
which `allow-popups` permits and `allow-popups-to-escape-sandbox` lets run
as an ordinary tab rather than an opaque-origin one that would break the
partner site's own storage. The opened tab has no handle back to the editor.

The frame can still post `ready`, `error` and `navigate` envelopes. None of
them reaches an editor control: `navigate` moves only the preview target
(ADR 0053), and the host validates every payload before acting on it.

### 6. Electron: no child windows, no navigation away

Electron's default for `window.open` creates a second `BrowserWindow` that
inherits the parent's `webPreferences`, preload included. The main process
now installs a window-open handler that always denies and hands `http(s)`
URLs to the system browser (`shell.openExternal`, restricted to web URLs so
a `file:` or custom-scheme URL cannot launch a program), and a
`will-navigate` guard that refuses any navigation off the editor document.
Both are pure functions with unit tests; the preload is unchanged and is
never attached to sub-frames (`nodeIntegrationInSubFrames` stays off).

### 7. The packaged renderer's CSP: audited, recorded, not changed

A `srcdoc` document inherits its parent's Content Security Policy. The
packaged renderer's `script-src 'self' 'wasm-unsafe-eval'` therefore refuses
the builder's own inline preview scripts (nav interceptor, morph receiver)
in _any_ preview frame, and would refuse the interactive document's `data:`
script as well. The Electron renderer bundle is not yet wired (its README
says so), so this cannot be verified in the packaged app and is recorded
rather than changed: when the bundle is wired, the policy needs
`'sha256-…'` hashes for the builder's five inline preview scripts (kept
honest by a test that recomputes them from the renderer's exports) and
`data:` in `script-src` for the interactive document, or another delivery
for the public script. `'unsafe-inline'` is not the answer.

## Rationale

**Why not keep `allow-same-origin` and trust the script?** ADR 0046 says
isolated, and the measurement says a same-origin frame is not. A Theme is
authored by someone the organisation trusts, but the mode exists to run its
external connections during editing; that is precisely when a mistake in a
script should be contained.

**Why `data:` URLs rather than a second origin or a service worker?** The
editor runs in a browser tab, in Electron and as a single `file://` archive.
A second origin exists in none of those without a server; a service worker
cannot serve a `srcdoc` frame and does not run on `file://`. Inlining works
everywhere the editor does, with no new moving part, and its cost is
bounded by the Site's own assets and paid only while the mode is on.

**Why reload rather than pause the morph?** A paused preview goes stale
silently; an author who edits and sees nothing change has been lied to.
Reloading keeps the document honest at the cost of in-page state, which the
mode's purpose (trying the script) rarely needs.

**Why only offer the switch with a public script?** Nothing else changes in
interactive mode. A switch that visibly does nothing teaches the wrong lesson.

## Consequences

- `PreviewPane` gains `interactive`, `onInteractiveChange` and
  `publicScript` props; `EditorApp` owns the session state (keyed to the
  Theme id it was switched on for) and the upload encoding; `interactive-preview.ts` holds the resolver, the caches and the
  two sandbox strings, which are asserted by unit tests and by the workflow
  e2e from inside the frame (`parent.document` throws, `location.origin` is
  `"null"`, storage throws, the popup opens, the internal link navigates).
- An interactive document carries every referenced asset inline, so it is
  larger than a static one by roughly 4/3 of those assets' bytes (base64),
  and each edit re-parses it. The mode is opt-in and its explanation says
  edits reload.
- A document link (a PDF a Block offers for download) is a `data:` URL in
  the interactive document, and browsers refuse to open a `data:` URL as a
  new top-level page, so such links do not open from the interactive
  preview. They work in the static preview (`blob:`) and on the published
  Site; the how-to says so.
- Inside the interactive preview a script sees an opaque origin:
  `localStorage`, cookies and form submission fail, `img.src` is a `data:`
  URL. The how-to tells authors to guard those; on the published Site they
  work normally.
- In the interactive frame the `blob:`-based static path is never used, so
  `URL.createObjectURL` remains the static preview's concern only.
- Electron: external links open in the system browser; the packaged
  renderer's CSP needs the change in §7 before either preview works there.
- Vocabulary in `CONTEXT.md`: **Interactive preview**.

## Alternatives considered

- **Same-origin frame, rely on the Theme author.** Rejected: not isolated
  (measured), and ADR 0046 says enforce.
- **A dedicated preview origin (dev-server port, custom Electron scheme).**
  Rejected: unavailable in the `file://` archive, a second server-shaped
  component in every other host.
- **Post asset bytes into the frame and let it mint its own `blob:` URLs.**
  Works in principle (an opaque origin can load its own blobs), but the
  frame would have to rewrite `img`, `srcset` and `@font-face` URLs after
  every render, which puts a second resolver in the document instead of
  behind the `assetUrlForPath` seam. Kept as the fallback if `data:` sizes
  ever bite.
- **Morph while interactive.** Rejected: reverts the script's DOM changes.
- **Pause the morph while interactive.** Rejected: a silently stale preview.
- **Relax the Electron CSP now.** Rejected: unverifiable without the wired
  renderer, and a relaxation of the editor document's own policy.

## Out of scope

- Custom Block editing forms and their rendering (issue #106, ADR 0055 on
  its own branch); the interactive preview needs nothing from them.
- Wiring the Electron renderer bundle and its CSP hashes (§7).
- A per-host allow-list enforced at runtime on the script's requests; the
  manifest's `network` is documentation the author reads, as ADR 0046 set.
