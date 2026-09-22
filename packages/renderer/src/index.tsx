/** @jsxImportSource preact */
/**
 * `@sosb/renderer` — pure function `(siteData, themeId) -> HTML`.
 *
 * The same module runs in Node (build pipeline) and in the browser (editor
 * preview iframe), and produces byte-identical output in both. See ADR 0003
 * for the architectural decisions behind this package; see issue #46 for the
 * triage contract.
 *
 * Built sites contain only static HTML and CSS — no Preact / React runtime
 * is shipped to end users. Preact is used purely as the build-time template
 * language via `preact-render-to-string`.
 */

import { render } from "preact-render-to-string";
import type { Site } from "@sosb/schema";
import { ArticleShell, PageShell } from "./page-shell.js";
import { emitTokenRoot, resolveFontFamilies } from "./tokens.js";
import type { AssetUrlForPath } from "./asset-url.js";
import { assetPrefixForDistPath, depthAwareAssetResolver, resolveAssetUrl } from "./asset-url.js";
import { articleDistPath, pageDistPath } from "./routing.js";
import { FONT_ASSET_PREFIX, FONT_FACE_REGISTRY, woff2Base64 } from "./fonts/registry.js";
import { base64ToBytes } from "./fonts/bytes.js";
import { STUB_THEME_ID } from "./themes/stub.js";
import { MINIMAL_THEME_ID } from "./themes/minimal.js";
import { MODERN_THEME_ID } from "./themes/modern.js";
import { EDITORIAL_THEME_ID } from "./themes/editorial.js";
import { CIVIC_THEME_ID } from "./themes/civic.js";
import { ACADEMIC_THEME_ID } from "./themes/academic.js";
import type { ThemeBundle, ThemeFontFace } from "./theme-bundle.js";
import {
  composeThemeCss,
  offersShellVariant,
  resolveThemeBundle,
  themeAssetPrefix,
} from "./theme-bundle.js";
import { rewriteThemeCssUrls } from "./theme-assets.js";

export interface RenderOptions {
  /**
   * Index of the page in `site.pages` to render. Defaults to `0` (the home
   * page). The build pipeline (#5) calls `renderSite` once per page; the
   * editor preview also picks a single page at a time.
   */
  readonly pageIndex?: number;
  /**
   * Index into `site.articles` to render instead of a Page. Mutually exclusive
   * with `pageIndex`, which is ignored when this is set.
   *
   * Articles are a separate axis rather than extra entries in `site.pages`
   * because they carry their own publication state, URL namespace, and
   * translation rules (ADR 0047); folding them into `pages` would push those
   * rules into every Page code path that has nothing to do with them.
   */
  readonly articleIndex?: number;
  /**
   * Render target. Defaults to `"deploy"` — built static sites never carry
   * preview-only behaviour. When set to `"preview"`, the renderer emits a
   * small inline nav-click interceptor (see `preview-nav-script.ts`) so the
   * editor's `srcdoc` iframe can route nav clicks back to the host instead
   * of navigating to a 404 on the editor's own origin.
   *
   * Same code path; one option controls the preview-only delta. ADR 0005's
   * "no duplicate renderer code path" invariant is preserved — the editor's
   * `iframeSrcdoc` passes this option through `renderPreviewHtml`.
   */
  readonly mode?: "deploy" | "preview";
  /**
   * Optional browser/editor resolver for VFS asset paths. Deploy output omits
   * this so canonical `assets/...` paths remain stable; the live editor preview
   * passes a blob-URL resolver so srcdoc iframes can actually load in-memory
   * uploads and imported zip assets.
   */
  readonly assetUrlForPath?: AssetUrlForPath | undefined;
  /**
   * The resolved theme to render under (ADR 0052). Supply this to render
   * under an imported Theme package; omit it and the renderer looks `themeId`
   * up among the built-in bundles.
   *
   * The bundle's `id` must equal `themeId` — passing a mismatched pair is a
   * caller bug (two sources of truth for "which theme is this?"), so it
   * throws rather than silently preferring one.
   */
  readonly theme?: ThemeBundle | undefined;
}

