/**
 * Preview-only resolver data for renderer-owned self-hosted fonts.
 *
 * The renderer emits `@font-face { src: url(assets/fonts/<file>.woff2) }` for
 * the families a theme actually uses. In a DEPLOY/zip build those paths resolve
 * to real sibling files that PR-F2b wrote into the output. The editor preview,
 * however, renders the themed site into a `srcdoc` iframe with no server — a
 * raw `assets/fonts/...` path 404s and the browser falls back to a system font.
 *
 * To fix that, the editor's `assetUrlForPath` resolver consults this module:
 * for every renderer-registered woff2 file we mint a `blob:` URL once (the
 * bytes are static for the session) keyed by the canonical
 * `assets/fonts/<file>.woff2` path. The font base64 is already bundled into the
 * editor (it ships in `@sosb/renderer`), so this works fully offline — no
 * network, no server.
 *
 * The map is built lazily on first use and memoised: the bytes never change, so
 * a single set of blob URLs is reused for the whole editor session.
 */
import { FONT_ASSET_PREFIX, FONT_FACE_REGISTRY, base64ToBytes, woff2Base64 } from "@sosb/renderer";

let fontBlobUrls: Map<string, string> | undefined;

/**
 * The lazily-minted map of canonical font path -> `blob:` URL. Built once and
 * memoised. Iterates the registry's faces, deduping by `file` (latin and
 * latin-ext subsets are distinct files; the same file is never minted twice).
 */
export function getFontBlobUrls(): ReadonlyMap<string, string> {
  if (fontBlobUrls !== undefined) return fontBlobUrls;
  const map = new Map<string, string>();
  // `URL.createObjectURL` is unavailable in some non-browser contexts (jsdom,
  // SSR tooling). Real browsers always have it. When it's missing we mint
  // nothing and memoise the empty map: the resolver then returns `undefined`,
  // the renderer emits the raw `assets/fonts/...` path, and the (server-less)
  // preview falls back to a system font instead of throwing on mount.
  if (typeof URL.createObjectURL !== "function") {
    fontBlobUrls = map;
    return fontBlobUrls;
  }
  for (const defs of Object.values(FONT_FACE_REGISTRY)) {
    for (const def of defs) {
      const path = FONT_ASSET_PREFIX + def.file;
      if (map.has(path)) continue;
      const b64 = woff2Base64(def.file);
      if (b64 === undefined) continue;
      const blob = new Blob([base64ToBytes(b64)], { type: "font/woff2" });
      map.set(path, URL.createObjectURL(blob));
    }
  }
  fontBlobUrls = map;
  return fontBlobUrls;
}

/**
 * Resolve a single `assets/fonts/<file>.woff2` path to its `blob:` URL, or
 * `undefined` if the path is not a renderer-owned font asset. Cheap to call:
 * the underlying map is memoised after the first invocation.
 */
export function fontBlobUrlForPath(path: string): string | undefined {
  if (!path.startsWith(FONT_ASSET_PREFIX)) return undefined;
  return getFontBlobUrls().get(path);
}

/**
 * Revoke every minted font blob URL and reset the memoised map. Called on
 * editor teardown so object-URL entries don't leak past the editor's lifetime.
 * The next `getFontBlobUrls()` call mints a fresh set.
 */
export function revokeFontBlobUrls(): void {
  if (fontBlobUrls === undefined) return;
  for (const url of fontBlobUrls.values()) {
    URL.revokeObjectURL(url);
  }
  fontBlobUrls = undefined;
}
