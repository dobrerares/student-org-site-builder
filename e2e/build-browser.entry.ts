/**
 * Browser-side entry for the build pipeline e2e.
 *
 * This file is bundled by esbuild in `build-browser.spec.ts` and injected
 * into the headless Chromium page. Its only job is to attach `build` to
 * `window` under a stable global so the test can call it from
 * `page.evaluate()`.
 */
import { build } from "../packages/build/src/index.js";

declare global {
  interface Window {
    __sosbBuild: {
      build: typeof build;
    };
  }
}

window.__sosbBuild = { build };