/**
 * Render a site to a complete HTML document string.
 *
 * Determinism contract (per AC):
 *  - Identical `(data, themeId, opts)` → identical output, byte-for-byte.
 *  - No `Date.now()`, `Math.random()`, `crypto.randomUUID()`, `performance.now()`.
 *  - No environment-dependent string production (locale-formatted dates etc.).
 *
 * @param data    Validated site data. Callers should run `@sosb/schema`'s
 *                `validate(data)` first; this function trusts the shape.
 * @param themeId Theme to render under. Today `"stub"` (the renderer's
 *                layout-only sentinel), `"minimal"` (#29), `"modern"`
 *                (#28), `"civic"` (#30), and `"academic"` (#47) are
 *                registered; future themes (#31) register additional ids
 *                the same way.
 * @param opts    Optional page selection.
 * @returns       A complete HTML document beginning with `<!doctype html>`.
 */
export function renderSite(data: Site, themeId: string, opts?: RenderOptions): string {
  const mode = opts?.mode ?? "deploy";

  // Theme resolution is document-kind agnostic and happens once: a Page and an
  // Article rendered under the same Site must agree about the theme, its CSS,
  // and which shell variant applies. Resolving it separately in each branch is
  // how the two would quietly drift.
  const bundle = resolveThemeBundle(themeId, opts?.theme);
  // A shell variant only applies when the *active* theme actually offers it.
  // Gating here (rather than trusting the saved value) means a choice left
  // over from another theme cannot leak a dangling attribute into the output.
  const savedShellVariant = (data.theme as { shellVariant?: unknown }).shellVariant;
  const shellVariant =
    typeof savedShellVariant === "string" && offersShellVariant(bundle, savedShellVariant)
      ? savedShellVariant
      : undefined;

  const articleIndex = opts?.articleIndex;
  if (articleIndex !== undefined) {
    const articles = data.articles ?? [];
    const article = articles[articleIndex];
    if (article === undefined) {
      throw new Error(
        `renderSite: articleIndex ${articleIndex} is out of range (site has ${articles.length} articles)`,
      );
    }
    // Articles sit one or two directories deeper than any Page
    // (`articles/<slug>/`, `<lang>/articles/<slug>/`), so the depth prefix has
    // to come from the Article's own dist path. Reusing a Page's prefix here
    // would emit `../assets/…` from a directory that needs `../../assets/…`.
    const assetUrlForPath = depthAwareAssetResolver(
      opts?.assetUrlForPath,
      assetPrefixForDistPath(articleDistPath(data, article)),
    );
    const css = composeCss(data, bundle, assetUrlForPath);
    const fontPreloads = fontPreloadHrefsFor(data, bundle, assetUrlForPath);
    const articleBody = render(
      <ArticleShell
        site={data}
        article={article}
        css={css}
        fontPreloads={fontPreloads}
        mode={mode}
        assetUrlForPath={assetUrlForPath}
        theme={bundle}
        shellVariant={shellVariant}
      />,
    );
    return `<!doctype html>${articleBody}`;
  }

  const pageIndex = opts?.pageIndex ?? 0;
  const page = data.pages[pageIndex];
  if (page === undefined) {
    throw new Error(
      `renderSite: pageIndex ${pageIndex} is out of range (site has ${data.pages.length} pages)`,
    );
  }

  // Asset references are emitted relative to the page's own directory, so a
  // nested page (`activitati/index.html`) points at `../assets/…`. See
  // `assetPrefixForDistPath`. The editor preview's blob resolver still wins
  // for any path it can resolve.
  //
  // A packaged Theme's own fonts and decorative files go through this same
  // resolver, under `assets/theme/<id>/…`, so they inherit the depth prefix
  // for free — there is no second rule for Theme assets to fall out of step
  // with.
  const assetUrlForPath = depthAwareAssetResolver(
    opts?.assetUrlForPath,
    assetPrefixForDistPath(pageDistPath(data, page)),
  );
  const css = composeCss(data, bundle, assetUrlForPath);
  const fontPreloads = fontPreloadHrefsFor(data, bundle, assetUrlForPath);
  const body = render(
    <PageShell
      site={data}
      page={page}
      css={css}
      fontPreloads={fontPreloads}
      mode={mode}
      assetUrlForPath={assetUrlForPath}
      theme={bundle}
      shellVariant={shellVariant}
    />,
  );
  return `<!doctype html>${body}`;
}

