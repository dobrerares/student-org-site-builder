/** @jsxImportSource react */
/**
 * Browser-side entry for the documentation screenshots of the redesigned
 * builder (issue #102). Mounts the real `<EditorApp>` on the curated demo
 * Site with an in-memory autosave store, so the top bar shows the real save
 * status rather than the "download a copy" fallback.
 */
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { injectBuilderCss } from "@sosb/ui/css";
import { MemoryDriver } from "../packages/vfs/src/memory.js";
import { asociatiaStudenteascaDemoData } from "../packages/themes/src/index.js";

import { EditorApp } from "../packages/editor-app/src/index.js";

declare global {
  interface Window {
    __sosbShots: {
      mount: (container: HTMLElement) => void;
    };
  }
}

window.__sosbShots = {
  mount(container) {
    injectBuilderCss();
    const root = createRoot(container);
    flushSync(() => {
      root.render(
        <EditorApp
          initial={structuredClone(asociatiaStudenteascaDemoData)}
          autosaveVfs={new MemoryDriver()}
        />,
      );
    });
  },
};
