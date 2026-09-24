/**
 * Interactive preview (ADR 0046, ADR 0056) — the document the preview iframe
 * boots when the author switches the Theme's public-site script on.
 *
 * The static preview runs in an iframe that shares the editor's origin
 * (`allow-same-origin`), which is what lets it load the `blob:` URLs the
 * editor mints for uploads, fonts and Theme files. The interactive preview
 * cannot share that origin: a script in a same-origin frame can walk
 * `parent.document` and reach every editor control, and in Electron the
 * `window.sosb` preload surface hangs off the same parent window. So the
 * interactive iframe drops `allow-same-origin` and gets an *opaque* origin —
 * and an opaque-origin document is refused every `blob:` URL the editor owns
 * ("Not allowed to load local resource"). Every asset therefore has to travel
 * inside the document itself, as a `data:` URL. This module mints them.
 *
 * Three sources, the same canonical paths the build writes (ADR 0052):
 *
 *  - `assets/fonts/<file>.woff2` — the renderer's own font registry, already
 *    carried as base64 in the bundle;
 *  - `assets/theme/<id>/...` — the Theme package's fonts, decorative files
 *    and its `public.js`, from the bundle's bytes;
 *  - `assets/<hash>.<ext>` — the Site's uploads, read from the project VFS
 *    once when the mode is switched on.
 *
 * The cost is document size: a `data:` URL is a third larger than the bytes
 * it carries and lives inside the HTML string, so a Site with many megabytes
 * of images produces a preview document of the same order. That is why the
 * mode is opt-in, why the upload map is dropped as soon as the mode is
 * switched off, and why the interactive document reloads rather than morphs
 * (see `PreviewPane`).
 */

import {
  FONT_ASSET_PREFIX,
  FONT_FACE_REGISTRY,
  themeAssetPrefix,
  themeAssetsFor,
  woff2Base64,
  type ThemeBundle,
} from "@sosb/renderer";
import type { Vfs } from "@sosb/vfs/vfs";

import { assetHashFromPath, assetMimeForPath } from "./site-io.js";
import { themeAssetMime } from "./theme-blobs.js";

/**
 * `sandbox` for the interactive iframe. No `allow-same-origin`: the frame
 * gets an opaque origin, so the Theme's script cannot reach the editor's
 * DOM, its storage or (in Electron) the preload bridge on the parent window.
 * No `allow-top-navigation*`: the script cannot navigate the editor away. No
 * `allow-forms`: a form's `action` is a network request nothing declared.
 * `allow-popups` keeps the preview-nav interceptor's `window.open` for
 * external links, and `allow-popups-to-escape-sandbox` lets the partner site
 * it opens run as an ordinary tab rather than inheriting an opaque origin
 * that would break its own storage — the opened tab is `noopener` and never
 * gets a handle back to the editor.
 */
export const INTERACTIVE_PREVIEW_SANDBOX =
  "allow-scripts allow-popups allow-popups-to-escape-sandbox";

/**
 * `sandbox` for the static preview, unchanged from PR #116. `allow-same-origin`
 * stays because the static document must load the editor's `blob:` URLs, and
 * nothing untrusted runs inside it: the only scripts are the builder's own
 * (nav interceptor, morph receiver, lightbox, event list, embed loader), a
 * Theme design is validated into a tree that cannot contain `script` or
 * `on*` attributes, and the Theme's `public.js` is exactly what this mode
 * leaves out.
 */
export const STATIC_PREVIEW_SANDBOX = "allow-scripts allow-same-origin allow-popups";

/** Base64-encode bytes into a `data:` URL without blowing the call stack. */
export function bytesToDataUrl(mime: string, bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/**
 * `data:` URLs for every upload under `assets/`, keyed by content hash —
 * the same key the static preview's blob cache uses, so the two resolvers
 * agree on what an asset *is* and differ only in how it is delivered.
 */
export async function prepareInteractiveAssetUrls(vfs: Vfs): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const path of await vfs.list("assets/")) {
    const mime = assetMimeForPath(path);
    if (mime === undefined) continue;
    const bytes = await vfs.read(path);
    out.set(assetHashFromPath(path), bytesToDataUrl(mime, new Uint8Array(bytes)));
  }
  return out;
}

let fontDataUrls: Map<string, string> | undefined;

/** The renderer's registry fonts as `data:` URLs, minted once per session. */
function fontDataUrlForPath(path: string): string | undefined {
  if (!path.startsWith(FONT_ASSET_PREFIX)) return undefined;
  if (fontDataUrls === undefined) {
    fontDataUrls = new Map();
    for (const defs of Object.values(FONT_FACE_REGISTRY)) {
      for (const def of defs) {
        const key = FONT_ASSET_PREFIX + def.file;
        if (fontDataUrls.has(key)) continue;
        const b64 = woff2Base64(def.file);
        if (b64 === undefined) continue;
        fontDataUrls.set(key, `data:font/woff2;base64,${b64}`);
      }
    }
  }
  return fontDataUrls.get(path);
}

interface ThemeDataEntry {
  readonly version: string;
  readonly urls: Map<string, string>;
}

const themeCache = new Map<string, ThemeDataEntry>();

/**
 * `data:` URLs for a Theme package's files, cached per id + version exactly
 * like the blob cache so a re-imported package at a new version is re-encoded
 * and a re-render on every keystroke is not.
 */
export function getThemeDataUrls(bundle: ThemeBundle | undefined): ReadonlyMap<string, string> {
  if (bundle === undefined || bundle.origin !== "package") return new Map();
  const cached = themeCache.get(bundle.id);
  if (cached !== undefined && cached.version === bundle.version) return cached.urls;
  const urls = new Map<string, string>();
  for (const [path, bytes] of themeAssetsFor(bundle)) {
    urls.set(path, bytesToDataUrl(themeAssetMime(path), bytes));
  }
  themeCache.set(bundle.id, { version: bundle.version, urls });
  return urls;
}

/** Drop every cached Theme `data:` URL (Theme import/removal, editor teardown). */
export function clearThemeDataUrls(): void {
  themeCache.clear();
}

/**
 * The interactive preview's `assetUrlForPath`. Mirrors the static resolver's
 * order (registry fonts, then the Theme's files, then uploads) over `data:`
 * URLs; `undefined` for anything else, so the renderer emits the raw path.
 */
export function interactiveAssetUrlForPath(
  path: string,
  bundle: ThemeBundle | undefined,
  uploads: ReadonlyMap<string, string> | null,
): string | undefined {
  if (!path.startsWith("assets/")) return undefined;
  const font = fontDataUrlForPath(path);
  if (font !== undefined) return font;
  if (bundle !== undefined && path.startsWith(themeAssetPrefix(bundle.id))) {
    return getThemeDataUrls(bundle).get(path);
  }
  return uploads?.get(assetHashFromPath(path));
}