function composeCss(site: Site, bundle: ThemeBundle, assetUrlForPath?: AssetUrlForPath): string {
  const root = emitTokenRoot(site, bundle.defaults, bundle.baselineTokens);
  const composed = composeThemeCss(bundle);
  // Only packaged themes carry relative asset URLs worth rewriting. Skipping
  // built-ins keeps their emitted bytes identical to the pre-seam renderer,
  // which is what lets the golden-file matrix stay untouched by this change.
  const themeCss =
    bundle.origin === "package"
      ? rewriteThemeCssUrls(composed, bundle.id, assetUrlForPath)
      : composed;
  const faces = emitFontFaces(site, bundle, assetUrlForPath);
  // @font-face rules go first so the browser can begin fetching woff2 assets
  // before it parses the (much larger) theme CSS. Guard the leading join so an
  // empty face block never injects a blank line (keeps system-font output and
  // goldens byte-stable).
  return faces === "" ? `${root}\n${themeCss}` : `${faces}\n${root}\n${themeCss}`;
}

/**
 * The self-hosted font families actually referenced by a site's resolved
 * `--font-headline` / `--font-body`, gated to those present in the registry.
 * Unique and sorted for deterministic emission.
 */
export function usedFamiliesFor(site: Site, bundle: ThemeBundle): string[] {
  const { headline, body } = resolveFontFamilies(site, bundle.defaults, bundle.baselineTokens);
  const used = new Set<string>();
  for (const family of [headline, body]) {
    if (family !== undefined && family in FONT_FACE_REGISTRY) used.add(family);
  }
  return [...used].sort();
}

/**
 * Emit the page's `@font-face` rules.
 *
 * Two sources, in a fixed order (ADR 0052):
 *  1. The compile-time registry, gated to the families the resolved tokens
 *     actually name. This is the built-in behaviour and is emitted first, so
 *     a built-in theme's bytes are exactly what they were before the seam.
 *  2. The theme bundle's own packaged faces, for imported Theme packages.
 *
 * Both halves are sorted, so output stays deterministic. A packaged theme gets
 * both halves: its bundled display face *and* whichever builder family the
 * author picked, which is what makes `supports.fonts` mean something.
 */
function emitFontFaces(site: Site, bundle: ThemeBundle, assetUrlForPath?: AssetUrlForPath): string {
  const registry = emitRegistryFontFaces(usedFamiliesFor(site, bundle), assetUrlForPath);
  const packaged = emitBundleFontFaces(bundle, assetUrlForPath);
  if (registry === "") return packaged;
  if (packaged === "") return registry;
  return `${registry}\n${packaged}`;
}

/**
 * `@font-face` rules for a packaged theme's own woff2 files, emitted under the
 * canonical `assets/theme/<id>/<file>` path so build output and preview blob
 * resolution agree. Sorted by family, then weight, then style, then file.
 */
function emitBundleFontFaces(bundle: ThemeBundle, assetUrlForPath?: AssetUrlForPath): string {
  if (bundle.fontSource.kind !== "bundle") return "";
  const faces = [...bundle.fontSource.faces].sort(sortFontFaces);
  if (faces.length === 0) return "";
  const prefix = themeAssetPrefix(bundle.id);
  const rules = faces.map((face) => {
    const src = resolveAssetUrl(prefix + face.file, assetUrlForPath);
    const range = face.unicodeRange === undefined ? "" : `unicode-range:${face.unicodeRange};`;
    return (
      `@font-face{font-family:"${face.family}";font-style:${face.style};` +
      `font-weight:${face.weight};font-display:swap;` +
      `src:url(${src}) format("woff2");${range}}`
    );
  });
  return rules.join("\n");
}

