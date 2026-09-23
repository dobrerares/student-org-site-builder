/**
 * Browser-side entry for the executable-Theme parity e2e.
 *
 * Bundled by esbuild in `theme-render-parity.spec.ts` and injected into a
 * headless Chromium page as an inline module. Everything the spec needs is
 * attached to `window`: the sandbox initialiser, the package loader, the
 * renderer and the build pipeline — the same four things the editor uses.
 *
 * The bundle is *inline*, which is the point: the QuickJS wasm has to
 * instantiate from bytes embedded in the script, with no second file to
 * fetch, exactly as it must in the single-file archival editor (ADR 0054).
 */
import { initThemeSandbox, loadThemePackage } from "../packages/theme-package/src/index.js";
import { renderSite } from "../packages/renderer/src/index.js";
import { build } from "../packages/build/src/index.js";

declare global {
  interface Window {
    __sosbThemeRender: {
      initThemeSandbox: typeof initThemeSandbox;
      loadThemePackage: typeof loadThemePackage;
      renderSite: typeof renderSite;
      build: typeof build;
    };
  }
}

window.__sosbThemeRender = { initThemeSandbox, loadThemePackage, renderSite, build };
