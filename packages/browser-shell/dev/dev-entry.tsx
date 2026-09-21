/** @jsxImportSource react */
import { createRoot } from "react-dom/client";
// JS-side injection rather than `import "@sosb/ui/styles.css"`: this entry
// is bundled both by Vite (which handles CSS) and, in the e2e specs, by a
// plain esbuild call with no output path — and esbuild refuses a CSS import
// in that mode. The injector works in both. The archival build is the one
// path that deliberately goes through the real CSS import, so the
// bundler-collects-CSS behaviour stays exercised.
import { injectBuilderCss } from "@sosb/ui/css";
import { BLANK_SITE } from "../src/blank-site.js";
import { WelcomeShell } from "../src/welcome-shell.js";
import { importSiteZip, importSiteZipBlob } from "../src/import-site-zip.js";

injectBuilderCss();

const root = document.getElementById("root");
if (root === null) {
  throw new Error("dev-entry: missing #root");
}

createRoot(root).render(
  <WelcomeShell
    blankSite={structuredClone(BLANK_SITE)}
    onImportSite={importSiteZip}
    onImportFile={importSiteZipBlob}
  />,
);