function sortFontFaces(a: ThemeFontFace, b: ThemeFontFace): number {
  return (
    a.family.localeCompare(b.family) ||
    a.weight - b.weight ||
    a.style.localeCompare(b.style) ||
    a.file.localeCompare(b.file)
  );
}

/**
 * Emit `@font-face` rules for the given (already-gated) families. Each family's
 * registered defs are emitted sorted by weight then subset so output is
 * deterministic. Returns `""` when no families are used (no self-hosted fonts).
 */
function emitRegistryFontFaces(
  families: readonly string[],
  assetUrlForPath?: AssetUrlForPath,
): string {
  if (families.length === 0) return "";
  const rules: string[] = [];
  for (const family of [...families].sort()) {
    const defs = [...(FONT_FACE_REGISTRY[family] ?? [])].sort(
      (a, b) => a.weight - b.weight || a.subset.localeCompare(b.subset),
    );
    for (const def of defs) {
      const src = resolveAssetUrl(FONT_ASSET_PREFIX + def.file, assetUrlForPath);
      rules.push(
        `@font-face{font-family:"${def.family}";font-style:normal;font-weight:${def.weight};` +
          `font-display:swap;src:url(${src}) format("woff2");unicode-range:${def.unicodeRange};}`,
      );
    }
  }
  return rules.join("\n");
}

/**
 * Font preload hrefs matching the emitted @font-face src URLs. Preloading the
 * exact same self-hosted files lets the browser start fetching before it
 * reaches the inline CSS font-face block. Combined with `font-display:swap`
 * this avoids permanent fallback text while still letting the page render if a
 * font request is slow.
 */
export function fontPreloadHrefsFor(
  site: Site,
  bundle: ThemeBundle,
  assetUrlForPath?: AssetUrlForPath,
): string[] {
  // Registry faces only. A packaged theme may bundle many faces, and
  // preloading all of them would spend the page's byte budget (ADR 0033)
  // before any content paints; `font-display: swap` already prevents
  // permanently-invisible text. ADR 0052 records the trade-off.
  const hrefs: string[] = [];
  for (const family of usedFamiliesFor(site, bundle)) {
    const defs = [...(FONT_FACE_REGISTRY[family] ?? [])].sort(
      (a, b) => a.weight - b.weight || a.subset.localeCompare(b.subset),
    );
    for (const def of defs) {
      hrefs.push(resolveAssetUrl(FONT_ASSET_PREFIX + def.file, assetUrlForPath));
    }
  }
  return hrefs;
}

/**
 * The woff2 asset bytes a site needs, keyed by their canonical
 * `assets/fonts/<file>` VFS path. PR-F2b's `build()` consumes this to write the
 * self-hosted font files into the output. Deterministic (sorted families/defs).
 */
export function fontAssetsFor(site: Site, bundle: ThemeBundle): Map<string, Uint8Array> {
  const assets = new Map<string, Uint8Array>();
  for (const family of usedFamiliesFor(site, bundle)) {
    const defs = [...(FONT_FACE_REGISTRY[family] ?? [])].sort(
      (a, b) => a.weight - b.weight || a.subset.localeCompare(b.subset),
    );
    for (const def of defs) {
      const b64 = woff2Base64(def.file);
      if (b64 === undefined) continue;
      assets.set(`${FONT_ASSET_PREFIX}${def.file}`, base64ToBytes(b64));
    }
  }
  return assets;
}

/**
 * Registry of theme ids known to the renderer.
 *
 * Includes every theme registered in this module: the stub layout sentinel
 * plus the production themes (#28-#31 / #47). The accessibility regression
 * matrix in `e2e/a11y.spec.ts` iterates this list, so the per-theme CI gate
 * expands automatically as themes merge to main — no test edits needed per
 * theme. ADR 0026 records the dynamic-matrix design.
 */
