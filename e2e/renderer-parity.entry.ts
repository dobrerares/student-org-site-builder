/**
 * Browser-side entry for the renderer parity e2e.
 *
 * This file is bundled by esbuild in `renderer-parity.spec.ts` and injected
 * into the headless Chromium page. Its only job is to attach the renderer
 * to `window` under a stable global so the test can call it from
 * `page.evaluate()`.
 */
import { renderSite } from "../packages/renderer/src/index.js";

declare global {
  interface Window {
    __sosbRenderer: {
      renderSite: typeof renderSite;
    };
  }
}

window.__sosbRenderer = { renderSite };
