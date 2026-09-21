/**
 * Theme-package asset URL rewriting.
 *
 * A Theme package's CSS references its own decorative files relatively, the
 * way the author wrote them on disk:
 *
 * ```css
 * .hero { background-image: url(assets/grid.svg); }
 * ```
 *
 * Those paths mean nothing once the CSS is inlined into a page, so the
 * renderer rewrites them to the canonical bundle path
 * `assets/theme/<id>/assets/grid.svg` and then hands that path to the usual
 * `resolveAssetUrl` seam. In a build it stays a relative `assets/...` URL that
 * the build writes real bytes for; in the editor preview the resolver turns it
 * into a `blob:` URL. One rewrite, two targets — which is what makes
 * preview/export parity a property of the code rather than a convention.
 *
 * Remote URLs never reach this function: the package validator rejects
 * `url(http…)` and remote `@import` at import time (ADR 0050), because a Theme
 * that fetches from the network breaks the offline guarantee and would make
 * preview and export disagree whenever the network does.
 */

import type { AssetUrlForPath } from "./asset-url.js";
import { resolveAssetUrl } from "./asset-url.js";
import { themeAssetPrefix } from "./theme-bundle.js";

/**
 * Matches a CSS `url(...)` token, capturing the optional quote and the body.
 * Deliberately narrow: no `\\` escape handling, because the validator rejects
 * backslashes in theme url() tokens rather than trying to interpret them.
 */
const CSS_URL_RE = /url\(\s*(['"]?)([^'")]*)\1\s*\)/g;

/** Protocol-ish or root-relative targets we must leave exactly as they are. */
function isAbsoluteTarget(target: string): boolean {
  return (
    target.startsWith("/") ||
    target.startsWith("#") ||
    target.startsWith("data:") ||
    target.startsWith("blob:") ||
    /^[a-z][a-z0-9+.-]*:/i.test(target)
  );
}

/**
 * Rewrite a packaged theme's relative `url()` targets onto the canonical
 * `assets/theme/<id>/...` prefix, resolved through `assetUrlForPath`.
 *
 * Built-in themes never call this — their CSS carries no packaged assets, so
 * their emitted bytes are untouched and the golden matrix stays stable.
 */
export function rewriteThemeCssUrls(
  css: string,
  themeId: string,
  assetUrlForPath?: AssetUrlForPath,
): string {
  const prefix = themeAssetPrefix(themeId);
  return css.replace(CSS_URL_RE, (whole, _quote: string, rawTarget: string) => {
    const target = rawTarget.trim();
    if (target.length === 0) return whole;
    if (isAbsoluteTarget(target)) return whole;
    const normalised = target.startsWith("./") ? target.slice(2) : target;
    const resolved = resolveAssetUrl(prefix + normalised, assetUrlForPath);
    // Always quote the rewritten target: a blob: URL is long and opaque, and
    // quoting removes any question about which characters need escaping.
    return `url("${resolved.replace(/"/g, '\\"')}")`;
  });
}

/**
 * Every file a packaged theme contributes to a build, keyed by its canonical
 * output path. Fonts and decorative assets land under the same prefix, so the
 * build pipeline copies one map and the zip export mirrors one subtree.
 */
export function themeAssetsFor(bundle: {
  readonly id: string;
  readonly assets: ReadonlyMap<string, Uint8Array>;
  readonly fontSource: { readonly kind: string; readonly bytes?: ReadonlyMap<string, Uint8Array> };
}): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  const prefix = themeAssetPrefix(bundle.id);
  for (const path of [...bundle.assets.keys()].sort()) {
    out.set(prefix + path, bundle.assets.get(path)!);
  }
  if (bundle.fontSource.kind === "bundle" && bundle.fontSource.bytes !== undefined) {
    const bytes = bundle.fontSource.bytes;
    for (const path of [...bytes.keys()].sort()) {
      out.set(prefix + path, bytes.get(path)!);
    }
  }
  return out;
}
