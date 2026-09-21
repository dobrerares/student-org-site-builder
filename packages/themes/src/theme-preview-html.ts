/**
 * Real miniature renders for the theme pickers.
 *
 * The picker used to describe a theme with three hand-written hex swatches and
 * two sample words held in `theme-catalog.ts`. Those were a second, manual
 * copy of information the theme CSS already owns, so they drifted: a swatch
 * could say a theme was crimson long after its palette moved on, and nothing
 * in the build would notice. Worse, they showed the user a colour chip when
 * what they actually wanted to know was "what will my site look like".
 *
 * A miniature is the honest answer: the same renderer, the same theme CSS, the
 * same sample content, scaled down. It cannot drift, because it *is* the
 * output.
 *
 * Cost control — this runs in the picker, which shows every theme at once:
 *   - the HTML for a theme is rendered once and memoised for the session,
 *   - the sample site is deliberately small (one page, a handful of blocks),
 *   - callers mount the iframes lazily and one at a time (see
 *     `theme-mini-preview.tsx`).
 */
import { renderSite, type ThemeBundle } from "@sosb/renderer";

import { asociatiaStudenteascaDemoData } from "./templates/index.js";

/**
 * A neutral placeholder for every asset the sample site references.
 *
 * The miniature has no VFS and no server, so a real `assets/...` path would
 * render as a broken-image glyph and make every theme look equally broken. A
 * flat grey rectangle keeps each image slot filled at its true size, so the
 * miniature shows the theme's actual composition.
 */
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='16'%20height='9'%3E%3Crect%20width='16'%20height='9'%20fill='%23c9c6c0'/%3E%3C/svg%3E";

/**
 * Self-hosted webfonts are skipped in the miniature.
 *
 * The renderer emits `@font-face { src: url(assets/fonts/…) }` — and, for an
 * imported Theme package, `url(assets/theme/<id>/fonts/…)` — which the
 * miniature cannot serve. Returning the placeholder for a font file would make
 * the browser reject a malformed font rather than fall back cleanly, so font
 * paths resolve to a URL that simply fails, and `font-display: swap` shows the
 * theme's fallback stack. Themes differ in far more than their webfont, so the
 * miniature stays representative.
 */
function previewAssetUrl(path: string): string | undefined {
  if (path.endsWith(".woff2")) return undefined;
  return PLACEHOLDER_IMAGE;
}

const htmlCache = new Map<string, string>();

/**
 * Cache key for a miniature.
 *
 * A built-in theme is a compile-time constant, so its id is enough. An
 * imported Theme package is not: re-importing an edited package at the same id
 * must produce a new miniature, or the picker would keep showing the design
 * the author just replaced. The version is part of the key, and `undefined`
 * for built-ins keeps their keys — and their cache hits — exactly as before.
 */
function cacheKey(themeId: string, bundle: ThemeBundle | undefined): string {
  if (bundle === undefined || bundle.origin !== "package") return themeId;
  return `${themeId}@${bundle.version}`;
}

/**
 * The full HTML document for a theme's miniature: the sample site's home page
 * rendered under `themeId`. Memoised per theme for the session — for a
 * built-in the inputs are constants, so the output is too.
 *
 * Rendered in deploy mode: a miniature is a picture, not an interactive
 * preview, so it must not carry the preview-only link interceptor or the
 * in-place update receiver.
 *
 * @param bundle An imported Theme package's resolved bundle. Supplying it is
 *               what lets a custom Theme appear in the picker at all: without
 *               it `renderSite` would look the id up among the built-ins, not
 *               find it, and fall back to the stub layout — so every imported
 *               Theme would preview as the same unstyled page.
 */
export function themePreviewHtml(themeId: string, bundle?: ThemeBundle): string {
  const key = cacheKey(themeId, bundle);
  const cached = htmlCache.get(key);
  if (cached !== undefined) return cached;
  const html = renderSite(asociatiaStudenteascaDemoData, themeId, {
    pageIndex: 0,
    assetUrlForPath: previewAssetUrl,
    ...(bundle === undefined ? {} : { theme: bundle }),
  });
  htmlCache.set(key, html);
  return html;
}

/** Drop the memoised renders. Tests use this; the editor has no reason to. */
export function clearThemePreviewHtmlCache(): void {
  htmlCache.clear();
}

/**
 * The layout width the miniature is rendered at before being scaled down.
 * A desktop-ish width so the theme's real composition (multi-column grids,
 * hero proportions) is what the user sees, rather than its mobile stack.
 */
export const THEME_PREVIEW_VIEWPORT_WIDTH = 1200;
/** Matching layout height; the miniature crops below this. */
export const THEME_PREVIEW_VIEWPORT_HEIGHT = 900;
