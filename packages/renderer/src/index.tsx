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
import { PageShell } from "./page-shell.js";
import { emitTokenRoot, resolveFontFamilies } from "./tokens.js";
import type { AssetUrlForPath } from "./asset-url.js";
import { resolveAssetUrl } from "./asset-url.js";
import { FONT_ASSET_PREFIX, FONT_FACE_REGISTRY, woff2Base64 } from "./fonts/registry.js";
import { base64ToBytes } from "./fonts/bytes.js";
import { STUB_THEME_CSS, STUB_THEME_ID } from "./themes/stub.js";
import { PRODUCTION_SITE_BASE_CSS } from "./themes/production-base.js";
import { MINIMAL_THEME_BASELINE_TOKENS, MINIMAL_THEME_CSS, MINIMAL_THEME_ID } from "./themes/minimal.js";
import { MODERN_THEME_BASELINE_TOKENS, MODERN_THEME_CSS, MODERN_THEME_ID } from "./themes/modern.js";
import {
  EDITORIAL_THEME_BASELINE_TOKENS,
  EDITORIAL_THEME_CSS,
  EDITORIAL_THEME_ID,
} from "./themes/editorial.js";
import { CIVIC_THEME_BASELINE_TOKENS, CIVIC_THEME_CSS, CIVIC_THEME_ID } from "./themes/civic.js";
import { ACADEMIC_THEME_CSS, ACADEMIC_THEME_ID, ACADEMIC_THEME_TOKENS } from "./themes/academic.js";

export interface RenderOptions {
  /**
   * Index of the page in `site.pages` to render. Defaults to `0` (the home
   * page). The build pipeline (#5) calls `renderSite` once per page; the
   * editor preview also picks a single page at a time.
   */
  readonly pageIndex?: number;
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
  const pageIndex = opts?.pageIndex ?? 0;
  const page = data.pages[pageIndex];
  if (page === undefined) {
    throw new Error(
      `renderSite: pageIndex ${pageIndex} is out of range (site has ${data.pages.length} pages)`,
    );
  }

  const mode = opts?.mode ?? "deploy";
  const css = composeCss(data, themeId, opts?.assetUrlForPath);
  const body = render(
    <PageShell
      site={data}
      page={page}
      css={css}
      mode={mode}
      assetUrlForPath={opts?.assetUrlForPath}
    />,
  );
  return `<!doctype html>${body}`;
}

