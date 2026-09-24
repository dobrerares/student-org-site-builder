/**
 * Preview-only resolver data for an imported Theme package's own files.
 *
 * The sibling `font-blobs.ts` does this for the renderer's compile-time font
 * registry. A Theme package's fonts and decorative images have the same
 * problem and the same fix: the renderer emits
 * `assets/theme/<id>/fonts/x.woff2` and `url(assets/theme/<id>/assets/y.svg)`,
 * which resolve to real files in a build but 404 inside the editor's
 * server-less `srcdoc` iframe. So we mint a `blob:` URL per file and let the
 * editor's `assetUrlForPath` hand it back.
 *
 * This is the mechanism that makes preview/export parity real rather than
 * aspirational: preview and build consume the *same* `ThemeBundle` and the
 * *same* canonical paths, and differ only in what those paths resolve to.
 *
 * Blob URLs are cached per theme id + version, so re-rendering the preview on
 * every keystroke does not leak object URLs, while importing a new version of
 * the same Theme does mint fresh ones.
 */

import { themeAssetPrefix, themeAssetsFor, type ThemeBundle } from "@sosb/renderer";

/** Minted URLs for one bundle, keyed by canonical `assets/theme/...` path. */
interface ThemeBlobEntry {
  readonly version: string;
  readonly urls: Map<string, string>;
}

const cache = new Map<string, ThemeBlobEntry>();

/**
 * Best-effort MIME so the browser treats fonts and images correctly. Shared
 * with the interactive preview, which serves the same files as `data:` URLs.
 */
export function themeAssetMime(path: string): string {
  if (path.endsWith(".woff2")) return "font/woff2";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".avif")) return "image/avif";
  // The Theme's public-site script, for the interactive preview: a browser
  // refuses to execute a `<script src>` served as an octet stream.
  if (path.endsWith(".js") || path.endsWith(".mjs")) return "text/javascript";
  return "application/octet-stream";
}

function revokeEntry(entry: ThemeBlobEntry): void {
  for (const url of entry.urls.values()) URL.revokeObjectURL(url);
}

/**
 * Mint (or reuse) blob URLs for every file a Theme package contributes.
 *
 * Returns an empty map for built-in themes — they contribute no packaged
 * files — and in any environment without `URL.createObjectURL` (jsdom, SSR
 * tooling), where the resolver simply declines and the renderer emits the raw
 * path.
 */
export function getThemeBlobUrls(bundle: ThemeBundle | undefined): ReadonlyMap<string, string> {
  if (bundle === undefined || bundle.origin !== "package") return new Map();
  if (typeof URL.createObjectURL !== "function") return new Map();

  const cached = cache.get(bundle.id);
  if (cached !== undefined && cached.version === bundle.version) return cached.urls;
  if (cached !== undefined) revokeEntry(cached);

  const urls = new Map<string, string>();
  for (const [path, bytes] of themeAssetsFor(bundle)) {
    // Copy into a fresh buffer: `Blob` keeps a reference, and the bundle's
    // bytes are shared with the VFS.
    const blob = new Blob([new Uint8Array(bytes)], { type: themeAssetMime(path) });
    urls.set(path, URL.createObjectURL(blob));
  }
  const entry: ThemeBlobEntry = { version: bundle.version, urls };
  cache.set(bundle.id, entry);
  return urls;
}

/**
 * Resolve one `assets/theme/<id>/...` path against the active bundle, or
 * `undefined` when the path belongs to something else.
 */
export function themeBlobUrlForPath(
  path: string,
  bundle: ThemeBundle | undefined,
): string | undefined {
  if (bundle === undefined) return undefined;
  if (!path.startsWith(themeAssetPrefix(bundle.id))) return undefined;
  return getThemeBlobUrls(bundle).get(path);
}

/** Revoke every minted Theme blob URL. Called on editor teardown. */
export function revokeThemeBlobUrls(): void {
  for (const entry of cache.values()) revokeEntry(entry);
  cache.clear();
}