export const KNOWN_THEME_IDS: readonly string[] = [
  STUB_THEME_ID,
  MINIMAL_THEME_ID,
  MODERN_THEME_ID,
  EDITORIAL_THEME_ID,
  CIVIC_THEME_ID,
  ACADEMIC_THEME_ID,
];

// The theme seam (ADR 0052). `ThemeBundle` is the whole contract between the
// renderer and any theme, built-in or imported; `@sosb/theme-package` builds
// bundles from a `.sosb-theme.zip`, and the editor/build pass them back in
// through `RenderOptions.theme`.
export type {
  ThemeBundle,
  ThemeFontFace,
  ThemeFontSource,
  ThemeSupports,
  ThemeVariant,
} from "./theme-bundle.js";
export {
  ALL_THEME_SUPPORTS,
  builtinThemeBundle,
  composeThemeCss,
  isBuiltinThemeId,
  offersBlockVariant,
  offersShellVariant,
  resolveThemeBundle,
  themeAssetPrefix,
  variantsForBlockType,
} from "./theme-bundle.js";
export { rewriteThemeCssUrls, themeAssetsFor } from "./theme-assets.js";
export { activeBlockVariant, themeReferenceIssue } from "./theme-reference.js";
export type { ThemeReferenceIssue } from "./theme-reference.js";

export { STUB_THEME_ID } from "./themes/stub.js";
export { MINIMAL_THEME_ID } from "./themes/minimal.js";
export { MODERN_THEME_ID } from "./themes/modern.js";
export { EDITORIAL_THEME_ID } from "./themes/editorial.js";
export { CIVIC_THEME_ID } from "./themes/civic.js";
export { ACADEMIC_THEME_ID } from "./themes/academic.js";
export {
  articleDistPath,
  articleHistoricalPath,
  articleHreflangEntriesFor,
  articleLanguageSwitcherEntriesFor,
  articlePath,
  articleRedirectsFor,
  homePageIndex,
  homePagePathForLanguage,
  hreflangEntriesFor,
  languageHomeIndex,
  languageSwitcherEntriesFor,
  nativeLanguageName,
  navPagesFor,
  navPagesForLanguage,
  pageDistPath,
  pagePath,
} from "./routing.js";
export type { ArticleRedirect, HreflangEntry, LanguageSwitcherEntry } from "./routing.js";
export { articleCopy, formatArticleDate } from "./article-text.js";
export { EMBED_LAZY_LOAD_SCRIPT } from "./blocks/embed-lazy-loader.js";
export { resolveEmbed } from "./blocks/embed.js";
export { FAQ_ACCORDION_SCRIPT_SOURCE, FAQ_ENHANCED_ATTR } from "./blocks/faq.script.js";
export { PREVIEW_NAV_SCRIPT, PREVIEW_NAV_SCRIPT_MARKER } from "./preview-nav-script.js";
export { PREVIEW_MORPH_SCRIPT, PREVIEW_MORPH_SCRIPT_MARKER } from "./preview-morph-script.js";
export {
  assetPrefixForDistPath,
  depthAwareAssetResolver,
  isDepthIndependentRef,
} from "./asset-url.js";
export type { AssetUrlForPath } from "./asset-url.js";

// Self-hosted font primitives. The editor preview mints blob URLs from these
// so its in-memory resolver can satisfy the `assets/fonts/<file>.woff2` paths
// the renderer emits (deploy/zip ship the real bytes; preview has no server).
// Re-exports of existing internal data — emission logic is untouched.
export { FONT_ASSET_PREFIX, FONT_FACE_REGISTRY, woff2Base64 } from "./fonts/registry.js";
export type { FontFaceDef } from "./fonts/registry.js";
export { base64ToBytes } from "./fonts/bytes.js";

// Contrast-safe color math. Re-exports of the pure helpers the renderer
// already uses to pick readable on-colors for buttons/badges (tokens.ts).
// Surfaced so the editor's theme color pickers can preview the SAME
// derived on-color an author's pick will produce — no logic change here.
export { onColorFor } from "./color-math.js";
