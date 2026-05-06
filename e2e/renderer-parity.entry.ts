/**
 * Browser-side entry for the renderer parity e2e.
 *
 * This file is bundled by esbuild in `renderer-parity.spec.ts` (and
 * `faq-accordion.spec.ts`) and injected into the headless Chromium page.
 * Its only job is to attach the renderer to `window` under a stable global
 * so the test can call it from `page.evaluate()`.
 */
import { FAQ_ACCORDION_SCRIPT_SOURCE, renderSite } from "../packages/renderer/src/index.js";

declare global {
  interface Window {
    __sosbRenderer: {
      renderSite: typeof renderSite;
      FAQ_ACCORDION_SCRIPT_SOURCE: typeof FAQ_ACCORDION_SCRIPT_SOURCE;
    };
  }
}

window.__sosbRenderer = { renderSite, FAQ_ACCORDION_SCRIPT_SOURCE };
