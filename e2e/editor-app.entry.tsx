/**
 * Browser-side entry for the editor-app e2e specs.
 *
 * Bundled by esbuild in `editor-app.spec.ts` and injected into headless
 * Chromium via `page.addScriptTag`. Mounts the `<EditorApp>` into the page
 * with a small fixture and exposes `window.__sosbEditor.snapshot()` so the
 * test can assert behaviour without depending on Preact-specific selectors.
 */
import { render } from "preact";
import type { Site } from "@sosb/schema";

import { EditorApp } from "../packages/editor-app/src/index.js";

declare global {
  interface Window {
    __sosbEditor: {
      mount: (site: Site, container: HTMLElement) => void;
    };
  }
}

window.__sosbEditor = {
  mount(site, container) {
    render(<EditorApp initial={site} />, container);
  },
};
