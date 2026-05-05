/**
 * Browser-side entry for the archival single-file build.
 *
 * Mounts the `<EditorApp>` Preact component into `#root`, seeded with the
 * compile-time-injected `__SOSB_INITIAL_SITE_JSON__` fixture. The bundled
 * bytes get inlined into the archival HTML by `runArchivalBuild()`.
 */
import { render } from "preact";
import type { Site } from "@sosb/schema";
import { EditorApp } from "@sosb/editor-app";

declare const __SOSB_INITIAL_SITE_JSON__: string;

const initialSite = JSON.parse(__SOSB_INITIAL_SITE_JSON__) as Site;
const root = document.getElementById("root");
if (root === null) {
  throw new Error("archival-entry: missing #root");
}
render(<EditorApp initial={initialSite} />, root);
