/** @jsxImportSource react */
/**
 * Browser-side entry for the Articles e2e spec.
 *
 * Mounts the real `<EditorApp>` and wires its `onExport` hook to the real
 * `build()` pipeline, so the spec exercises the whole path an author walks:
 * create an Article, write it, publish it, export the website. Capturing the
 * dist folder on the window is what lets the spec assert the *output* rather
 * than just the editor's internal state — the point of the test is that what
 * was authored actually reached a file.
 */
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { injectBuilderCss } from "@sosb/ui/css";
import type { Site } from "@sosb/schema";
import { build } from "../packages/build/src/index.js";

import { EditorApp } from "../packages/editor-app/src/index.js";

interface ExportCapture {
  readonly paths: string[];
  readonly files: Record<string, string>;
  readonly error: string | null;
}

declare global {
  interface Window {
    __sosbArticles: {
      mount: (site: Site, container: HTMLElement) => void;
      lastExport: ExportCapture | null;
    };
  }
}

window.__sosbArticles = {
  lastExport: null,
  mount(site, container) {
    injectBuilderCss();
    const root = createRoot(container);
    flushSync(() => {
      root.render(
        <EditorApp
          initial={site}
          onExport={(siteData) => {
            try {
              const dist = build(siteData, { siteUrl: "https://example.org" });
              const files: Record<string, string> = {};
              for (const [path, value] of dist) {
                if (typeof value === "string") files[path] = value;
              }
              window.__sosbArticles.lastExport = {
                paths: [...dist.keys()],
                files,
                error: null,
              };
            } catch (err) {
              window.__sosbArticles.lastExport = {
                paths: [],
                files: {},
                error: err instanceof Error ? err.message : String(err),
              };
            }
          }}
        />,
      );
    });
  },
};
