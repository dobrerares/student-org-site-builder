export type AssetUrlForPath = (path: string) => string | undefined;

export function resolveAssetUrl(
  path: string,
  assetUrlForPath: AssetUrlForPath | undefined,
): string {
  return assetUrlForPath?.(path) ?? path;
}

/**
 * Is this reference something the renderer must leave completely alone?
 *
 * Absolute URLs (`https://…`), protocol-relative (`//cdn/…`), root-relative
 * (`/foo.png`), and inline/blob schemes (`data:`, `blob:`) already resolve
 * correctly from any page depth. Only bare relative references
 * (`assets/hero.jpg`) need a depth prefix.
 */
export function isDepthIndependentRef(ref: string): boolean {
  if (ref.length === 0) return true;
  if (ref.startsWith("/")) return true;
  if (ref.startsWith("#")) return true;
  return /^[a-z][a-z0-9+.-]*:/i.test(ref);
}

/**
 * The `../` prefix that makes a root-relative asset path resolve correctly
 * from a page emitted at `distPath`.
 *
 * `index.html`                      → `""`
 * `activitati/index.html`           → `"../"`
 * `en/activitati/index.html`        → `"../../"`
 *
 * Before this existed, the renderer emitted the bare `assets/…` path on every
 * page and the zip export papered over the breakage by mirroring the whole
 * asset folder into every nested page directory (see ADR 0003 / the zip
 * export's `distAssetPrefixes`). A raw `dist/` folder served from disk — or
 * any host that does not go through our zip — showed broken images on every
 * nested page. Computing the prefix per page depth fixes the output itself,
 * so the mirroring is no longer needed.
 *
 * `../`-prefixing is used rather than a root-relative `/assets/…` because the
 * built site must also work when opened straight off the filesystem
 * (`file://`) and when deployed into a subdirectory of a domain, neither of
 * which a leading `/` survives.
 */
export function assetPrefixForDistPath(distPath: string): string {
  const depth = distPath.split("/").length - 1;
  return "../".repeat(Math.max(0, depth));
}

/**
 * Compose the caller's resolver (the editor preview's blob-URL lookup) with
 * the page-depth prefix used for on-disk output.
 *
 * Precedence is deliberate: when the caller resolves a path to a real URL
 * (a `blob:` URL in the live preview) that URL is absolute and wins. Only the
 * unresolved fall-through — the canonical `assets/…` VFS path the deploy
 * build emits — receives the depth prefix.
 */
export function depthAwareAssetResolver(
  assetUrlForPath: AssetUrlForPath | undefined,
  prefix: string,
): AssetUrlForPath | undefined {
  if (prefix === "") return assetUrlForPath;
  return (path: string): string | undefined => {
    const resolved = assetUrlForPath?.(path);
    if (resolved !== undefined) return resolved;
    if (isDepthIndependentRef(path)) return path;
    return prefix + path;
  };
}
