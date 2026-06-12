/**
 * Browser-side entry for the archival single-file build.
 *
 * Mounts the `<EditorApp>` Preact component into `#root`, seeded with the
 * compile-time-injected `__SOSB_INITIAL_SITE_JSON__` fixture. The bundled
 * bytes get inlined into the archival HTML by `runArchivalBuild()`.
 */
import { render } from "preact";
import type { Site } from "@sosb/schema";
import { importFromZip } from "@sosb/zip";
import { WelcomeShell } from "../src/welcome-shell.js";

declare const __SOSB_INITIAL_SITE_JSON__: string;

const initialSite = JSON.parse(__SOSB_INITIAL_SITE_JSON__) as Site;
const root = document.getElementById("root");
if (root === null) {
  throw new Error("archival-entry: missing #root");
}
render(<WelcomeShell blankSite={initialSite} onImportSite={importSiteZip} />, root);

async function importSiteZip() {
  const blob = await pickZipBlob();
  if (blob === null) return null;
  const imported = await importFromZip(blob);
  return { site: imported.siteData, assetVfs: imported.vfs };
}

function pickZipBlob(): Promise<Blob | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,application/zip";
    input.style.display = "none";

    const cleanup = (): void => {
      input.remove();
    };

    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0];
        cleanup();
        resolve(file ?? null);
      },
      { once: true },
    );
    input.addEventListener(
      "cancel",
      () => {
        cleanup();
        resolve(null);
      },
      { once: true },
    );

    document.body.appendChild(input);
    input.click();
  });
}