function composeCss(site: Site, themeId: string, assetUrlForPath?: AssetUrlForPath): string {
  const root = emitTokenRoot(site, themeDefaultsFor(themeId), themeBaselineTokensFor(themeId));
  const themeCss = themeCssFor(themeId);
  const faces = emitFontFaces(usedFamiliesFor(site, themeId), assetUrlForPath);
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
export function usedFamiliesFor(site: Site, themeId: string): string[] {
  const { headline, body } = resolveFontFamilies(
    site,
    themeDefaultsFor(themeId),
    themeBaselineTokensFor(themeId),
  );
  const used = new Set<string>();
  for (const family of [headline, body]) {
    if (family !== undefined && family in FONT_FACE_REGISTRY) used.add(family);
  }
  return [...used].sort();
}

/**
 * Emit `@font-face` rules for the given (already-gated) families. Each family's
 * registered defs are emitted sorted by weight then subset so output is
 * deterministic. Returns `""` when no families are used (no self-hosted fonts).
 */
function emitFontFaces(families: readonly string[], assetUrlForPath?: AssetUrlForPath): string {
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
 * The woff2 asset bytes a site needs, keyed by their canonical
 * `assets/fonts/<file>` VFS path. PR-F2b's `build()` consumes this to write the
 * self-hosted font files into the output. Deterministic (sorted families/defs).
 */
export function fontAssetsFor(site: Site, themeId: string): Map<string, Uint8Array> {
  const assets = new Map<string, Uint8Array>();
  for (const family of usedFamiliesFor(site, themeId)) {
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
 * Compose theme CSS as `STUB_THEME_CSS` (layout baseline covering every
 * registered block type) plus the active theme's curated overlay (palette,
 * typography, hero composition). Later wins per the CSS cascade, so the
 * theme overrides stub where they overlap and adds rules where stub doesn't.
 *
 * The stub-as-baseline composition was the original design intent — see the
 * comment at the top of `activities-list-golden.test.ts`, which described
 * the test stack as "until #47 substitutes the CSS for `themeId === academic`,
 * the renderer falls back to the stub theme". Production themes (#28-#31, #47)
 * shipped curated overlays expecting to extend stub, but the original
 * implementation of this function returned only the theme's CSS — leaving
 * any block the theme didn't curate (most of them, since each theme styles
 * 1-3 blocks) rendering with no theme CSS at all. This composition closes
 * that gap.
 *
 * The stub theme itself returns just stub CSS (no double-emit).
 * Unknown / future themes fall back to stub-only.
 */
function themeCssFor(themeId: string): string {
  if (themeId === STUB_THEME_ID) return STUB_THEME_CSS;
  const base = `${STUB_THEME_CSS}\n${PRODUCTION_SITE_BASE_CSS}`;
  if (themeId === EDITORIAL_THEME_ID) return `${base}\n${EDITORIAL_THEME_CSS}`;
  if (themeId === CIVIC_THEME_ID) return `${base}\n${CIVIC_THEME_CSS}`;
  if (themeId === ACADEMIC_THEME_ID) return `${base}\n${ACADEMIC_THEME_CSS}`;
  if (themeId === MINIMAL_THEME_ID) return `${base}\n${MINIMAL_THEME_CSS}`;
  if (themeId === MODERN_THEME_ID) return `${base}\n${MODERN_THEME_CSS}`;
  return STUB_THEME_CSS;
}

function themeDefaultsFor(themeId: string): Readonly<Record<string, string>> | undefined {
  // No theme currently ships schema-keyed defaults via this path — every
  // production theme (incl. editorial, recast onto the tuple mechanism) routes
  // its palette/fonts/density/radius through `themeBaselineTokensFor`. The
  // parameter is kept (and the function in the precedence chain: baseline →
  // defaults → tuple → user) so a future theme can opt back into schema-keyed
  // defaults without re-threading the emitter.
  // The stub theme deliberately ships no curated defaults — it leans on the
  // baseline values in `tokens.ts` so framework tests stay anchored.
  void themeId;
  return undefined;
}

/**
 * Per-theme baseline tokens shipped as raw [cssProp, value] pairs. Composed
 * into `:root` after the renderer's universal baseline and after schema-keyed
 * theme defaults, so themes that prefer to ship CSS-property-keyed palettes
 * (civic = #30, academic = #47) can do so without funnelling through
 * `SCHEMA_TOKEN_MAP`.
 */
function themeBaselineTokensFor(themeId: string): ReadonlyArray<readonly [string, string]> {
  if (themeId === EDITORIAL_THEME_ID) return EDITORIAL_THEME_BASELINE_TOKENS;
  if (themeId === CIVIC_THEME_ID) return CIVIC_THEME_BASELINE_TOKENS;
  if (themeId === ACADEMIC_THEME_ID) return ACADEMIC_THEME_TOKENS;
  if (themeId === MODERN_THEME_ID) return MODERN_THEME_BASELINE_TOKENS;
  if (themeId === MINIMAL_THEME_ID) return MINIMAL_THEME_BASELINE_TOKENS;
  return [];
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

export { STUB_THEME_ID } from "./themes/stub.js";
export { MINIMAL_THEME_ID } from "./themes/minimal.js";
export { MODERN_THEME_ID } from "./themes/modern.js";
export { EDITORIAL_THEME_ID } from "./themes/editorial.js";
export { CIVIC_THEME_ID } from "./themes/civic.js";
export { ACADEMIC_THEME_ID } from "./themes/academic.js";
export {
  homePageIndex,
  homePagePathForLanguage,
  hreflangEntriesFor,
  languageHomeIndex,
  languageSwitcherEntriesFor,
  nativeLanguageName,
  navPagesFor,
  pageDistPath,
  pagePath,
} from "./routing.js";
export type { HreflangEntry, LanguageSwitcherEntry } from "./routing.js";
export { EMBED_LAZY_LOAD_SCRIPT } from "./blocks/embed-lazy-loader.js";
export { resolveEmbed } from "./blocks/embed.js";
export { FAQ_ACCORDION_SCRIPT_SOURCE, FAQ_ENHANCED_ATTR } from "./blocks/faq.script.js";

// Self-hosted font primitives. The editor preview mints blob URLs from these
// so its in-memory resolver can satisfy the `assets/fonts/<file>.woff2` paths
// the renderer emits (deploy/zip ship the real bytes; preview has no server).
// Re-exports of existing internal data — emission logic is untouched.
export { FONT_ASSET_PREFIX, FONT_FACE_REGISTRY, woff2Base64 } from "./fonts/registry.js";
export type { FontFaceDef } from "./fonts/registry.js";
export { base64ToBytes } from "./fonts/bytes.js";
