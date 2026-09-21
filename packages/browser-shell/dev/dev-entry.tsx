/** @jsxImportSource react */
import { createRoot } from "react-dom/client";
import "@sosb/ui/styles.css";
import { BLANK_SITE } from "../src/blank-site.js";
import { WelcomeShell } from "../src/welcome-shell.js";
import { importSiteZip, importSiteZipBlob } from "../src/import-site-zip.js";

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
