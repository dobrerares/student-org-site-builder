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
import { emitTokenRoot } from "./tokens.js";
import { STUB_THEME_CSS, STUB_THEME_ID } from "./themes/stub.js";

export interface RenderOptions {
  /**
   * Index of the page in `site.pages` to render. Defaults to `0` (the home
   * page). The build pipeline (#5) calls `renderSite` once per page; the
   * editor preview also picks a single page at a time.
   */
  readonly pageIndex?: number;
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
 * @param themeId Theme to render under. Today only `"stub"` is implemented;
 *                future themes (#28-#31, #47) register additional ids.
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

  const css = composeCss(data, themeId);
  const body = render(<PageShell site={data} page={page} css={css} />);
  return `<!doctype html>${body}`;
}

function composeCss(site: Site, themeId: string): string {
  const root = emitTokenRoot(site);
  const themeCss = themeCssFor(themeId);
  return `${root}\n${themeCss}`;
}

function themeCssFor(themeId: string): string {
  if (themeId === STUB_THEME_ID) return STUB_THEME_CSS;
  // Unknown / future themes fall back to the stub layout. This keeps the
  // renderer functional even before the themes package lands its full set
  // (#28-#31, #47). The themes package will register itself by id when it
  // arrives.
  return STUB_THEME_CSS;
}

export { STUB_THEME_ID } from "./themes/stub.js";
