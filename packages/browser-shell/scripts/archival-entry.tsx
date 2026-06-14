/**
 * Browser-side entry for the archival single-file build.
 *
 * Mounts the welcome shell into `#root`. The bundled bytes get inlined into
 * the archival HTML by `runArchivalBuild()`.
 */
import { render } from "preact";
import { BLANK_SITE } from "../src/blank-site.js";
import { importSiteZip, importSiteZipBlob } from "../src/import-site-zip.js";
import { WelcomeShell } from "../src/welcome-shell.js";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("archival-entry: missing #root");
}
render(
  <WelcomeShell
    blankSite={structuredClone(BLANK_SITE)}
    onImportSite={importSiteZip}
    onImportFile={importSiteZipBlob}
  />,
  root,
);
