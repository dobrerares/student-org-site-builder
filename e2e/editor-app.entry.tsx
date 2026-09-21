/** @jsxImportSource react */
/**
 * Browser-side entry for the editor-app e2e specs.
 *
 * Bundled by esbuild in `editor-app.spec.ts` and injected into headless
 * Chromium via `page.addScriptTag`. Mounts the `<EditorApp>` into the page
 * with a small fixture and exposes `window.__sosbEditor.snapshot()` so the
 * test can assert behaviour without depending on React-specific selectors.
 */
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { injectBuilderCss } from "@sosb/ui/css";
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
    injectBuilderCss();
    const root = createRoot(container);
    // `flushSync` so the spec can query the DOM straight after `mount()`
    // returns — `createRoot().render()` is otherwise scheduled.
    flushSync(() => {
      root.render(<EditorApp initial={site} />);
    });
  },
};
